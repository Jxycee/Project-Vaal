import { describe, it, expect } from 'vitest';
import { toPassiveState, fromPassiveState } from '@/lib/build/passiveState';
import type { WeaponSetAllocation } from '@poe2-toolkit/tree-core';

describe('toPassiveState', () => {
  it('puts an untagged node in both sets', () => {
    const main: WeaponSetAllocation = { allocated: [10], weaponSets: {} };
    expect(toPassiveState(main, [])).toEqual({
      set1: [10],
      set2: [10],
      ascendancyNodes: [],
    });
  });

  it('puts a set-1 node in set1 only', () => {
    const main: WeaponSetAllocation = { allocated: [10], weaponSets: { 10: 1 } };
    expect(toPassiveState(main, [])).toEqual({
      set1: [10],
      set2: [],
      ascendancyNodes: [],
    });
  });

  it('puts a set-2 node in set2 only', () => {
    const main: WeaponSetAllocation = { allocated: [10], weaponSets: { 10: 2 } };
    expect(toPassiveState(main, [])).toEqual({
      set1: [],
      set2: [10],
      ascendancyNodes: [],
    });
  });

  it('keeps ascendancy nodes in their own list', () => {
    const main: WeaponSetAllocation = { allocated: [], weaponSets: {} };
    expect(toPassiveState(main, [7, 8])).toEqual({
      set1: [],
      set2: [],
      ascendancyNodes: [7, 8],
    });
  });

  it('handles a mixed allocation', () => {
    const main: WeaponSetAllocation = {
      allocated: [1, 2, 3],
      weaponSets: { 2: 1, 3: 2 },
    };
    expect(toPassiveState(main, [99])).toEqual({
      set1: [1, 2],
      set2: [1, 3],
      ascendancyNodes: [99],
    });
  });
});

describe('fromPassiveState', () => {
  it('treats a node in both sets as untagged', () => {
    const result = fromPassiveState({ set1: [10], set2: [10], ascendancyNodes: [] });
    expect(result.main.allocated).toEqual([10]);
    expect(result.main.weaponSets).toEqual({});
  });

  it('treats a set1-only node as tagged 1', () => {
    const result = fromPassiveState({ set1: [10], set2: [], ascendancyNodes: [] });
    expect(result.main.weaponSets).toEqual({ 10: 1 });
  });

  it('treats a set2-only node as tagged 2', () => {
    const result = fromPassiveState({ set1: [], set2: [10], ascendancyNodes: [] });
    expect(result.main.weaponSets).toEqual({ 10: 2 });
  });

  it('tolerates a missing ascendancyNodes key from the stale column default', () => {
    const legacy = { set1: [1], set2: [1] } as unknown as {
      set1: number[];
      set2: number[];
      ascendancyNodes: number[];
    };
    expect(fromPassiveState(legacy).ascendancyNodes).toEqual([]);
  });
});

describe('round trip', () => {
  it('survives a mixed allocation unchanged', () => {
    const main: WeaponSetAllocation = {
      allocated: [1, 2, 3, 4],
      weaponSets: { 2: 1, 3: 2 },
    };
    const ascendancyNodes = [50, 51];
    const back = fromPassiveState(toPassiveState(main, ascendancyNodes));
    expect([...back.main.allocated].sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
    expect(back.main.weaponSets).toEqual({ 2: 1, 3: 2 });
    expect(back.ascendancyNodes).toEqual(ascendancyNodes);
  });
});
