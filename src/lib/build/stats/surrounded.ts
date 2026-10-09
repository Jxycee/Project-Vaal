// src/lib/build/stats/surrounded.ts
// =============================================================================
// Derived Surrounded: the condition Path of Building 2 sets on its own, which gates "N% increased Armour / Evasion
// Rating while Surrounded" (Armour and Evasion while Surrounded passives, 20-30% each).
//
// PoB2 (CalcPerform.lua:521-527, CalcSetup.lua:109-110, Misc.lua:109, Data.lua:280):
//   SurroundedMinimum = 5 (BaseRequiredEnemiesToBeConsideredSurrounded) + every "Require N fewer enemies to be
//                       Surrounded" (a BASE of -N);
//   SurroundedRadius  = 30 x "N% increased Surrounded Area of Effect" (an AREA increase, so the radius grows with its
//                       square root), floored;
//   Condition:Surrounded = max(SurroundedMinimum, 1) == 1 AND SurroundedRadius >= Multiplier:enemyDistance.
// The Configuration's "Are you surrounded?" (conditionSurrounded) is the only other way in; buildConfig.ts reads it.
// Found on ordinary-smith-of-kitava-1 and ordinary-witchhunter-1: both wear Constricting Command ("Require 4 fewer
// enemies to be Surrounded") and PoB counts the Surrounded passives with conditionSurrounded unticked; ordinary-titan-1
// allocates the same passives, lacks that line, and PoB counts none of them.
//
// FAILURE MODES (decided before the code; covered end to end by the oracles, not a unit test):
//   1. A build with no Configuration at all: nothing is derived (the conditions are unknown, buildConfig.ts failure
//      mode 4); the derived condition is added to a Configuration, never used to invent one.
//   2. "Require 3 fewer" on one item (minimum 2): not enough alone, so the condition stays off. Only the SUM reaching
//      1 turns it on, and a roll of Constricting Command below 4 does not.
//   3. The Configuration's "Distance to enemy" (enemyDistance) beyond the Surrounded radius: PoB keeps the condition
//      off, so it is read (buildConfig.ts NUMBER_INPUTS) and compared.
//   4. The Surrounded condition feeds modifiers, never the two pools it is derived from, so one extra collection pass
//      with the condition on is enough; it cannot change its own answer.
//   5. The condition is derived per collection, never written into the saved Configuration: the saved data stays what
//      the build exported, and the saved-data path (parseCraft -> craft.verbatim) reads the same lines the oracle does.
// =============================================================================

import type { BuildConfig } from './buildConfig';
import type { Contribution } from './engine';

/** Misc.lua:109 BaseRequiredEnemiesToBeConsideredSurrounded. */
const BASE_ENEMIES_REQUIRED = 5;
/** Data.lua:280 SurroundedRadiusBase, in PoB's units (10 = 1 metre). */
const BASE_RADIUS = 30;

export interface SurroundedReading {
  holds: boolean;
  /** Enemies required after every "fewer" line (PoB floors at 1). */
  required: number;
  radius: number;
}

export function readSurrounded(contributions: readonly Contribution[], config: BuildConfig | undefined): SurroundedReading {
  const fewer = contributions.filter((c) => c.pool === 'surroundedMinimum' && c.kind === 'flat').reduce((n, c) => n + c.value, 0);
  const required = Math.max(BASE_ENEMIES_REQUIRED + fewer, 1);
  const areaIncrease = contributions.filter((c) => c.pool === 'surroundedArea' && c.kind === 'increased').reduce((n, c) => n + c.value, 0);
  // Radius from area: pi x r^2 x (1 + inc/100), back to a radius, floored (CalcPerform.lua calcBuffRadius).
  const radius = Math.floor(Math.sqrt(BASE_RADIUS * BASE_RADIUS * Math.max(1 + areaIncrease / 100, 0)) + 1e-9);
  const distance = Math.max(config?.multipliers.enemyDistance ?? 0, 0);
  return { holds: required === 1 && radius >= distance, required, radius };
}
