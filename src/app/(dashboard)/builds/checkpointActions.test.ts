import { beforeEach, describe, expect, it, vi } from 'vitest';

// Server Functions are reachable by a direct POST, not only through our UI, so
// each one has to hold up on its own: re-check the session, reject a malformed
// id before it reaches Postgres, and answer "not yours" and "does not exist"
// identically. These tests pin that behaviour; the database-side guarantees
// (RLS, the last-checkpoint trigger, the reorder function's own checks) were
// verified against the live database when their migrations were applied.

type Result = { data: unknown; error: unknown };

const refreshMock = vi.fn();
const getUserMock = vi.fn();
const calls: Array<{ table: string; op: string; arg?: unknown; filters: Array<[string, unknown]> }> = [];

let results: Record<string, Result> = {};

function chain(key: string, record: { filters: Array<[string, unknown]> }) {
  const builder: Record<string, unknown> = {};
  const resolve = () => results[key] ?? { data: null, error: null };
  builder.select = () => builder;
  builder.eq = (column: string, value: unknown) => {
    record.filters.push([column, value]);
    return builder;
  };
  builder.order = () => builder;
  builder.limit = () => builder;
  builder.maybeSingle = async () => resolve();
  builder.single = async () => resolve();
  builder.then = (ok: (v: Result) => unknown, fail?: (e: unknown) => unknown) =>
    Promise.resolve(resolve()).then(ok, fail);
  return builder;
}

vi.mock('next/cache', () => ({ refresh: () => refreshMock() }));

vi.mock('@/lib/supabase/server', () => ({
  getCachedUser: () => getUserMock(),
  createClient: async () => ({
    rpc: async (fn: string, args: unknown) => {
      calls.push({ table: 'rpc', op: fn, arg: args, filters: [] });
      return results[`rpc:${fn}`] ?? { data: null, error: null };
    },
    from: (table: string) => {
      const op = (name: string, keyOf: (arg: unknown) => string) => (arg?: unknown) => {
        const record = { table, op: name, arg, filters: [] as Array<[string, unknown]> };
        calls.push(record);
        return chain(`${table}:${keyOf(arg)}`, record);
      };
      return {
        select: op('select', (cols) => `select:${String(cols)}`),
        insert: op('insert', () => 'insert'),
        update: op('update', () => 'update'),
        delete: op('delete', () => 'delete'),
      };
    },
  }),
}));

import {
  addCheckpoint,
  deleteCheckpoint,
  renameCheckpoint,
  reorderCheckpoints,
} from './checkpointActions';

const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const BUILD = '11111111-1111-4111-8111-111111111111';
const CP_A = '22222222-2222-4222-8222-222222222222';
const CP_B = '33333333-3333-4333-8333-333333333333';
const NOT_FOUND = { ok: false, error: "Couldn't find that build." };

const writes = () => calls.filter((c) => c.op === 'insert' || c.op === 'update' || c.op === 'delete' || c.table === 'rpc');

beforeEach(() => {
  calls.length = 0;
  refreshMock.mockReset();
  getUserMock.mockReset();
  getUserMock.mockResolvedValue({ data: { user: { id: USER } } });
  results = {
    'builds:select:id': { data: { id: BUILD }, error: null },
    'build_checkpoints:select:position': { data: { position: 2 }, error: null },
    'build_checkpoints:select:passive_state, gear_state, gem_state': {
      data: { passive_state: { set1: [9], set2: [], ascendancyNodes: [] }, gear_state: { head: null }, gem_state: { loadouts: [] } },
      error: null,
    },
    'build_checkpoints:insert': { data: { id: CP_B }, error: null },
    'build_checkpoints:update': { data: [{ id: CP_A }], error: null },
    'build_checkpoints:delete': { data: [{ id: CP_A }], error: null },
  };
});

