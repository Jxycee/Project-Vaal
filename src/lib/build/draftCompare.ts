// src/lib/build/draftCompare.ts
// Is a restored draft actually different from what's already on the page?
//
// Without this, EVERY visit to a saved build shows a bogus "unsaved changes"
// prompt: PassiveTree's mount effect reports its freshly-seeded state
// upward, TreeBuildSession's draft-save effect writes that straight into
// localStorage, and the next load-check finds a draft that is byte-for-byte
// what the build itself already holds. A pure comparison, run once against
// the draft read at mount, is what tells "genuinely unsaved work" apart from
// "the draft is just an echo of the build".
//
// Covers all three pieces of a `BuildDraftState` — tree, gear and gems. A
// gear- or gem-only edit (no tree change) must still be reported as a
// difference, or the restore prompt never fires and that work vanishes
// silently on refresh with no warning at all.
import { toPassiveState } from '@/lib/build/passiveState';
import type { SavedBuild } from '@/lib/build/types';
import type { BuildDraftState } from '@/lib/build/draft';
import { GEAR_SLOTS } from '@/lib/build/gearSlots';
import type { GearItem } from '@/lib/build/gearSlots';
import { parseGearState, type GearState } from '@/lib/build/gearState';
import { parseGemState, type GemLoadout, type GemState } from '@/lib/build/gemState';

function sortedNumbers(nums: number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}

// Array order is not meaningful for any of these sets, and the
// draft<->passive_state converters (toPassiveState/fromPassiveState) make no
// ordering guarantee — so a raw index-by-index comparison would report a
// difference that isn't one. Sort numerically first.
function sameNumberSet(a: number[], b: number[]): boolean {
  const sa = sortedNumbers(a);
  const sb = sortedNumbers(b);
  if (sa.length !== sb.length) return false;
  return sa.every((n, i) => n === sb[i]);
}

function gearItemEqual(a: GearItem | null, b: GearItem | null): boolean {
  if (a === null || b === null) return a === b;
  return (
    a.slug === b.slug &&
    a.name === b.name &&
    a.category === b.category &&
    a.isUnique === b.isUnique &&
    a.iconUrl === b.iconUrl
  );
}

function gearItemListEqual(a: readonly GearItem[], b: readonly GearItem[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((item, i) => gearItemEqual(item, b[i]));
}

function gearIsEmpty(gear: GearState): boolean {
  return GEAR_SLOTS.every((slot) => gear[slot] === null) && Object.keys(gear.jewels).length === 0;
}

function gearStateEqual(a: GearState, b: GearState): boolean {
  for (const slot of GEAR_SLOTS) {
    if (!gearItemEqual(a[slot], b[slot])) return false;
  }
  const aJewelKeys = Object.keys(a.jewels);
  const bJewelKeys = Object.keys(b.jewels);
  if (aJewelKeys.length !== bJewelKeys.length) return false;
  return aJewelKeys.every((key) => key in b.jewels && gearItemEqual(a.jewels[key], b.jewels[key]));
}

function loadoutEqual(a: GemLoadout, b: GemLoadout): boolean {
  return (
    a.id === b.id &&
    gearItemEqual(a.skill, b.skill) &&
    gearItemListEqual(a.supports, b.supports) &&
    a.sets.length === b.sets.length &&
    a.sets.every((n, i) => n === b.sets[i])
  );
}

function gemIsEmpty(gem: GemState): boolean {
  return gem.loadouts.length === 0;
}

function gemStateEqual(a: GemState, b: GemState): boolean {
  if (a.primaryId !== b.primaryId) return false;
  if (a.loadouts.length !== b.loadouts.length) return false;
  return a.loadouts.every((loadout, i) => loadoutEqual(loadout, b.loadouts[i]));
}

export function draftDiffersFrom(
  draft: BuildDraftState,
  build: Pick<SavedBuild, 'class' | 'ascendancy' | 'passive_state' | 'gear_state' | 'gem_state'> | null,
): boolean {
  if (build === null) {
    // Scratch mode: an untouched session (nothing allocated, no gear, no
    // gems) has nothing worth restoring, and must not prompt.
    return (
      draft.tree.main.allocated.length > 0 ||
      draft.tree.ascendancyNodes.length > 0 ||
      !gearIsEmpty(draft.gear) ||
      !gemIsEmpty(draft.gem)
    );
  }

  if (draft.tree.className !== build.class) return true;
  if ((draft.tree.ascendancyId ?? null) !== build.ascendancy) return true;

  const draftState = toPassiveState(draft.tree.main, draft.tree.ascendancyNodes);
  const savedState = build.passive_state;

  if (
    !sameNumberSet(draftState.set1, savedState.set1) ||
    !sameNumberSet(draftState.set2, savedState.set2) ||
    !sameNumberSet(draftState.ascendancyNodes, savedState.ascendancyNodes)
  ) {
    return true;
  }

  if (!gearStateEqual(draft.gear, parseGearState(build.gear_state))) return true;
  if (!gemStateEqual(draft.gem, parseGemState(build.gem_state))) return true;

  return false;
}
