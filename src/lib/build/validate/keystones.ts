// src/lib/build/validate/keystones.ts
// =============================================================================
// The three passives that relax PoB2's off-hand rule, and whether a weapon
// set has them. Ids are from our 0.5.2 tree (public/data/tree/0.5.2/data.json)
// and pinned by name in __tests__/keystones.test.ts.
// =============================================================================

import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { PassiveState } from '../types';

/** Keystone: "You can wield Two-Handed Axes, Maces and Swords in one hand". */
export const GIANTS_BLOOD = 32349;
/** Keystone: "You can equip a non-Unique Sceptre while wielding a Talisman". */
export const LORD_OF_THE_WILDS = 61942;
/** Ascendancy notable: "You can equip a Focus while wielding a Staff". */
export const INSTRUMENTS_OF_POWER = 20701;

export interface Keystones {
  giantsBlood: boolean;
  instrumentsOfPower: boolean;
  lordOfTheWilds: boolean;
}

/**
 * What one weapon set has allocated. `set1`/`set2` each already include the
 * shared nodes (see PassiveState), so a set's own list is the whole answer
 * for the main tree; ascendancy nodes apply to both sets.
 */
export function keystonesFor(passive: PassiveState, set: WeaponSet): Keystones {
  const nodes = new Set([...(set === 1 ? passive.set1 : passive.set2), ...passive.ascendancyNodes]);
  return {
    giantsBlood: nodes.has(GIANTS_BLOOD),
    instrumentsOfPower: nodes.has(INSTRUMENTS_OF_POWER),
    lordOfTheWilds: nodes.has(LORD_OF_THE_WILDS),
  };
}
