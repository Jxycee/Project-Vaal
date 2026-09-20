import { describe, it, expect } from 'vitest';
import { draftDiffersFrom } from '@/lib/build/draftCompare';
import type { BuildEditorState, SavedBuild } from '@/lib/build/types';

const savedBuild: Pick<SavedBuild, 'class' | 'ascendancy' | 'passive_state'> = {
  class: 'Witch',
  ascendancy: 'Lich',
  passive_state: { set1: [1, 2, 3], set2: [1, 2], ascendancyNodes: [40, 41] },
};

// Draft that round-trips to exactly savedBuild's passive_state:
// - node 3 is set1-only, nodes 1/2 are shared (both sets).
const matchingDraft: BuildEditorState = {
  classId: 2,
  className: 'Witch',
  ascendancyId: 'Lich',
  main: { allocated: [1, 2, 3], weaponSets: { 3: 1 } },
  ascendancyNodes: [40, 41],
};

describe('draftDiffersFrom — saved build', () => {
  it('returns false for an identical round-trip', () => {
    expect(draftDiffersFrom(matchingDraft, savedBuild)).toBe(false);
  });

  it('returns true when a single extra node is allocated', () => {
    const draft: BuildEditorState = {
      ...matchingDraft,
      main: { allocated: [1, 2, 3, 4], weaponSets: { 3: 1 } },
    };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('returns false when arrays are merely reordered', () => {
    const reordered: Pick<SavedBuild, 'class' | 'ascendancy' | 'passive_state'> = {
      ...savedBuild,
      passive_state: { set1: [3, 1, 2], set2: [2, 1], ascendancyNodes: [41, 40] },
    };
    expect(draftDiffersFrom(matchingDraft, reordered)).toBe(false);
  });

  it('returns true when the class differs', () => {
    const draft: BuildEditorState = { ...matchingDraft, className: 'Ranger' };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('returns true when the ascendancy differs', () => {
    const draft: BuildEditorState = { ...matchingDraft, ascendancyId: 'Abyssal Lich' };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('treats a draft ascendancyId of undefined as null', () => {
    const noAscendancyBuild: Pick<SavedBuild, 'class' | 'ascendancy' | 'passive_state'> = {
      class: 'Witch',
      ascendancy: null,
      passive_state: { set1: [], set2: [], ascendancyNodes: [] },
    };
    const draft: BuildEditorState = {
      classId: 2,
      className: 'Witch',
      ascendancyId: undefined,
      main: { allocated: [], weaponSets: {} },
      ascendancyNodes: [],
    };
    expect(draftDiffersFrom(draft, noAscendancyBuild)).toBe(false);
  });
});

describe('draftDiffersFrom — scratch mode (build === null)', () => {
  it('returns false for an empty scratch draft', () => {
    const draft: BuildEditorState = {
      classId: 0,
      className: 'Witch',
      ascendancyId: undefined,
      main: { allocated: [], weaponSets: {} },
      ascendancyNodes: [],
    };
    expect(draftDiffersFrom(draft, null)).toBe(false);
  });

  it('returns true when anything is allocated in the main tree', () => {
    const draft: BuildEditorState = {
      classId: 0,
      className: 'Witch',
      ascendancyId: undefined,
      main: { allocated: [1], weaponSets: {} },
      ascendancyNodes: [],
    };
    expect(draftDiffersFrom(draft, null)).toBe(true);
  });

  it('returns true when anything is allocated in ascendancy nodes', () => {
    const draft: BuildEditorState = {
      classId: 0,
      className: 'Witch',
      ascendancyId: 'Lich',
      main: { allocated: [], weaponSets: {} },
      ascendancyNodes: [40],
    };
    expect(draftDiffersFrom(draft, null)).toBe(true);
  });
});
