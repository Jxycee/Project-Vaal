import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Server Functions are reachable by a direct POST, not only through our UI,
// so each must hold up on its own: session first, nothing fetched or written
// for a signed-out caller, and nothing written unless every checkpoint passes
// the same write gate as POST /api/builds. The pipeline under them (source,
// decode, parse, map) runs for real on the vendored fixture; only Supabase,
// next/cache and the network are stubbed. import_build itself was verified
// against the live database when its migration was applied.

const refreshMock = vi.fn();
const getUserMock = vi.fn();
const rpcMock = vi.fn();
let gearGateFails = false;

vi.mock('next/cache', () => ({ refresh: () => refreshMock() }));

vi.mock('@/lib/supabase/server', () => ({
  getCachedUser: () => getUserMock(),
  createClient: async () => ({ rpc: (fn: string, args: unknown) => rpcMock(fn, args) }),
}));

vi.mock('@/lib/build/stateInput', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/build/stateInput')>();
  return {
    ...actual,
    cleanGearStateInput: (raw: unknown) =>
      gearGateFails ? { ok: false as const, error: 'Malformed gear_state' } : actual.cleanGearStateInput(raw),
  };
});

import { importPobBuild, previewPobImport } from './importActions';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const NEW_BUILD = '44444444-4444-4444-8444-444444444444';
const CODE = readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8');

const fetchSpy = vi.fn(async () => {
  throw new Error('no network in tests');
});

beforeEach(() => {
  refreshMock.mockReset();
  getUserMock.mockReset();
  rpcMock.mockReset();
  fetchSpy.mockClear();
  gearGateFails = false;
  vi.stubGlobal('fetch', fetchSpy);
  getUserMock.mockResolvedValue({ data: { user: { id: USER } } });
  rpcMock.mockResolvedValue({ data: NEW_BUILD, error: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('previewPobImport / importPobBuild — every way they can go wrong', () => {
  it('signed out: nothing is fetched, decoded or written', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect((await previewPobImport('https://pobb.in/abc123')).ok).toBe(false);
    expect((await importPobBuild('https://pobb.in/abc123')).ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('turns an allowlist refusal into a message a person can read, with no request made', async () => {
    const result = await previewPobImport('https://evil.example/pob/abc');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/not a supported build site/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ['not a code at all', 'hello world!!', /could not be read/],
    ['a Path of Building 1 build', 'eJyzsa_IzVEoSy0qzszPs1Uy1DNQUkjNS85PycxLt1UKDXHTtVCyt-OyCUgsyfBPcyrNzAHJ2NmAWQo5qWWpObZKhkr6djb6aEoAIywdTA==', /Path of Building 1|PoE1|Path of Exile 1/],
  ])('refuses %s with a readable message', async (_label, input, message) => {
    const result = await previewPobImport(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(message);
  });

  it('refuses input that is not a string, or absurdly long, before doing any work', async () => {
    expect((await previewPobImport(42 as unknown as string)).ok).toBe(false);
    expect((await previewPobImport('a'.repeat(3 * 1024 * 1024))).ok).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('writes nothing when any checkpoint fails the write gate', async () => {
    gearGateFails = true;
    const result = await importPobBuild(CODE);
    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('refuses a name over 80 characters, writing nothing', async () => {
    const result = await importPobBuild(CODE, 'n'.repeat(81));
    expect(result.ok).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('reports a database failure without leaking it, and does not refresh', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'violates check constraint secret_detail' } });
    const result = await importPobBuild(CODE);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).not.toContain('secret_detail');
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe('previewPobImport — the real build', () => {
  it('summarises without writing', async () => {
    const result = await previewPobImport(CODE);
    expect(rpcMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.summary).toMatchObject({ name: 'Witchhunter — imported', className: 'Mercenary', ascendancy: 'Witchhunter' });
    expect(result.summary.checkpoints.map((c) => c.level)).toEqual([31, 37, 44, 49, 56, 63, 70, 94]);
    expect(result.summary.checkpoints[0]).toMatchObject({ passives: 35, ascendancyPassives: 2 });
    expect(result.summary.checkpoints[7]).toMatchObject({ passives: 116, ascendancyPassives: 8 });
    expect(result.summary).toMatchObject({ skills: 5, gems: 20, items: 12, jewels: 2 });
    expect(result.report.length).toBeGreaterThan(0);
  });
});

describe('importPobBuild — the real build', () => {
  it('calls import_build once with gated state for all 8 checkpoints, then refreshes', async () => {
    const result = await importPobBuild(CODE, '  My Witchhunter  ');
    expect(result).toEqual({ ok: true, id: NEW_BUILD });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fn, args] = rpcMock.mock.calls[0] as [string, { p_build: Record<string, unknown>; p_checkpoints: unknown[] }];
    expect(fn).toBe('import_build');
    expect(args.p_build).toMatchObject({
      name: 'My Witchhunter',
      class: 'Mercenary',
      ascendancy: 'Mercenary2',
      level: 94,
      main_skill: 'Siege Ballista',
    });
    expect(args.p_build.share_token).toMatch(/^[A-Za-z0-9_-]{21}$/);
    expect(args.p_checkpoints).toHaveLength(8);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});
