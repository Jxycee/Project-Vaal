import { describe, expect, it } from 'vitest';
import {
  activeCheckpoint,
  nextPosition,
  parseCheckpoints,
  renumber,
  reorder,
} from '../checkpointState';

const EMPTY = { set1: [], set2: [], ascendancyNodes: [] };

/** A row shaped the way the database actually returns one. */
function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a',
    position: 0,
    name: 'Level 31',
    level: 31,
    passive_state: EMPTY,
    gear_state: {},
    gem_state: {},
    ...overrides,
  };
}

describe('parseCheckpoints', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(parseCheckpoints(null)).toEqual([]);
    expect(parseCheckpoints(undefined)).toEqual([]);
    expect(parseCheckpoints({})).toEqual([]);
    expect(parseCheckpoints('nope')).toEqual([]);
    expect(parseCheckpoints(42)).toEqual([]);
  });

  it('drops a malformed entry without discarding its siblings', () => {
    const parsed = parseCheckpoints([
      row({ id: 'a', position: 0, passive_state: { set1: [1], set2: [1], ascendancyNodes: [] } }),
      { id: 'b', position: 'not-a-number', name: 'Broken', level: 40 },
      row({ id: 'c', position: 2, name: 'Level 94', level: 94 }),
    ]);
    expect(parsed.map((c) => c.id)).toEqual(['a', 'c']);
    expect(parsed[0].passive_state.set1).toEqual([1]);
  });

  it('rejects an entry whose id or name is missing or empty', () => {
    const parsed = parseCheckpoints([
      row({ id: '' }),
      row({ id: 'b', name: '' }),
      row({ id: 'c', name: 'Keeps this one' }),
    ]);
    expect(parsed.map((c) => c.id)).toEqual(['c']);
  });

  it('sorts by position regardless of input order', () => {
    const parsed = parseCheckpoints([
      row({ id: 'b', position: 1, name: 'Two', level: 60 }),
      row({ id: 'a', position: 0, name: 'One', level: 31 }),
    ]);
    expect(parsed.map((c) => c.id)).toEqual(['a', 'b']);
  });

  it('repairs a malformed passive_state rather than dropping the checkpoint', () => {
    // parsePassiveState already falls back to all-empty; a checkpoint whose
    // tree failed to parse is still a checkpoint the user named.
    const parsed = parseCheckpoints([row({ passive_state: 'garbage' })]);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].passive_state).toEqual(EMPTY);
  });

  it('leaves gear_state and gem_state untouched for their own parsers', () => {
    // Mirrors SavedBuild: these stay `unknown` so parseGearState /
    // parseGemState own their validation. Passing them through unvalidated
    // here would mean two sources of truth for the same shape.
    const gear = { head: { slug: 'x', name: 'X', category: 'Helmet', isUnique: false, iconUrl: null } };
    const parsed = parseCheckpoints([row({ gear_state: gear })]);
    expect(parsed[0].gear_state).toBe(gear);
  });
});

describe('activeCheckpoint', () => {
  const list = parseCheckpoints([
    row({ id: 'a', position: 0, name: 'One', level: 31 }),
    row({ id: 'b', position: 1, name: 'Two', level: 94 }),
  ]);

  it('returns the checkpoint whose id matches', () => {
    expect(activeCheckpoint(list, 'b')?.id).toBe('b');
  });

  it('falls back to the first checkpoint when the id is null or unknown', () => {
    // An unknown id is the ordinary case after deleting the active
    // checkpoint, so it must not blank the editor.
    expect(activeCheckpoint(list, null)?.id).toBe('a');
    expect(activeCheckpoint(list, 'deleted-id')?.id).toBe('a');
  });

  it('returns null for an empty list', () => {
    expect(activeCheckpoint([], null)).toBeNull();
    expect(activeCheckpoint([], 'anything')).toBeNull();
  });
});

describe('nextPosition', () => {
  it('returns 0 for an empty list', () => {
    expect(nextPosition([])).toBe(0);
  });

  it('returns one past the highest position, not the length', () => {
    // The distinction matters: (build_id, position) is UNIQUE, so using
    // length after a middle checkpoint is deleted would collide.
    const list = parseCheckpoints([
      row({ id: 'a', position: 0 }),
      row({ id: 'c', position: 7, name: 'Level 94', level: 94 }),
    ]);
    expect(list).toHaveLength(2);
    expect(nextPosition(list)).toBe(8);
  });
});

describe('reorder', () => {
  const three = parseCheckpoints([
    row({ id: 'a', position: 0, name: 'One', level: 31 }),
    row({ id: 'b', position: 1, name: 'Two', level: 60 }),
    row({ id: 'c', position: 2, name: 'Three', level: 94 }),
  ]);

  it('renumbers positions contiguously from zero after a move', () => {
    const moved = reorder(three, 2, 0);
    expect(moved.map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(moved.map((c) => c.position)).toEqual([0, 1, 2]);
  });

  it('moves forward as well as backward', () => {
    expect(reorder(three, 0, 2).map((c) => c.id)).toEqual(['b', 'c', 'a']);
  });

  it('does not mutate its input', () => {
    const before = three.map((c) => c.id);
    reorder(three, 2, 0);
    expect(three.map((c) => c.id)).toEqual(before);
  });

  it('returns the list unchanged for an out-of-range index', () => {
    expect(reorder(three, 5, 0).map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(reorder(three, 0, -1).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('renumber', () => {
  it('closes the gap left by a deleted checkpoint', () => {
    // Deleting position 1 of 0,1,2 leaves 0,2. Persisting that is legal —
    // the constraint is uniqueness, not contiguity — but it makes
    // nextPosition grow without bound, so the UI renumbers after a delete.
    const withGap = parseCheckpoints([
      row({ id: 'a', position: 0 }),
      row({ id: 'c', position: 2, name: 'Level 94', level: 94 }),
    ]);
    expect(renumber(withGap).map((c) => c.position)).toEqual([0, 1]);
  });

  it('is a no-op on an already contiguous list', () => {
    const list = parseCheckpoints([row({ id: 'a', position: 0 }), row({ id: 'b', position: 1 })]);
    expect(renumber(list).map((c) => c.position)).toEqual([0, 1]);
  });
});
