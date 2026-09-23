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

type Result = { data: unknown; error: unknown };

const getUserMock = vi.fn();
const updateMock = vi.fn();
const insertMock = vi.fn();
const cpUpdateMock = vi.fn();
const cpSelectMock = vi.fn();

/** What each mocked query resolves to; set per test. */
let updateResult: Result = { data: { id: 'build-1' }, error: null };
let insertResult: Result = { data: { id: 'build-1' }, error: null };
let cpUpdateResult: Result = { data: { id: 'cp-0' }, error: null };
let cpSelectResult: Result = { data: [{ id: 'cp-0' }], error: null };

/** Every .eq() applied to a build_checkpoints query, in order. Scoping is a security property here, so tests assert it. */
let cpEqCalls: Array<[string, unknown]> = [];
/** Which table was written first. The route must write the checkpoint before mirroring onto the build. */
let writeOrder: string[] = [];

/**
 * A stand-in for a supabase-js query builder: every filter method returns the
 * builder, and it resolves either through .maybeSingle()/.single() or by being
 * awaited directly, the way a real list query is.
 */
function chain(result: () => Result, eqCalls?: Array<[string, unknown]>) {
  const builder: Record<string, unknown> = {};
  builder.select = () => builder;
  builder.eq = (column: string, value: unknown) => {
    eqCalls?.push([column, value]);
    return builder;
  };
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.maybeSingle = async () => result();
  builder.single = async () => result();
  builder.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result()).then(resolve, reject);
  return builder;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: () => getUserMock() },
    from: (table: string) => {
      if (table === 'build_checkpoints') {
        return {
          update: (payload: unknown) => {
            cpUpdateMock(payload);
            writeOrder.push('build_checkpoints');
            return chain(() => cpUpdateResult, cpEqCalls);
          },
          select: (columns: unknown) => {
            cpSelectMock(columns);
            return chain(() => cpSelectResult, cpEqCalls);
          },
        };
      }
      return {
        update: (payload: unknown) => {
          updateMock(payload);
          writeOrder.push('builds');
          return chain(() => updateResult);
        },
        insert: (payload: unknown) => {
          insertMock(payload);
          return chain(() => insertResult);
        },
      };
    },
  }),
}));

import { POST } from './route';

const AUTHED = { data: { user: { id: 'user-1' } } };
const ANONYMOUS = { data: { user: null } };

