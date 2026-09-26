import { describe, it, expect } from 'vitest';
import { toPassiveState, fromPassiveState, parsePassiveState } from '@/lib/build/passiveState';
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

// Slice 5: the attribute a generic "+5 to any Attribute" node was set to.
// Stored beside the allocation; absent on every row saved before Slice 5.
describe('attribute choices (Slice 5)', () => {
  const main: WeaponSetAllocation = { allocated: [10, 20], weaponSets: {} };

  it('writes no attributeChoices key when there are none, so the stored shape is unchanged', () => {
    expect(toPassiveState(main, [])).not.toHaveProperty('attributeChoices');
    expect(toPassiveState(main, [], {})).not.toHaveProperty('attributeChoices');
  });

  it('keeps choices for allocated nodes only, keyed as strings', () => {
    expect(toPassiveState(main, [], { 10: 'str', 99: 'dex' }).attributeChoices).toEqual({ '10': 'str' });
  });

  it('reads choices back, and none from an old row', () => {
    expect(parsePassiveState({ set1: [10], set2: [10], ascendancyNodes: [], attributeChoices: { '10': 'int' } }).attributeChoices).toEqual({ '10': 'int' });
    expect(parsePassiveState({ set1: [], set2: [], ascendancyNodes: [] })).not.toHaveProperty('attributeChoices');
  });

  it('drops a malformed choice on its own when reading', () => {
    expect(
      parsePassiveState({ set1: [], set2: [], ascendancyNodes: [], attributeChoices: { '10': 'str', '11': 'luck', abc: 'dex', '12': 5 } }).attributeChoices,
    ).toEqual({ '10': 'str' });
    expect(parsePassiveState({ set1: [], set2: [], ascendancyNodes: [], attributeChoices: 'str' })).not.toHaveProperty('attributeChoices');
  });
});

describe('fromPassiveState — attribute choices (Slice 5)', () => {
  it('hands the editor its choices keyed by number, and {} for an old row', () => {
    expect(fromPassiveState({ set1: [10], set2: [10], ascendancyNodes: [], attributeChoices: { '10': 'str' } }).attributeChoices).toEqual({ 10: 'str' });
    expect(fromPassiveState({ set1: [10], set2: [10], ascendancyNodes: [] }).attributeChoices).toEqual({});
  });

  it('round-trips through toPassiveState unchanged', () => {
    const stored = { set1: [10, 11], set2: [10], ascendancyNodes: [], attributeChoices: { '10': 'int' as const } };
    const { main, ascendancyNodes, attributeChoices } = fromPassiveState(stored);
    expect(toPassiveState(main, ascendancyNodes, attributeChoices)).toEqual(stored);
  });
});
