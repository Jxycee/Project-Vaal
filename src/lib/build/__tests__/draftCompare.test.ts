import { describe, it, expect } from 'vitest';
import { draftDiffersFrom } from '@/lib/build/draftCompare';
import type { BuildEditorState, SavedBuild } from '@/lib/build/types';
import type { BuildDraftState } from '@/lib/build/draft';
import { emptyGearState } from '@/lib/build/gearState';
import { emptyGemState } from '@/lib/build/gemState';
import type { GearItem } from '@/lib/build/gearSlots';
import type { GemState } from '@/lib/build/gemState';

type SavedBuildSlice = Pick<SavedBuild, 'class' | 'ascendancy' | 'passive_state' | 'gear_state' | 'gem_state'>;

const boots: GearItem = {
  slug: 'boots-of-the-ondar',
  name: 'Boots of the Ondar',
  category: 'Boots',
  isUnique: true,
  iconUrl: null,
};

const fireball: GearItem = {
  slug: 'fireball',
  name: 'Fireball',
  category: 'Active Skill Gem',
  isUnique: false,
  iconUrl: null,
};

const savedGear = { ...emptyGearState(), boots };
const savedGem: GemState = {
  loadouts: [{ id: 'loadout-1', skill: fireball, supports: [], sets: [1, 2], level: 1, quality: 0 }],
  primaryId: 'loadout-1',
};

const savedBuild: SavedBuildSlice = {
  class: 'Witch',
  ascendancy: 'Lich',
  passive_state: { set1: [1, 2, 3], set2: [1, 2], ascendancyNodes: [40, 41] },
  gear_state: savedGear,
  gem_state: savedGem,
};

// Draft that round-trips to exactly savedBuild's passive_state:
// - node 3 is set1-only, nodes 1/2 are shared (both sets).
const matchingTree: BuildEditorState = {
  classId: 2,
  className: 'Witch',
  ascendancyId: 'Lich',
  main: { allocated: [1, 2, 3], weaponSets: { 3: 1 } },
  ascendancyNodes: [40, 41],
};

const matchingDraft: BuildDraftState = {
  tree: matchingTree,
  gear: savedGear,
  gem: savedGem,
};