// Real UUIDs. The route rejects a non-UUID id before it reaches Postgres, so
// any test meant to exercise the database path has to use one.
const BUILD_ID = '11111111-1111-4111-8111-111111111111';
const CP_ID = '22222222-2222-4222-8222-222222222222';

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
  cpUpdateMock.mockReset();
  cpSelectMock.mockReset();
  getUserMock.mockResolvedValue(AUTHED);
  updateResult = { data: { id: BUILD_ID }, error: null };
  insertResult = { data: { id: BUILD_ID }, error: null };
  cpUpdateResult = { data: { id: CP_ID }, error: null };
  cpSelectResult = { data: [{ id: CP_ID }], error: null };
  cpEqCalls = [];
  writeOrder = [];
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

  it('rejects a non-string notes value', async () => {
    const res = await POST(req(validBody({ notes: 42 })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid notes' });
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejects notes over MAX_NOTES_LENGTH characters', async () => {
    const res = await POST(req(validBody({ notes: 'x'.repeat(4001) })));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Notes must be 4000 characters or fewer' });
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
    expect(payload.notes).toBeNull();
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

  it('trims notes and stores a whitespace-only value as null', async () => {
    await POST(req(validBody({ notes: '  Good against tanky bosses.  ' })));
    expect((insertMock.mock.calls[0][0] as Record<string, unknown>).notes).toBe('Good against tanky bosses.');

    insertMock.mockReset();
    await POST(req(validBody({ notes: '   ' })));
    expect((insertMock.mock.calls[0][0] as Record<string, unknown>).notes).toBeNull();
  });
});

describe('POST /api/builds — updating a row', () => {
  it('leaves gear_state, gem_state and main_skill out of the update when the body omitted them', async () => {
    // The anti-wipe rule. A save that only meant to touch the tree must not
    // reach the gear and gem columns at all — writing a default here would
    // erase whatever is stored, which is exactly the class of data loss this
    // route was rewritten to make unreachable.
    await POST(req(validBody({ id: BUILD_ID })));

    const payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect('gear_state' in payload).toBe(false);
    expect('gem_state' in payload).toBe(false);
    expect('main_skill' in payload).toBe(false);
    expect('notes' in payload).toBe(false);
    expect(payload.name).toBe('Test build');
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('writes notes when the body carries them, and clears them with an explicit empty string', async () => {
    await POST(req(validBody({ id: BUILD_ID, notes: 'Great vs tanky bosses.' })));
    let payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.notes).toBe('Great vs tanky bosses.');

    updateMock.mockReset();
    await POST(req(validBody({ id: BUILD_ID, notes: '' })));
    payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect('notes' in payload).toBe(true);
    expect(payload.notes).toBeNull();
  });

  it('writes gear_state and gem_state when the body does carry them', async () => {
    const gear = { boots: { name: 'Some Boots' } };
    const gem = { loadouts: [], primaryId: null };

    await POST(req(validBody({ id: BUILD_ID, gear_state: gear, gem_state: gem })));

    const payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.gear_state).toEqual(gear);
    expect(payload.gem_state).toEqual(gem);
  });

  it('writes main_skill: null when the body sends null, so the main skill can be cleared', async () => {
    // JSON.stringify drops an undefined value, so the client sends null rather
    // than undefined precisely to reach this branch. If the route treated null
    // as "absent", unsetting a main skill would be impossible.
    await POST(req(validBody({ id: BUILD_ID, main_skill: null })));

    const payload = updateMock.mock.calls[0][0] as Record<string, unknown>;
    expect('main_skill' in payload).toBe(true);
    expect(payload.main_skill).toBeNull();
  });

  it('reports 404 when RLS matches no row, rather than confirming the id exists', async () => {
    // Nonexistent and not-ours are deliberately indistinguishable: telling them
    // apart would leak other users' build ids.
    // RLS hides someone else's checkpoints as well as their build, so the
    // checkpoint lookup comes back empty before any write is attempted.
    cpSelectResult = { data: [], error: null };
    updateResult = { data: null, error: null };

    const res = await POST(req(validBody({ id: BUILD_ID })));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Build not found' });
  });

  it('does not leak the database error message to the caller', async () => {
    updateResult = { data: null, error: { message: 'relation "builds" does not exist' } };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(req(validBody({ id: BUILD_ID })));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Could not save this build.' });
    consoleError.mockRestore();
  });
});

describe('POST /api/builds — malformed ids', () => {
  // Every other entry point (builds/actions.ts) answers a non-UUID id with the
  // same not-found it gives a real id that isn't yours, so "malformed" and
  // "someone else's" are indistinguishable. This route used to pass the raw
  // string to Postgres and surface its cast error as a 500 instead.
  it('answers 404 for a non-UUID build id without touching the database', async () => {
    const res = await POST(req(validBody({ id: 'not-a-uuid' })));

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Build not found' });
    expect(updateMock).not.toHaveBeenCalled();
    expect(cpUpdateMock).not.toHaveBeenCalled();
    expect(cpSelectMock).not.toHaveBeenCalled();
  });

  it('answers 404 for a non-UUID checkpoint id without touching the database', async () => {
    const res = await POST(req(validBody({ id: BUILD_ID, checkpoint_id: 'not-a-uuid' })));

    expect(res.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
    expect(cpUpdateMock).not.toHaveBeenCalled();
  });

  it('rejects a checkpoint id on a create, where there is no build to own it yet', async () => {
    const res = await POST(req(validBody({ checkpoint_id: CP_ID })));

    expect(res.status).toBe(400);
    expect(insertMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/builds — saving into a checkpoint', () => {
  it('writes the named checkpoint, scoped to this build, before mirroring onto the build', async () => {
    const passive = { set1: [7, 8], set2: [], ascendancyNodes: [3] };

    const res = await POST(req(validBody({ id: BUILD_ID, checkpoint_id: CP_ID, passive_state: passive, level: 94 })));

    expect(res.status).toBe(200);
    const cpPayload = cpUpdateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(cpPayload.passive_state).toEqual(passive);
    expect(cpPayload.level).toBe(94);

    // Scoped by BOTH ids. Filtering on the checkpoint id alone would let a
    // save for one of your builds overwrite a checkpoint belonging to another
    // of your builds — RLS allows it, since you own both.
    expect(cpEqCalls).toContainEqual(['id', CP_ID]);
    expect(cpEqCalls).toContainEqual(['build_id', BUILD_ID]);

    // The checkpoint is the source of truth; the build row is a mirror. If the
    // order were reversed, a failed checkpoint write would leave the mirror
    // ahead of the thing it mirrors.
    expect(writeOrder).toEqual(['build_checkpoints', 'builds']);
    expect((updateMock.mock.calls[0][0] as Record<string, unknown>).passive_state).toEqual(passive);
  });

  it('applies the anti-wipe rule to the checkpoint too', async () => {
    // Same reasoning as the build row: a save that only touched the tree must
    // not reach gear or gems at all.
    await POST(req(validBody({ id: BUILD_ID, checkpoint_id: CP_ID })));

    const cpPayload = cpUpdateMock.mock.calls[0][0] as Record<string, unknown>;
    expect('gear_state' in cpPayload).toBe(false);
    expect('gem_state' in cpPayload).toBe(false);
  });

  it('writes gear and gems into the checkpoint when the body carries them', async () => {
    const gear = { boots: { name: 'Some Boots' } };
    const gem = { loadouts: [], primaryId: null };

    await POST(req(validBody({ id: BUILD_ID, checkpoint_id: CP_ID, gear_state: gear, gem_state: gem })));

    const cpPayload = cpUpdateMock.mock.calls[0][0] as Record<string, unknown>;
    expect(cpPayload.gear_state).toEqual(gear);
    expect(cpPayload.gem_state).toEqual(gem);
  });

  it('answers 404 and leaves the build untouched when the checkpoint matches nothing', async () => {
    // A checkpoint id from another build, or one already deleted. The build
    // row must not be updated either — otherwise the mirror would move while
    // the checkpoint it mirrors did not.
    cpUpdateResult = { data: null, error: null };

    const res = await POST(req(validBody({ id: BUILD_ID, checkpoint_id: CP_ID })));

    expect(res.status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('does not leak a checkpoint write error, and leaves the build untouched', async () => {
    cpUpdateResult = { data: null, error: { message: 'relation "build_checkpoints" does not exist' } };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(req(validBody({ id: BUILD_ID, checkpoint_id: CP_ID })));

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Could not save this build.' });
    expect(updateMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('returns the checkpoint alongside the build', async () => {
    cpUpdateResult = { data: { id: CP_ID, position: 0 }, error: null };

    const res = await POST(req(validBody({ id: BUILD_ID, checkpoint_id: CP_ID })));

    expect(await res.json()).toEqual({ build: { id: BUILD_ID }, checkpoint: { id: CP_ID, position: 0 } });
  });
});

describe('POST /api/builds — a save that names no checkpoint', () => {
  // The client before Slice 1's UI sends no checkpoint_id. Without a rule for
  // that, its saves would update the build row and leave checkpoint 0 behind,
  // and the mirror would silently drift from what it mirrors. The rule has to
  // be deterministic, not a guess.

  it('writes the only checkpoint when the build has exactly one', async () => {
    cpSelectResult = { data: [{ id: CP_ID }], error: null };

    const res = await POST(req(validBody({ id: BUILD_ID })));

    expect(res.status).toBe(200);
    expect(cpEqCalls).toContainEqual(['build_id', BUILD_ID]);
    expect(cpEqCalls).toContainEqual(['id', CP_ID]);
    expect(cpUpdateMock).toHaveBeenCalledTimes(1);
    expect(writeOrder).toEqual(['build_checkpoints', 'builds']);
  });

  it('refuses rather than guesses when the build has several', async () => {
    cpSelectResult = { data: [{ id: CP_ID }, { id: '33333333-3333-4333-8333-333333333333' }], error: null };

    const res = await POST(req(validBody({ id: BUILD_ID })));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'checkpoint_id is required when a build has more than one checkpoint' });
    expect(cpUpdateMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('answers 404 without writing when no checkpoint is visible', async () => {
    // Every build has one (a trigger guarantees it), so seeing none means RLS
    // is hiding the build — it is not ours.
    cpSelectResult = { data: [], error: null };

    const res = await POST(req(validBody({ id: BUILD_ID })));

    expect(res.status).toBe(404);
    expect(cpUpdateMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/builds — creating a row returns its first checkpoint', () => {
  it('returns the checkpoint the database created alongside the build', async () => {
    // The AFTER INSERT trigger creates checkpoint 0. The client needs its id
    // for the next save, so the route reads it back rather than making the
    // client ask.
    cpSelectResult = { data: { id: CP_ID, position: 0 }, error: null };

    const res = await POST(req(validBody()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ build: { id: BUILD_ID }, checkpoint: { id: CP_ID, position: 0 } });
    expect(cpEqCalls).toContainEqual(['build_id', BUILD_ID]);
  });

  it('still reports a successful save when reading the checkpoint back fails', async () => {
    // The build and its checkpoint were written; only the follow-up read
    // failed. Answering 500 would tell the user their save was lost when it
    // was not, and a retry would create a duplicate build.
    cpSelectResult = { data: null, error: { message: 'timeout' } };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await POST(req(validBody()));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ build: { id: BUILD_ID }, checkpoint: null });
    consoleError.mockRestore();
  });
});
