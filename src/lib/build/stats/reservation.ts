// src/lib/build/stats/reservation.ts
// =============================================================================
// Derived Low Life: the condition Path of Building 2 sets on its own when enough Life is reserved.
//
// PoB2 (CalcDefence.lua:340-352): for each pool, reserved = flat + ceil(max x percent / 100) and the character is
// "Low <pool>" when (max - reserved) / max <= LowPoolThreshold, 0.35 (Data.lua:243). The Configuration's
// "Are you always on Low Life?" (conditionLowLife) is the only other way in, and buildConfig.ts already reads it.
// The only Life reservation the planner's gems can cause is a support that swaps a skill's Spirit reservation for Life
// (CalcDefence.lua:240-246): Atziri's Communion, "66 permyriad of Life per Spirit" -> Trinity (100 Spirit) reserves 66%
// of Life, which leaves 34% and puts the character on Low Life (ordinary-caster-2: Defiance's "80% increased Armour and
// Evasion Rating when on Low Life", PoB LifeUnreservedPercent 33.95).
//
// The reservation tables are derived from PoB2's skill data (scripts/derive-life-reservation.mjs ->
// data/life-reservation.json), nothing is hard-coded here.
//
// FAILURE MODES (decided before the code; covered end to end by ordinary-caster-2 in __tests__/multiOracle.test.ts):
//   1. No gems, or no support that reserves Life: reserved is 0, the condition is not derived, nothing is claimed.
//   2. A loadout not active in this weapon set: its skill is not on the character (PoB only reserves for the active
//      set's skills); skipped.
//   3. A support on a skill with no Spirit reservation (it supports a spell, not a persistent skill): PoB reserves
//      nothing for it (the base is 0), so it adds nothing here.
//   4. A skill name two skills share, or one missing from the table: skipped, never matched by a guess.
//   5. A gem level outside a per-level Spirit table: skipped rather than clamped.
//   6. Reservation efficiency and "increased Reserved" modifiers, and the skill's own reservation multiplier, are NOT
//      modelled. They shrink the reserved percent, so a build with a lot of them could be wrongly put on Low Life;
//      `assumed` says so whenever a Life reservation is derived.
//   7. The threshold is compared on the exact percent. PoB rounds the reserved Life up to a whole point, which only
//      matters when the unreserved share is within 1 / max Life of 35%.
//   8. A build that comes with no Configuration at all keeps none: the derived condition is added to a Configuration,
//      never used to invent one (buildConfig.ts failure mode 4).
// =============================================================================

import reservation from '@/lib/pob/data/life-reservation.json';
import type { GemState } from '../gemState';
import type { BuildConfig } from './buildConfig';

/** Data.lua:243: a pool is "Low" at or below this share unreserved. */
export const LOW_POOL_THRESHOLD = 0.35;

const SPIRIT = reservation.spirit as Record<string, number | number[]>;
const PER_SPIRIT = reservation.perSpirit as Record<string, number>;

/** The percent of maximum Life that the active skills reserve, and the skills doing it. */
export function lifeReservation(gems: GemState | undefined, set: 1 | 2): { percent: number; skills: string[] } {
  let percent = 0;
  const skills: string[] = [];
  for (const loadout of gems?.loadouts ?? []) {
    if (!loadout.skill || !loadout.sets.includes(set)) continue;
    const perSpirit = loadout.supports.reduce((n, s) => n + (PER_SPIRIT[s.name] ?? 0), 0);
    if (perSpirit <= 0) continue;
    const table = SPIRIT[loadout.skill.name];
    const spirit = Array.isArray(table) ? table[loadout.level - 1] : table;
    if (spirit === undefined) continue;
    percent += Math.round(spirit * perSpirit * 100) / 100;
    skills.push(loadout.skill.name);
  }
  return { percent: Math.min(percent, 100), skills };
}

/** The Configuration with the conditions the build's own reservations imply (failure mode 8: none without one). */
export function withDerivedConditions(config: BuildConfig | undefined, lifeReservedPercent: number, chaosInoculation = false): BuildConfig | undefined {
  return withHitRecently(withLifeConditions(config, lifeReservedPercent, chaosInoculation));
}

/**
 * A critical hit is a hit: a Configuration that ticks "Have you Crit Recently?" has Hit an Enemy Recently too (ordinary-witchhunter-1
 * ticks only conditionCritRecently, yet Afterimage's "60% increased Evasion Rating if you have Hit an Enemy Recently" is in PoB's total).
 * Nothing ticks HitRecently on its own here, and a build with no Configuration is never given one.
 */
function withHitRecently(config: BuildConfig | undefined): BuildConfig | undefined {
  if (!config || !config.conditions.includes('CritRecently') || config.conditions.includes('HitRecently')) return config;
  return { ...config, conditions: [...config.conditions, 'HitRecently'].sort() };
}

function withLifeConditions(config: BuildConfig | undefined, lifeReservedPercent: number, chaosInoculation: boolean): BuildConfig | undefined {
  if (!config) return config;
  // Full Life: PoB puts a Chaos Inoculation character on Full Life without the "Are you always on Full Life?" tick (ordinary-
  // pathfinder-2, Life 1: High Alert's "50% increased Evasion Rating when on Full Life" is in PoB's total with conditionFullLife
  // unticked). An ordinary character with unreserved Life is NOT: ordinary-witchhunter-1 (Life 1673 of 1673, nothing reserved)
  // has neither Hyrri's Ire's "100% increased Evasion Rating when on Full Life" nor its "10% increased Movement Speed when on Full
  // Life" counted. Any Life reservation, or an always-Low-Life tick, rules it out.
  if (lifeReservedPercent <= 0) {
    if (!chaosInoculation) return config;
    return config.conditions.includes('FullLife') || config.conditions.includes('LowLife') ? config : { ...config, conditions: [...config.conditions, 'FullLife'].sort() };
  }
  const unreserved = (100 - lifeReservedPercent) / 100;
  if (unreserved > LOW_POOL_THRESHOLD || config.conditions.includes('LowLife')) return config;
  return { ...config, conditions: [...config.conditions, 'LowLife'].sort() };
}
