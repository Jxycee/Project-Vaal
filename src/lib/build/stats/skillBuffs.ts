// src/lib/build/stats/skillBuffs.ts
// =============================================================================
// Skill-granted buffs: the defence numbers a socketed Aura or Buff skill puts on the character.
//
// Path of Building 2 applies a skill's GlobalEffect modifiers to the player while the skill is enabled
// (Purity of Ice: "+43% to Cold Resistance" at gem level 18 with 11% increased Aura magnitudes). Its numbers are
// in PoB2's skill definitions (src/Data/Skills/*.lua, MIT, Copyright (c) 2016 David Gowor), reduced to the part
// the sheet can use in data/skill-buffs.json (scripts/derive-skill-buffs.mjs, from the synced skills.json).
//
// How an Aura's number is built (verified on the acolyte oracle: Purity of Ice L18 = 39, x 1.11 = 43.29,
// PoB's breakdown shows 43): the level's table value x (1 + the sum of "increased Aura magnitudes" / 100).
// PoB scales a buff modifier by floor(value x scale x 100) / 100 (ModStore ScaleAddMod); that is followed here.
//
// FAILURE MODES (decided before the code; covered end to end by the oracles in __tests__/multiOracle.test.ts):
//   1. No skills given (an old caller, a build with no gems): nothing is added and nothing is claimed.
//   2. A loadout not active in this weapon set: its buffs are not on the character; skipped silently.
//   3. A skill name our data does not know, or one that two skills share: skipped, never matched by a guess.
//      A skill with no sheet-relevant buff at all is the normal case (most gems) and is not named.
//   4. A modifier that needs a condition or a stack count (Wind Dancer's stacks, a Banner that must be planted)
//      is gated by the build's Path of Building Configuration (buildConfig.ts, carried as PassiveState.buildConfig):
//      a condition counts when ticked there; a count multiplies the value, capped by the skill's own limit
//      (Wind Dancer: 10% more Evasion x 3 stacks, limit 3 = 30%). With NO Configuration, or a count PoB takes from
//      somewhere other than a Config input we read (Virtuous Barrier's motes), the modifier is named in
//      notCounted, never defaulted to a maximum. A tag we do not model (a charge threshold) is named too.
//   5. A modifier on someone else (a curse on enemies, a minion buff): only Aura and Buff effects are the
//      character's own; others are skipped.
//   6. A gem level outside the skill's table: named, not clamped to a number PoB would not use.
//   7. The same skill socketed twice: PoB applies one buff of a given name; the first loadout wins.
//   9. A charge threshold ("StatThreshold:EnduranceCharges:1", Charge Regulation) holds when the Configuration ticks
//      the matching "use charges" switch and the threshold is within the base maximum of 3; off when it is not
//      ticked; named in notCounted with no Configuration at all.
//  10. A Banner (skillTypes "Banner") is scaled by "increased Aura magnitudes" PLUS "increased Banner Aura magnitudes"
//      (the pool bannerAuraEffect); its buff counts only with the Configuration's "Is your Banner planted?"
//      (bannerPlanted -> Condition:BannerPlanted). KNOWN GAP: PoB's Defiance Banner on hybrid-tactician is exactly 60%
//      more (30 x 2.00), we reach 56.1 (30 x 1.87): the remaining 13% is PoB's Valour (Config bannerValour 50), whose
//      rule is in PoB's Lua and not in the synced data. Left short rather than guessed.
//   8. "+N to Level of all skills" from gear is not modelled: the table is read at the gem's own level, which
//      is exactly right only when no such modifier is worn. (An assumption, listed in `assumed` when it applies.)
// =============================================================================

import buffs from '@/lib/pob/data/skill-buffs.json';
import type { GemState } from '../gemState';
import { conditionHolds, MOTE_VARS, moteCounts, NUMBER_INPUTS, type BuildConfig } from './buildConfig';
import { POOLS as MODIFIER_POOLS } from './lineMods';
import type { Contribution } from './engine';

interface BuffEffect {
  mod: string;
  /** A PoB condition that must be true ("BannerPlanted"); a leading "!" = must be false. */
  condition?: string;
  /** value x the multiplier's count, the count capped by `limit` when the skill has one. */
  multiplier?: { var: string; limit?: number };
  type: string;
  stat: string;
  effect: string;
  value?: number;
  values?: number[];
  needs?: string[];
}
type BuffSkill = { name: string; /** A Banner skill: also scaled by "increased Banner Aura magnitudes". */ banner?: boolean; effects: BuffEffect[] };

const KINDS: Record<string, Contribution['kind']> = { BASE: 'flat', INC: 'increased', MORE: 'more' };

let byName: Map<string, BuffSkill | null> | undefined;
function lookup(name: string): BuffSkill | null | undefined {
  if (!byName) {
    byName = new Map();
    for (const skill of Object.values(buffs as Record<string, BuffSkill>)) {
      // A name two skills share is poisoned (failure mode 3).
      byName.set(skill.name, byName.has(skill.name) ? null : skill);
    }
  }
  return byName.get(name);
}

