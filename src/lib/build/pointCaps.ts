// src/lib/build/pointCaps.ts
// =============================================================================
// The tree nodes that change how many points a build may spend, and the caps
// that follow. Pure, with no tree export in hand: the validator and the
// editor's counters both use it, and __tests__/pointCaps.test.ts re-derives
// every value below from public/data/tree/0.5.2/data.json, so a tree update
// that changes one fails that test rather than miscounting quietly.
//
// - isFree: ascendancy notables that cost no ascendancy point (the export's
//   `isFree`).
// - Weapon Master (Mercenary2): "100 Passive Skill Points become Weapon Set
//   Skill Points" — the export's weaponPassivePointsGranted 100,
//   passivePointsGranted -100.
// =============================================================================

import { MAX_WEAPON_SET_POINTS } from './constants';
import type { PassiveState } from './types';

export const FREE_ASCENDANCY_NODES: ReadonlySet<number> = new Set([9988, 8415, 28254]);

/** Node id -> the weapon-set points it adds to EACH set, and the basic points it adds (negative: takes). */
export const POINT_GRANTS: Readonly<Record<number, { weapon: number; basic: number }>> = {
  8272: { weapon: 100, basic: -100 },
};

function grantsFor(passive: Pick<PassiveState, 'set1' | 'set2' | 'ascendancyNodes'>): { weapon: number; basic: number } {
  const allocated = new Set([...passive.set1, ...passive.set2, ...passive.ascendancyNodes]);
  let weapon = 0;
  let basic = 0;
  for (const [id, grant] of Object.entries(POINT_GRANTS)) {
    if (allocated.has(Number(id))) {
      weapon += grant.weapon;
      basic += grant.basic;
    }
  }
  return { weapon, basic };
}

/** Ascendancy points the allocation costs: free notables cost none. */
export function ascendancyPointsSpent(ascendancyNodes: readonly number[]): number {
  return ascendancyNodes.filter((id) => !FREE_ASCENDANCY_NODES.has(id)).length;
}


/** The weapon-set point cap for each set, given what is allocated. */
export function weaponSetPointCap(passive: Pick<PassiveState, 'set1' | 'set2' | 'ascendancyNodes'>): number {
  return MAX_WEAPON_SET_POINTS + grantsFor(passive).weapon;
}

/** How the allocation shifts the level-derived basic budget (derivePassiveBudget). */
export function basicPointShift(passive: Pick<PassiveState, 'set1' | 'set2' | 'ascendancyNodes'>): number {
  return grantsFor(passive).basic;
}
