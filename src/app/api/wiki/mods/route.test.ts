import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const getCachedUserMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getCachedUser: () => getCachedUserMock(),
}));

const eligibleModsMock = vi.fn();
vi.mock('@/lib/wiki/modCatalogue', () => ({
  eligibleMods: (...args: unknown[]) => eligibleModsMock(...args),
}));

import { GET } from './route';

const AUTHED = { data: { user: { id: 'user-1' } }, error: null };
const req = (query: string) => new NextRequest(`http://localhost/api/wiki/mods${query}`);

beforeEach(() => {
  getCachedUserMock.mockReset();
  eligibleModsMock.mockReset();
  getCachedUserMock.mockResolvedValue(AUTHED);
  eligibleModsMock.mockResolvedValue([]);
});

// Failure modes first (AGENTS.md). /api/ is not in PROTECTED_PREFIXES, and the
// data behind this route sits under the auth-gated /data/wiki/ prefix, so the
// route must check the session itself — before anything else.
describe('GET /api/wiki/mods — every way a request is refused', () => {
  it('401s a signed-out caller and never reads the catalogue', async () => {
    getCachedUserMock.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET(req('?item=amethyst-ring&kind=prefix'));
    expect(res.status).toBe(401);
    expect(eligibleModsMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no item', '?kind=prefix'],
    ['no kind', '?item=amethyst-ring'],
    ['an unknown kind', '?item=amethyst-ring&kind=implicit'],
  ])('400s %s', async (_label, query) => {
    const res = await GET(req(query));
    expect(res.status).toBe(400);
    expect(eligibleModsMock).not.toHaveBeenCalled();
  });

  it('404s an item the catalogue does not know', async () => {
    eligibleModsMock.mockResolvedValue(null);
    const res = await GET(req('?item=../package&kind=prefix'));
    expect(res.status).toBe(404);
  });

  it('500s with a JSON body when the catalogue cannot load', async () => {
    eligibleModsMock.mockRejectedValue(new Error('EMFILE'));
    const res = await GET(req('?item=amethyst-ring&kind=prefix'));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Failed to load mod data' });
  });
});

describe('GET /api/wiki/mods — success', () => {
  it('returns the groups for the requested item and kind', async () => {
    const groups = [{ group: 'ColdDamage', tiers: [{ slug: 'addedcolddamage1', tier: 1, level: 1, stats: [], rolls: [] }] }];
    eligibleModsMock.mockResolvedValue(groups);
    const res = await GET(req('?item=amethyst-ring&kind=suffix'));
    expect(res.status).toBe(200);
    expect(eligibleModsMock).toHaveBeenCalledWith('amethyst-ring', 'suffix');
    expect(await res.json()).toEqual({ groups });
  });
});
