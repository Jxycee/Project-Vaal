import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Why this file exists.
//
// POST /api/builds is the only write path the build editor has, and until now
// the only thing exercising it was the e2e suite — which always saves through
// BuildSavePanel, and therefore always sends a complete body. The branch that
// matters most is the one a complete body never reaches: on update, gear_state,
// gem_state and main_skill are written ONLY when the request actually carried
// that key, precisely so a save that omits them cannot wipe what is already
// stored. Nothing anywhere proved that, and it is the difference between "this
// save touched the tree" and "this save silently emptied your gear".
//
// The validation branches above it were in the same position: a 400 that
// regressed into a 500, or into a write, would have gone unnoticed. These are
// pure request-shaping decisions, so they belong in a test that runs in
// milliseconds rather than one that needs a browser and a live database.

const getUserMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();

/** What the mocked `.maybeSingle()` / `.single()` resolve to; set per test. */
let updateResult: { data: unknown; error: unknown } = { data: { id: 'build-1' }, error: null };
let insertResult: { data: unknown; error: unknown } = { data: { id: 'build-1' }, error: null };

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: () => getUserMock() },
    from: () => ({
      update: (payload: unknown) => {
        updateMock(payload);
        return { eq: () => ({ select: () => ({ maybeSingle: async () => updateResult }) }) };
      },
      insert: (payload: unknown) => {
        insertMock(payload);
        return { select: () => ({ single: async () => insertResult }) };
      },
    }),
  }),
}));

import { POST } from './route';

const AUTHED = { data: { user: { id: 'user-1' } } };
const ANONYMOUS = { data: { user: null } };

/** A body that passes every validation gate, so each test can vary one thing. */
function validBody(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Test build',
    class: 'Witch',
    level: 42,
    league: 'Standard',
    passive_state: { set1: [1, 2], set2: [], ascendancyNodes: [] },
    ...overrides,
  };
}

function req(body: unknown) {
  return new NextRequest('http://localhost/api/builds', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  getUserMock.mockReset();
  updateMock.mockReset();
  insertMock.mockReset();
  getUserMock.mockResolvedValue(AUTHED);
  updateResult = { data: { id: 'build-1' }, error: null };
  insertResult = { data: { id: 'build-1' }, error: null };
});

describe('POST /api/builds — rejecting a request before it can write', () => {
  it('refuses a signed-out caller without touching the table', async () => {
    getUserMock.mockResolvedValue(ANONYMOUS);

    const res = await POST(req(validBody()));

    expect(res.status).toBe(401);
    expect(insertMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('answers 400 rather than 500 for a body that is not JSON', async () => {
    const res = await POST(req('{ not json'));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON' });
  });

  it.each([
    ['null', null],
    ['a number', 7],
    ['a string', '"a string"'],
    ['an array', []],
  ])('answers 400 for %s body, which is valid JSON but has no fields to read', async (_l, body) => {
    // These all survive JSON.parse. Without the explicit shape check they would
    // reach `body.name` and surface as a generic 500.
    const res = await POST(req(body));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejects a non-string build id instead of passing it to .eq()', async () => {
    const res = await POST(req(validBody({ id: 12 })));
    expect(res.status).toBe(400);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing name', { name: undefined }, 'Name is required'],
    ['a whitespace-only name', { name: '   ' }, 'Name is required'],
    ['a missing class', { class: undefined }, 'Class is required'],
  ])('rejects %s', async (_label, overrides, error) => {
    const res = await POST(req(validBody(overrides)));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it.each([0, 101, -5])('rejects level %i as out of range', async (level) => {
    const res = await POST(req(validBody({ level })));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejects a passive_state whose node arrays are not all numbers', async () => {
    // A malformed allocation stored here comes back as a tree that cannot be
    // rendered, on a route with no way to recover it — so it is refused at the
    // door rather than persisted and discovered later.
    const res = await POST(req(validBody({ passive_state: { set1: ['x'], set2: [], ascendancyNodes: [] } })));
    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/builds — creating a row', () => {
  it('starts gear and gems empty when the body omits them', async () => {
    await POST(req(validBody()));

    const payload = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.gear_state).toEqual({});
    expect(payload.gem_state).toEqual({});
    expect(payload.main_skill).toBeNull();
    expect(payload.user_id).toBe('user-1');
    // Minted server-side; that is the whole reason saves go through a route.
    expect(typeof payload.share_token).toBe('string');
  });

  it('defaults an absent league and passive_state rather than writing undefined', async () => {
    await POST(req({ name: 'Test build', class: 'Witch', level: 42 }));

    const payload = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.league).toBe('Standard');
    expect(payload.passive_state).toEqual({ set1: [], set2: [], ascendancyNodes: [] });
  });
});

describe('POST /api/builds — updating a row', () => {
  it('leaves gear_state, gem_state and main_skill out of the update when the body omitted them', async () => {
    // The anti-wipe rule. A save that only meant to touch the tree must not
    // reach the gear and gem columns at all — writing a default here would
    // erase whatever is stored, which is exactly the class of data loss this
    // route was rewritten to make unreachable.
    await POST(req(validBody({ id: 'build-1' })));

    const payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect('gear_state' in payload).toBe(false);
    expect('gem_state' in payload).toBe(false);
    expect('main_skill' in payload).toBe(false);
    expect(payload.name).toBe('Test build');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('writes gear_state and gem_state when the body does carry them', async () => {
    const gear = { boots: { name: 'Some Boots' } };
    const gem = { loadouts: [], primaryId: null };

    await POST(req(validBody({ id: 'build-1', gear_state: gear, gem_state: gem })));

    const payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.gear_state).toEqual(gear);
    expect(payload.gem_state).toEqual(gem);
  });

  it('writes main_skill: null when the body sends null, so the main skill can be cleared', async () => {
    // JSON.stringify drops an undefined value, so the client sends null rather
    // than undefined precisely to reach this branch. If the route treated null
    // as "absent", unsetting a main skill would be impossible.
    await POST(req(validBody({ id: 'build-1', main_skill: null })));

    const payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect('main_skill' in payload).toBe(true);
    expect(payload.main_skill).toBeNull();
  });

  it('reports 404 when RLS matches no row, rather than confirming the id exists', async () => {
    // Nonexistent and not-ours are deliberately indistinguishable: telling them
    // apart would leak other users' build ids.
    updateResult = { data: null, error: null };

    const res = await POST(req(validBody({ id: 'someone-elses-build' })));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Build not found' });
  });

  it('does not leak the database error message to the caller', async () => {
    updateResult = { data: null, error: { message: 'relation "builds" does not exist' } };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(req(validBody({ id: 'build-1' })));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Could not save this build.' });
    consoleError.mockRestore();
  });
});