describe('every checkpoint action — refusing before it can write', () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ['addCheckpoint', () => addCheckpoint('not-a-uuid', 'Level 40', 40)],
    ['renameCheckpoint', () => renameCheckpoint('not-a-uuid', 'x')],
    ['deleteCheckpoint', () => deleteCheckpoint('not-a-uuid')],
    ['reorderCheckpoints', () => reorderCheckpoints('not-a-uuid', [CP_A])],
  ];

  it.each(cases)('%s answers a malformed id with not-found and touches nothing', async (_name, run) => {
    expect(await run()).toEqual(NOT_FOUND);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['addCheckpoint', () => addCheckpoint(BUILD, 'Level 40', 40)],
    ['renameCheckpoint', () => renameCheckpoint(CP_A, 'x')],
    ['deleteCheckpoint', () => deleteCheckpoint(CP_A)],
    ['reorderCheckpoints', () => reorderCheckpoints(BUILD, [CP_A])],
  ] as Array<[string, () => Promise<unknown>]>)('%s re-checks the session and writes nothing when signed out', async (_name, run) => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    expect(await run()).toEqual(NOT_FOUND);
    expect(writes()).toHaveLength(0);
  });
});

describe('addCheckpoint', () => {
  it('rejects an empty or over-long name, and an out-of-range level', async () => {
    expect(await addCheckpoint(BUILD, '   ', 40)).toEqual({ ok: false, error: 'Name cannot be empty.' });
    expect(await addCheckpoint(BUILD, 'x'.repeat(81), 40)).toEqual({ ok: false, error: 'Name must be 80 characters or fewer.' });
    expect(await addCheckpoint(BUILD, 'Level 0', 0)).toEqual({ ok: false, error: 'Level must be between 1 and 100.' });
    expect(await addCheckpoint(BUILD, 'Level 101', 101)).toEqual({ ok: false, error: 'Level must be between 1 and 100.' });
    expect(writes()).toHaveLength(0);
  });

  it('answers not-found when the build is not ours, without inserting', async () => {
    results['builds:select:id'] = { data: null, error: null };
    expect(await addCheckpoint(BUILD, 'Level 40', 40)).toEqual(NOT_FOUND);
    expect(writes()).toHaveLength(0);
  });

  it('checks ownership against the signed-in user, not just the id', async () => {
    await addCheckpoint(BUILD, 'Level 40', 40);
    const ownership = calls.find((c) => c.table === 'builds' && c.op === 'select');
    expect(ownership?.filters).toContainEqual(['id', BUILD]);
    expect(ownership?.filters).toContainEqual(['user_id', USER]);
  });

  it('appends after the highest existing position, not after the count', async () => {
    // Positions 0 and 2 after a delete: count would say 2 and collide.
    results['build_checkpoints:select:position'] = { data: { position: 2 }, error: null };
    await addCheckpoint(BUILD, 'Level 40', 40);
    const insert = calls.find((c) => c.op === 'insert');
    expect((insert?.arg as Record<string, unknown>).position).toBe(3);
  });

  it('copies tree, gear and gems from the checkpoint it was made from', async () => {
    const res = await addCheckpoint(BUILD, 'Level 40', 40, CP_A);

    const source = calls.find((c) => c.op === 'select' && String(c.arg).includes('passive_state'));
    // Scoped to this build: a source id from another of your builds is not a copy source.
    expect(source?.filters).toContainEqual(['id', CP_A]);
    expect(source?.filters).toContainEqual(['build_id', BUILD]);

    const payload = calls.find((c) => c.op === 'insert')?.arg as Record<string, unknown>;
    expect(payload).toMatchObject({
      build_id: BUILD,
      name: 'Level 40',
      level: 40,
      passive_state: { set1: [9], set2: [], ascendancyNodes: [] },
      gear_state: { head: null },
      gem_state: { loadouts: [] },
    });
    expect(res).toEqual({ ok: true, id: CP_B });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('answers not-found when the copy source is not in this build, without inserting', async () => {
    results['build_checkpoints:select:passive_state, gear_state, gem_state'] = { data: null, error: null };
    expect(await addCheckpoint(BUILD, 'Level 40', 40, CP_A)).toEqual(NOT_FOUND);
    expect(writes()).toHaveLength(0);
  });

  it('starts empty when there is no copy source', async () => {
    await addCheckpoint(BUILD, 'Level 1', 1);
    const payload = calls.find((c) => c.op === 'insert')?.arg as Record<string, unknown>;
    expect(payload.passive_state).toEqual({ set1: [], set2: [], ascendancyNodes: [] });
    expect('gear_state' in payload).toBe(false);
    expect('gem_state' in payload).toBe(false);
  });

  it('reports a clash on position as retryable rather than leaking the error', async () => {
    // Two adds racing for the same position: the deferred unique constraint
    // rejects the second at commit.
    results['build_checkpoints:insert'] = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "build_checkpoints_position_unique"' } };
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(await addCheckpoint(BUILD, 'Level 40', 40)).toEqual({ ok: false, error: 'Another change landed at the same time. Try again.' });
    expect(refreshMock).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });
});

describe('renameCheckpoint', () => {
  it('trims and writes the name, scoped by id, then refreshes', async () => {
    expect(await renameCheckpoint(CP_A, '  Endgame  ')).toEqual({ ok: true });
    const update = calls.find((c) => c.op === 'update');
    expect(update?.arg).toEqual({ name: 'Endgame' });
    expect(update?.filters).toContainEqual(['id', CP_A]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('answers not-found when RLS matches no row', async () => {
    results['build_checkpoints:update'] = { data: [], error: null };
    expect(await renameCheckpoint(CP_A, 'Endgame')).toEqual(NOT_FOUND);
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('rejects an empty name before writing', async () => {
    expect(await renameCheckpoint(CP_A, '  ')).toEqual({ ok: false, error: 'Name cannot be empty.' });
    expect(writes()).toHaveLength(0);
  });
});

describe('deleteCheckpoint', () => {
  it('deletes by id and refreshes', async () => {
    expect(await deleteCheckpoint(CP_A)).toEqual({ ok: true });
    expect(calls.find((c) => c.op === 'delete')?.filters).toContainEqual(['id', CP_A]);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("explains the database's refusal to delete the last checkpoint", async () => {
    // Raised by the prevent_deleting_last_checkpoint trigger, errcode 23514.
    results['build_checkpoints:delete'] = { data: null, error: { code: '23514', message: 'a build must keep at least one checkpoint' } };
    expect(await deleteCheckpoint(CP_A)).toEqual({ ok: false, error: 'A build must keep at least one checkpoint.' });
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it('answers not-found when RLS matches no row', async () => {
    results['build_checkpoints:delete'] = { data: [], error: null };
    expect(await deleteCheckpoint(CP_A)).toEqual(NOT_FOUND);
  });
});

describe('reorderCheckpoints', () => {
  it('passes the whole order to the database function in one call', async () => {
    expect(await reorderCheckpoints(BUILD, [CP_B, CP_A])).toEqual({ ok: true });
    const rpc = calls.find((c) => c.table === 'rpc');
    expect(rpc?.op).toBe('reorder_build_checkpoints');
    expect(rpc?.arg).toEqual({ p_build_id: BUILD, p_ids: [CP_B, CP_A] });
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a malformed or empty id list before calling the database', async () => {
    expect(await reorderCheckpoints(BUILD, [])).toEqual({ ok: false, error: 'That order is not valid.' });
    expect(await reorderCheckpoints(BUILD, [CP_A, 'nope'])).toEqual({ ok: false, error: 'That order is not valid.' });
    expect(await reorderCheckpoints(BUILD, 'nope' as unknown as string[])).toEqual({ ok: false, error: 'That order is not valid.' });
    expect(calls).toHaveLength(0);
  });

  it("reports the function's own refusal without leaking its message", async () => {
    // 22023: a partial list, a duplicate, an id from another build, or a build
    // that is not ours — the function refuses all four the same way.
    results['rpc:reorder_build_checkpoints'] = { data: null, error: { code: '22023', message: 'reorder must list every checkpoint of the build exactly once' } };
    expect(await reorderCheckpoints(BUILD, [CP_A])).toEqual({ ok: false, error: 'That order is not valid.' });
    expect(refreshMock).not.toHaveBeenCalled();
  });
});
