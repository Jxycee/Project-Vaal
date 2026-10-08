// src/lib/build/stats/totems.ts
// =============================================================================
// Summoned Totems: the count a "per Summoned Totem in your Presence" passive multiplies by.
//
// Path of Building 2 (CalcPerform.lua:1297-1303): when ANY active skill is a totem skill, TotemsSummoned is the
// Configuration's "# of Summoned Totems" if set, else the MAIN skill's ActiveTotemLimit: the sum of every ActiveTotemLimit /
// ActiveBallistaLimit modifier that applies to the main skill. Those come from the main skill's own statMap
// (base_number_of_totems_allowed, data/skill-totems.json, scripts/derive-skill-buffs.mjs) and from passives:
//   number_of_additional_totems_allowed                  +N to every skill
//   attack_skills_additional_ballista_totems_allowed     +N when the main skill's totems are ballistae (TotemsAreBallistae)
//   melee_attack_skills_additional_totems_allowed        +N when the main skill is a melee attack
// ordinary-warbringer-1: the main skill is Explosive Grenade (not a totem skill), Mortar Cannon is active, and PoB counts
// 1 totem from passive 39411 (spawn_defender_with_totem, +1 totem): 1 totem x 10% increased Armour and Evasion.
//
// FAILURE MODES (decided before the code; ordinary-warbringer-1 covers the real case end to end):
//   1. No gems given (an old caller): undefined, so "per totem" lines are named as unknown, never counted as 0.
//   2. No totem skill active in this weapon set: 0. PoB only sets TotemsSummoned from a totem skill, however many passives
//      add to the limit.
//   3. A totem skill is active but there is no main skill: only the "every skill" passives are summed (PoB's main skill always
//      exists; ours can be a label row), the skill-specific ones are not.
//   4. The Configuration's own count wins over anything derived (PoB: Override). A count of 0 is not "unset": the
//      Configuration drops zeros (buildConfig.ts), so 0 cannot be told from absent and means "derive it".
//   5. KNOWN GAP: "+N to maximum number of Summoned Totems" printed on gear, and gem supports that add totems, are not added.
//      A build with one is short by that many totems on every such line; it shows as a gap against PoB's breakdown.
//   6. A skill name two gems share, or one our data does not know: counts as not a totem skill, never matched by guess.
// =============================================================================

import totems from '@/lib/pob/data/skill-totems.json';
import type { GemState } from '../gemState';

const DATA = totems as { limit: Record<string, number>; ballista: string[]; meleeAttack: string[] };

/** What the allocated passives add to the totem limit, by who it applies to. */
export interface TotemMods {
  global: number;
  ballista: number;
  meleeAttack: number;
}

export function totemsSummoned(gems: GemState | undefined, set: 1 | 2, override: number | undefined, mods: TotemMods): number | undefined {
  if (override !== undefined && override > 0) return override;
  if (!gems) return undefined;
  const active = gems.loadouts.filter((l) => l.skill && l.sets.includes(set));
  if (!active.some((l) => Object.hasOwn(DATA.limit, l.skill!.name))) return 0;
  const name = active.find((l) => l.id === gems.primaryId)?.skill?.name;
  if (name === undefined) return mods.global;
  const own = Object.hasOwn(DATA.limit, name) ? DATA.limit[name] : 0;
  return own + mods.global + (DATA.ballista.includes(name) ? mods.ballista : 0) + (DATA.meleeAttack.includes(name) ? mods.meleeAttack : 0);
}
