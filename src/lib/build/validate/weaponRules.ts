// src/lib/build/validate/weaponRules.ts
// =============================================================================
// Which off-hand a weapon set's main hand allows. The rule is PoB2's
// (src/Classes/ItemsTab.lua, ItemsTabClass:IsItemValidForSlot, "Weapon 2"),
// restated over our categories — see the rule table in
// plans/2026-09-24-slice3-structural-validation.md. Path of Building
// Community is MIT-licensed, Copyright (c) 2016 David Gowor; see
// THIRD-PARTY-NOTICES.md.
//
// Pure and per set: a two-hander fills both hands of ITS set only. The other
// set is free, because the game swaps weapon sets by skill.
// =============================================================================

import type { WeaponSet } from '@poe2-toolkit/tree-core';
import { categoriesForSlot, type GearItem, type GearSlot } from '../gearSlots';
import type { GearState } from '../gearState';
import type { PassiveState } from '../types';
import { handednessOf } from './handedness';
import { keystonesFor, type Keystones } from './keystones';
import type { BuildWarning } from './types';

/** Off-hands any unarmed or one-handed main hand may carry. Buckler is PoB2's `type = "Shield"`. */
const PLAIN_OFF_HANDS = new Set(['Shield', 'Buckler', 'Focus', 'Focii', 'Sceptre']);
const FOCUS = new Set(['Focus', 'Focii']);
/** The main hands Giant's Blood applies to (PoB2: `tags.axe or tags.mace or tags.sword`). */
const AXE_MACE_SWORD = new Set(['One Hand Sword', 'One Hand Axe', 'One Hand Mace', 'Mace', 'Two Hand Sword', 'Two Hand Axe', 'Two Hand Mace']);
const GIANTS_BLOOD_OFF_HANDS = new Set(['Two Hand Sword', 'Two Hand Axe', 'Two Hand Mace']);
/** Main hands that can never dual wield (PoB2: `weapon1Base.type ~= "Wand" and ~= "Sceptre"`). */
const NO_DUAL_WIELD_MAIN = new Set(['Wand', 'Sceptre']);

function slotsOf(set: WeaponSet): { main: GearSlot; off: GearSlot } {
  return set === 1 ? { main: 'weapon1_main', off: 'weapon1_off' } : { main: 'weapon2_main', off: 'weapon2_off' };
}

function fits(slot: GearSlot, item: GearItem): boolean {
  return categoriesForSlot(slot).includes(item.category);
}

/** Main hands that count as "one hand free": nothing, a one-hander, a unique mace (unknown), or Giant's Blood's two-handers. */
function leavesHandFree(main: GearItem | null, keys: Keystones): boolean {
  if (!main) return true;
  if (handednessOf(main.category) !== 'two') return true;
  return keys.giantsBlood && AXE_MACE_SWORD.has(main.category);
}

/**
 * The two-hander filling this set's off-hand, when no off-hand item could be
 * legal beside it — so an empty off-hand can read "Occupied by …", as the
 * game draws it. Null whenever something could legally go there.
 */
export function offHandOccupiedBy(gear: GearState, passive: PassiveState, set: WeaponSet): GearItem | null {
  const main = gear[slotsOf(set).main];
  if (!main || !fits(slotsOf(set).main, main)) return null;
  const keys = keystonesFor(passive, set);
  if (leavesHandFree(main, keys)) return null;
  if (main.category === 'Bow') return null; // a quiver
  if (main.category === 'Talisman' && keys.lordOfTheWilds) return null;
  if (main.category === 'Staff' && keys.instrumentsOfPower) return null;
  return main;
}

function checkPair(main: GearItem | null, off: GearItem, keys: Keystones): Omit<BuildWarning, 'target'> | null {
  const occupied = (why: string): Omit<BuildWarning, 'target'> => ({
    code: 'two-handed-occupied',
    severity: 'warning',
    message: `${main!.name} is two-handed${why}, so ${off.name} cannot be equipped beside it.`,
  });

  if (off.category === 'Quiver') {
    return main?.category === 'Bow'
      ? null
      : { code: 'quiver-needs-bow', severity: 'warning', message: `${off.name} is a quiver, which needs a bow in the main hand.` };
  }
  if (main?.category === 'Bow') return occupied(' (only a quiver can go beside a bow)');
  if (main?.category === 'Talisman' && keys.lordOfTheWilds) {
    return off.category === 'Sceptre' && !off.isUnique ? null : occupied(' (Lord of the Wilds allows only a non-unique Sceptre)');
  }
  if (main?.category === 'Staff' && keys.instrumentsOfPower) {
    return FOCUS.has(off.category) ? null : occupied(' (Instruments of Power allows only a Focus)');
  }
  if (!leavesHandFree(main, keys)) return occupied('');

  if (PLAIN_OFF_HANDS.has(off.category)) return null;
  const giantsBlood = keys.giantsBlood && main !== null && AXE_MACE_SWORD.has(main.category);
  if (GIANTS_BLOOD_OFF_HANDS.has(off.category)) {
    return giantsBlood
      ? null
      : { code: 'offhand-not-allowed', severity: 'warning', message: `${off.name} is two-handed; only Giant's Blood with an axe, mace or sword lets it into the off-hand.` };
  }
  // What remains is a one-handed weapon (or a unique mace): dual wielding.
  if (main && NO_DUAL_WIELD_MAIN.has(main.category)) {
    return { code: 'offhand-not-allowed', severity: 'warning', message: `A ${main.category} main hand cannot dual wield, so ${off.name} cannot go in the off-hand.` };
  }
  return null;
}

/**
 * Pairing warnings for both weapon sets, each targeted at the off-hand slot.
 * A slot holding a category it never takes is left to the slot-category
 * check, so one bad item never produces two warnings.
 */
export function validateWeapons(gear: GearState, passive: PassiveState): BuildWarning[] {
  const warnings: BuildWarning[] = [];
  for (const set of [1, 2] as const) {
    const slots = slotsOf(set);
    const main = gear[slots.main];
    const off = gear[slots.off];
    if (!off || !fits(slots.off, off)) continue;
    if (main && !fits(slots.main, main)) continue;

    const target = { kind: 'gear', slot: slots.off } as const;
    const found = checkPair(main, off, keystonesFor(passive, set));
    if (found) warnings.push({ ...found, target });

    const unknownMain = main && handednessOf(main.category) === 'unknown';
    const unknownOff = handednessOf(off.category) === 'unknown' && off.category === 'Mace';
    if (!found && (unknownMain || unknownOff)) {
      const which = unknownMain ? main! : off;
      warnings.push({
        code: 'handedness-unknown',
        severity: 'note',
        target,
        message: `${which.name} is a unique mace; our data does not say whether it is one- or two-handed, so this pairing was not checked.`,
      });
    }
  }
  return warnings;
}
