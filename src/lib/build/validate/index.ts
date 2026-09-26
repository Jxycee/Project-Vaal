// src/lib/build/validate/index.ts
// =============================================================================
// Structural validation of one checkpoint (Slice 3, competitor gap #2): pure
// checks that need no stat formulas. Every result is a signal — nothing here
// blocks a pick or a save. See plans/2026-09-24-slice3-structural-validation.md.
//
// The tree checks re-state caps the editor already enforces while TOGGLING
// (tree-core's weapon-set pool, PassiveTree's ascendancy cap), because seeding
// a stored state — an import, an older row — never passes through a toggle.
// The level-derived basic budget is already signalled in TreeControls and is
// not repeated here.
// =============================================================================

import { MAX_ASCENDANCY_POINTS, MAX_WEAPON_SET_POINTS } from '../constants';
import { GEAR_SLOTS, GEAR_SLOT_LABELS, categoriesForSlot } from '../gearSlots';
import type { GearState } from '../gearState';
import type { PassiveState } from '../types';
import type { BuildWarning } from './types';
import { validateCrafts, type CraftData } from './affixRules';
import { validateWeapons } from './weaponRules';

export type { BuildWarning, WarningCode, WarningTarget } from './types';
export { offHandOccupiedBy } from './weaponRules';
export { reservedSpirit, type ReservedSpirit, type ScalingEntry } from './reservation';
export { socketLimitFor, type BaseData, type CraftData, type ModData } from './affixRules';

// PoB2 caps weapon-set points lower before the campaign ends; that depends on
// campaign progress. The endgame total lives in ../constants.
export { MAX_WEAPON_SET_POINTS };

function treeWarnings(passive: PassiveState): BuildWarning[] {
  const warnings: BuildWarning[] = [];
  const inSet1 = new Set(passive.set1);
  const inSet2 = new Set(passive.set2);
  // A node in both sets is shared; a node in only one was painted into it.
  const only = { 'Set I': passive.set1.filter((n) => !inSet2.has(n)).length, 'Set II': passive.set2.filter((n) => !inSet1.has(n)).length };
  for (const [label, count] of Object.entries(only)) {
    if (count > MAX_WEAPON_SET_POINTS) {
      warnings.push({
        code: 'weapon-set-points-over',
        severity: 'warning',
        target: { kind: 'tree' },
        message: `${label} has ${count} weapon-set passives allocated; the campaign grants at most ${MAX_WEAPON_SET_POINTS}.`,
      });
    }
  }
  if (passive.ascendancyNodes.length > MAX_ASCENDANCY_POINTS) {
    warnings.push({
      code: 'ascendancy-points-over',
      severity: 'warning',
      target: { kind: 'tree' },
      message: `${passive.ascendancyNodes.length} ascendancy points allocated; a character has at most ${MAX_ASCENDANCY_POINTS}.`,
    });
  }
  return warnings;
}

function slotMismatches(gear: GearState): BuildWarning[] {
  const warnings: BuildWarning[] = [];
  for (const slot of GEAR_SLOTS) {
    const item = gear[slot];
    if (item && !categoriesForSlot(slot).includes(item.category)) {
      warnings.push({
        code: 'slot-category-mismatch',
        severity: 'warning',
        target: { kind: 'gear', slot },
        message: `${item.name} (${item.category}) cannot be equipped as ${GEAR_SLOT_LABELS[slot]}.`,
      });
    }
  }
  return warnings;
}

/**
 * Every structural warning for one checkpoint: tree first, then gear in slot
 * order, then jewels. Craft checks (Slice 4) run only when `craftData` is
 * passed — the editor loads it lazily, and a caller without it gets exactly
 * the Slice 3 checks.
 */
export function validateCheckpoint({
  passive,
  gear,
  craftData,
}: {
  passive: PassiveState;
  gear: GearState;
  craftData?: CraftData;
}): BuildWarning[] {
  const slotIndex = (w: BuildWarning) =>
    w.target.kind === 'gear' ? GEAR_SLOTS.indexOf(w.target.slot) : w.target.kind === 'jewel' ? GEAR_SLOTS.length : -1;
  const gearWarnings = [...slotMismatches(gear), ...validateWeapons(gear, passive), ...(craftData ? validateCrafts(gear, craftData) : [])];
  // Array.prototype.sort is stable, so warnings on one slot keep their order.
  gearWarnings.sort((a, b) => slotIndex(a) - slotIndex(b));
  return [...treeWarnings(passive), ...gearWarnings];
}