describe('draftDiffersFrom — saved build', () => {
  it('returns false for an identical round-trip (tree, gear and gems all match)', () => {
    expect(draftDiffersFrom(matchingDraft, savedBuild)).toBe(false);
  });

  it('returns true when a single extra node is allocated', () => {
    const draft: BuildDraftState = {
      ...matchingDraft,
      tree: { ...matchingTree, main: { allocated: [1, 2, 3, 4], weaponSets: { 3: 1 } } },
    };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('returns false when arrays are merely reordered', () => {
    const reordered: SavedBuildSlice = {
      ...savedBuild,
      passive_state: { set1: [3, 1, 2], set2: [2, 1], ascendancyNodes: [41, 40] },
    };
    expect(draftDiffersFrom(matchingDraft, reordered)).toBe(false);
  });

  it('returns true when the class differs', () => {
    const draft: BuildDraftState = { ...matchingDraft, tree: { ...matchingTree, className: 'Ranger' } };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('returns true when the ascendancy differs', () => {
    const draft: BuildDraftState = { ...matchingDraft, tree: { ...matchingTree, ascendancyId: 'Abyssal Lich' } };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('treats a draft ascendancyId of undefined as null', () => {
    const noAscendancyBuild: SavedBuildSlice = {
      class: 'Witch',
      ascendancy: null,
      passive_state: { set1: [], set2: [], ascendancyNodes: [] },
      gear_state: emptyGearState(),
      gem_state: emptyGemState(),
    };
    const draft: BuildDraftState = {
      tree: {
        classId: 2,
        className: 'Witch',
        ascendancyId: undefined,
        main: { allocated: [], weaponSets: {} },
        ascendancyNodes: [],
      },
      gear: emptyGearState(),
      gem: emptyGemState(),
    };
    expect(draftDiffersFrom(draft, noAscendancyBuild)).toBe(false);
  });

  it('returns true for a gear-only change (tree and gems unchanged)', () => {
    const draft: BuildDraftState = { ...matchingDraft, gear: { ...savedGear, head: boots } };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('returns true for a gem-only change (tree and gear unchanged)', () => {
    const draft: BuildDraftState = {
      ...matchingDraft,
      gem: { loadouts: [...savedGem.loadouts, { id: 'loadout-2', skill: null, supports: [], sets: [1, 2], level: 1, quality: 0 }], primaryId: 'loadout-1' },
    };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('returns true when only a gem level changes', () => {
    const draft: BuildDraftState = {
      ...matchingDraft,
      gem: { ...savedGem, loadouts: savedGem.loadouts.map((l) => ({ ...l, level: 20 })) },
    };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('returns true when only a gem quality changes', () => {
    const draft: BuildDraftState = {
      ...matchingDraft,
      gem: { ...savedGem, loadouts: savedGem.loadouts.map((l) => ({ ...l, quality: 20 })) },
    };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  // Slice 5: an attribute choice is part of the tree, and a choice-only edit
  // must still prompt — otherwise the restore offer silently loses it.
  it('returns true when only an attribute choice differs', () => {
    const draft = { ...matchingDraft, tree: { ...matchingTree, attributeChoices: { 1: 'dex' as const } } };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });

  it('returns false when the attribute choices match the saved ones', () => {
    const draft = { ...matchingDraft, tree: { ...matchingTree, attributeChoices: { 1: 'dex' as const } } };
    const saved = { ...savedBuild, passive_state: { ...savedBuild.passive_state, attributeChoices: { '1': 'dex' as const } } };
    expect(draftDiffersFrom(draft, saved)).toBe(false);
  });

  it('returns true when a jewel is added with no other change', () => {
    const draft: BuildDraftState = {
      ...matchingDraft,
      gear: { ...savedGear, jewels: { ...savedGear.jewels, '123': boots } },
    };
    expect(draftDiffersFrom(draft, savedBuild)).toBe(true);
  });
});

describe('draftDiffersFrom — scratch mode (build === null)', () => {
  it('returns false for an empty scratch draft', () => {
    const draft: BuildDraftState = {
      tree: {
        classId: 0,
        className: 'Witch',
        ascendancyId: undefined,
        main: { allocated: [], weaponSets: {} },
        ascendancyNodes: [],
      },
      gear: emptyGearState(),
      gem: emptyGemState(),
    };
    expect(draftDiffersFrom(draft, null)).toBe(false);
  });

  it('returns true when anything is allocated in the main tree', () => {
    const draft: BuildDraftState = {
      tree: {
        classId: 0,
        className: 'Witch',
        ascendancyId: undefined,
        main: { allocated: [1], weaponSets: {} },
        ascendancyNodes: [],
      },
      gear: emptyGearState(),
      gem: emptyGemState(),
    };
    expect(draftDiffersFrom(draft, null)).toBe(true);
  });

  it('returns true when anything is allocated in ascendancy nodes', () => {
    const draft: BuildDraftState = {
      tree: {
        classId: 0,
        className: 'Witch',
        ascendancyId: 'Lich',
        main: { allocated: [], weaponSets: {} },
        ascendancyNodes: [40],
      },
      gear: emptyGearState(),
      gem: emptyGemState(),
    };
    expect(draftDiffersFrom(draft, null)).toBe(true);
  });

  it('returns true when gear alone is picked, tree untouched', () => {
    const draft: BuildDraftState = {
      tree: {
        classId: 0,
        className: 'Witch',
        ascendancyId: undefined,
        main: { allocated: [], weaponSets: {} },
        ascendancyNodes: [],
      },
      gear: { ...emptyGearState(), boots },
      gem: emptyGemState(),
    };
    expect(draftDiffersFrom(draft, null)).toBe(true);
  });

  it('returns true when a gem loadout alone is added, tree untouched', () => {
    const draft: BuildDraftState = {
      tree: {
        classId: 0,
        className: 'Witch',
        ascendancyId: undefined,
        main: { allocated: [], weaponSets: {} },
        ascendancyNodes: [],
      },
      gear: emptyGearState(),
      gem: { loadouts: [{ id: 'loadout-1', skill: null, supports: [], sets: [1, 2], level: 1, quality: 0 }], primaryId: null },
    };
    expect(draftDiffersFrom(draft, null)).toBe(true);
  });
});
