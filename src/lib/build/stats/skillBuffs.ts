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
//      more (30 x 2.00), we reach 56.1 (30 x 1.87). It is NOT Valour (checked round 5): no skill in PoB's Lua supplies
//      banner_aura_magnitude_+%_final_per_resource (a removed pre-0.3 quality stat), so Config bannerValour has no effect.
//      PoB scales an Aura by (1 + inc AuraEffect/100) x more x (1 + inc Magnitude/100) (CalcPerform.lua:2306); "Aura Skills
//      have N% increased Magnitudes" parses to Magnitude, "Banner Skills have N% increased Aura Magnitudes" to AuraEffect,
//      but no split of this build's tree (24 Banner, 63 Aura) reaches 2.00 (all-additive 1.87, split 2.02), so a source is
//      still unidentified. One data point cannot fix it without special-casing; left short rather than guessed.
//   8. "+N to Level of all skills" from gear is not modelled: the table is read at the gem's own level, which
//      is exactly right only when no such modifier is worn. (An assumption, listed in `assumed` when it applies.)
//  11. A support that raises the skill's level by the size of its group (Uhtred's Exodus: +3 with no other support,
//      Omen +2 with one, Augury +2 with two; data/support-levels.json, derived from PoB's SupportedGemProperty level
//      mod behind MultiplierThreshold SupportCount): the bonus applies only when the loadout's support count equals
//      the threshold (the gem itself counted); any other count adds nothing. Level-granting supports that need the
//      skill's tags (an element Mastery) are not in the data and stay an assumption (8).
//  12. Discipline's "maximum Energy Shield" is PoB's EnergyShieldTotal (not EnergyShield): it is added to the finished Energy
//      Shield, not scaled by its increases, and it takes the Aura magnitudes like any Aura (monk-1: level 13 = 162 exactly;
//      sorceress-1: level 20 = 328 x 1.47 = 482.16). The engine adds the pool 'energyShieldTotal' after rounding the scaled figure.
// =============================================================================

import buffs from '@/lib/pob/data/skill-buffs.json';
import shapeshift from '@/lib/pob/data/skill-shapeshift.json';
import hitSkills from '@/lib/pob/data/skill-hits.json';
import supportLevels from '@/lib/pob/data/support-levels.json';
import { deriveMainSkill, type GemState } from '../gemState';
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
    // The gem level the tables are read at: its own, plus a group-size support's bonus (failure mode 11).
    let gemLevel = loadout.level;
    for (const support of loadout.supports) {
      const grant = (supportLevels as Record<string, { supportCount: number; bonus: number }>)[support.name];
      if (grant && grant.supportCount === loadout.supports.length) gemLevel += grant.bonus;
    }
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
        value = e.values[gemLevel - 1];
        if (value === undefined) {
          notCounted.push(`${skill.name}: level ${gemLevel} is outside its table, so its ${e.mod} was not counted`);
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

// SHAPESHIFT FORMS. PoB2 (CalcPerform.lua:398-416) gives the character a form's bonus while the MAIN skill has the
// form's type (Bear, Wolf, Wyvern); the poe.ninja simulation is always in combat mode, so the bonus always applies:
// Bear Form = Armour BASE 10 x character level + 10 (ModStore Multiplier tag: value x count + base), Wolf Form = 30%
// increased Movement Speed, Wyvern Form = 50% increased Energy Shield recharge rate. (Bear Form also lets 30% of Armour
// apply to elemental damage taken; that is a damage-reduction figure, not one of the sheet's numbers.)
// Failure modes, decided first:
//   1. No skills, or no main skill (deriveMainSkill is null): no form, nothing claimed.
//   2. The main skill is the build's primary loadout, as imported from Build@mainSocketGroup (mapGems.ts); a form skill
//      that is merely socketed elsewhere gives nothing, exactly as in PoB.
//   3. A skill name another kind of skill shares is absent from the data (scripts/derive-skill-buffs.mjs): no bonus.
//   4. Switching the primary skill in the app to a non-form skill drops the bonus, like PoB's main-skill selector.
//   5. The same main skill sets PoB's Condition:Shapeshifted (withShapeshifted below), so "+1% to Maximum Lightning
//      Resistance while Shapeshifted" and the other "while Shapeshifted" passives count (ordinary-druid-1: Lightning 76).
//      A build with no Configuration is never given one, like the other derived conditions.
export function isShapeshifted(gems: GemState | undefined): boolean {
  const main = gems ? deriveMainSkill(gems) : null;
  if (main === null) return false;
  const forms = shapeshift as Record<'Bear' | 'Wolf' | 'Wyvern', string[]>;
  return forms.Bear.includes(main) || forms.Wolf.includes(main) || forms.Wyvern.includes(main);
}

/** The main skill Hits and is self-cast (data/skill-hits.json): PoB then counts Hit Recently on its own. */
export function mainSkillHits(gems: GemState | undefined): boolean {
  const main = gems ? deriveMainSkill(gems) : null;
  return main !== null && (hitSkills as string[]).includes(main);
}

/** The Configuration with Condition:Shapeshifted added when the main skill is a form (failure mode 5). */
export function withShapeshifted(config: BuildConfig | undefined, gems: GemState | undefined): BuildConfig | undefined {
  if (!config || config.conditions.includes('Shapeshifted') || !isShapeshifted(gems)) return config;
  return { ...config, conditions: [...config.conditions, 'Shapeshifted'].sort() };
}

export function shapeshiftContributions(gems: GemState | undefined, level: number): Contribution[] {
  const main = gems ? deriveMainSkill(gems) : null;
  if (main === null) return [];
  const forms = shapeshift as Record<'Bear' | 'Wolf' | 'Wyvern', string[]>;
  if (forms.Bear.includes(main)) return [{ pool: 'armour', kind: 'flat', value: 10 * level + 10, source: 'Bear Form' }];
  if (forms.Wolf.includes(main)) return [{ pool: 'movementSpeed', kind: 'increased', value: 30, source: 'Wolf Form' }];
  if (forms.Wyvern.includes(main)) return [{ pool: 'esRechargeFaster', kind: 'increased', value: 50, source: 'Wyvern Form' }];
  return [];
}