const CHARGES_BY_STAT: Record<string, string> = {
  EnduranceCharges: 'UseEnduranceCharges',
  FrenzyCharges: 'UseFrenzyCharges',
  PowerCharges: 'UsePowerCharges',
};
/** Every character starts with this many of each charge as its maximum (characterConstants max_*_charges). */
const BASE_MAX_CHARGES = 3;

/**
 * "StatThreshold:EnduranceCharges:1" (a buff that needs N charges): PoB gives the character its maximum charges when
 * the Configuration's "use charges" switch is ticked, none otherwise. undefined = not a charge threshold we can
 * answer (no Configuration, or N above the base maximum, which gear may or may not raise).
 */
function chargeThreshold(config: BuildConfig | undefined, need: string): boolean | undefined {
  const [kind, stat, n] = need.split(':');
  const flag = CHARGES_BY_STAT[stat ?? ''];
  if (kind !== 'StatThreshold' || flag === undefined || config === undefined) return undefined;
  const wanted = Number(n);
  if (!config.conditions.includes(flag)) return false;
  return wanted <= BASE_MAX_CHARGES ? true : undefined;
}

/** PoB's ScaleAddMod rounding for a scaled buff modifier. */
const scale = (value: number, factor: number): number => Math.floor(value * factor * 100) / 100;

export function skillBuffContributions(
  gems: GemState | undefined,
  set: 1 | 2,
  /** The summed "increased Aura magnitudes" percent from the tree and gear. */
  auraEffectPercent: number,
  /** The summed "increased Banner Aura magnitudes"; added to the Aura magnitudes for a Banner skill only. */
  bannerEffectPercent = 0,
  /** The build's Path of Building Configuration; undefined = it came without one. */
  config?: BuildConfig,
): { contributions: Contribution[]; notCounted: string[]; counted: string[] } {
  const contributions: Contribution[] = [];
  const notCounted: string[] = [];
  const counted: string[] = [];
  const seen = new Set<string>();
  // Motes: the import's whole-skill-list count (config.multipliers) when there is one, else the loadouts' skills.
  const motes = moteCounts((gems?.loadouts ?? []).filter((l) => l.skill && l.sets.includes(set)).map((l) => l.skill!.name));
  for (const loadout of gems?.loadouts ?? []) {
    const gem = loadout.skill;
    if (!gem || !loadout.sets.includes(set)) continue;
    const skill = lookup(gem.name);
    if (!skill || seen.has(skill.name)) continue;
    seen.add(skill.name);
    let used = false;
    for (const e of skill.effects) {
      if (e.effect !== 'Aura' && e.effect !== 'Buff') continue;
      const pools = MODIFIER_POOLS[e.mod];
      const kind = KINDS[e.type];
      if (!pools || !kind) continue;
      const gates: string[] = [];
      let chargeless = false;
      for (const need of e.needs ?? []) {
        const held = chargeThreshold(config, need);
        if (held === undefined) gates.push(need);
        else if (!held) chargeless = true;
      }
      // Known to be off (the Configuration does not use charges): nothing to count, and nothing to name.
      if (chargeless && gates.length === 0) continue;
      if (e.condition || e.multiplier) {
        const negate = e.condition?.startsWith('!') ?? false;
        const held = e.condition ? conditionHolds(config, negate ? e.condition.slice(1) : e.condition, negate) : true;
        // A count we read from a Config input is known even when absent (0); any other var is not ours to know.
        const knownCount = e.multiplier ? (Object.values(NUMBER_INPUTS).includes(e.multiplier.var) || MOTE_VARS[e.multiplier.var] !== undefined) : true;
        if (held === undefined || (config === undefined && e.multiplier && MOTE_VARS[e.multiplier.var] === undefined) || !knownCount) {
          if (e.condition) gates.push(`Condition:${e.condition}`);
          if (e.multiplier) gates.push(`Multiplier:${e.multiplier.var}`);
        } else if (!held) {
          continue;
        }
      }
      if (gates.length > 0) {
        notCounted.push(`${skill.name}: ${e.mod} ${e.type.toLowerCase()} needs ${gates.join(', ')} (a Path of Building configuration setting), so it was not counted`);
        continue;
      }
      let value = e.value;
      if (value === undefined && e.values) {
        value = e.values[loadout.level - 1];
        if (value === undefined) {
          notCounted.push(`${skill.name}: level ${loadout.level} is outside its table, so its ${e.mod} was not counted`);
          continue;
        }
      }
      if (value === undefined) continue;
      const effectPercent = auraEffectPercent + (skill.banner ? bannerEffectPercent : 0);
      if (e.effect === 'Aura' && effectPercent !== 0) value = scale(value, 1 + effectPercent / 100);
      if (e.multiplier) {
        const count = Math.min(config?.multipliers[e.multiplier.var] ?? motes[e.multiplier.var] ?? 0, e.multiplier.limit ?? Infinity);
        if (count === 0) continue;
        value *= count;
      }
      for (const pool of pools) contributions.push({ pool, kind, value, source: skill.name });
      used = true;
    }
    if (used) counted.push(skill.name);
  }
  return { contributions, notCounted, counted };
}
