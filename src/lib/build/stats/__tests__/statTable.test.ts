import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONDITIONAL_EFFECTS, GLOBAL_EFFECTS, LOCAL_EFFECTS, looksLikeDefenceStat, NOT_MODELLED, type Pool } from '../statTable';

// The stat table is hand-written, so every entry is checked against real
// data: the id must exist in our tree or mod files, AND the display text of
// something that carries it must name the pool it is mapped to. A mapping
// that only type-checks is exactly the kind of plausible, wrong claim this
// project keeps paying for (see docs/superpowers/CURRENT-STATE.md).

const nodeStats = (JSON.parse(readFileSync('public/data/tree/0.5.2/node-stats.json', 'utf8')) as { nodes: Record<string, [string, number][]> }).nodes;
const tree = (JSON.parse(readFileSync('public/data/tree/0.5.2/data.json', 'utf8')) as { nodes: Record<string, { stats?: string[] }> }).nodes;

/** stat id -> the display lines of every mod or node that carries it. */
const textsFor = new Map<string, string[]>();
const add = (stat: string, lines: string[]) => textsFor.set(stat, [...(textsFor.get(stat) ?? []), ...lines]);
for (const [id, list] of Object.entries(nodeStats)) for (const [stat] of list) add(stat, tree[id]?.stats ?? []);
const modDir = 'public/data/wiki/2026-08-25/mods';
for (const f of readdirSync(modDir)) {
  const m = JSON.parse(readFileSync(`${modDir}/${f}`, 'utf8')) as { rolls?: { stat: string }[]; stats?: string[] };
  for (const r of m.rolls ?? []) add(r.stat, m.stats ?? []);
}

const POOL_WORDS: Record<Pool, RegExp> = {
  life: /Life/,
  mana: /Mana/,
  energyShield: /Energy ?Shield/,
  armour: /Armour/,
  evasion: /Evasion/,
  str: /Strength|Attributes/,
  dex: /Dexterity|Attributes/,
  int: /Intelligence|Attributes/,
  fireRes: /Fire.*Resistance|Elemental Resistances/,
  coldRes: /Cold.*Resistance|Elemental Resistances/,
  lightningRes: /Lightning.*Resistance|Elemental Resistances/,
  chaosRes: /Chaos.*Resistance/,
  fireMax: /Maximum (Fire|Elemental) Resistance|all maximum Resistances/i,
  coldMax: /Maximum (Cold|Elemental) Resistance|all maximum Resistances/i,
  lightningMax: /Maximum (Lightning|Elemental) Resistance|all maximum Resistances/i,
  chaosMax: /Maximum Chaos Resistance|all maximum Resistances/i,
  spirit: /Spirit/,
  auraEffect: /Aura.*Magnitudes/,
  // The derived defence stats: the wording of the line that carries the stat.
  maxEndurance: /Endurance Charges/,
  maxFrenzy: /Frenzy Charges/,
  maxPower: /Power Charges/,
  movementSpeed: /Movement Speed/,
  esRecharge: /Energy Shield Recharge/,
  esRechargeFaster: /Energy Shield Recharge/,
  lifeRegen: /Life Regeneration|Regenerate .*Life/i,
  lifeRegenPercent: /Regenerate .*Life/i,
  deflection: /Deflection/,
  evasionToDeflection: /Deflection/,
  armourToDeflection: /Deflection/,
  blindEffect: /Blind/,
  physReduction: /Physical Damage Reduction/,
  armourToPhysical: /Armour/,
  armourToFire: /Armour/,
  armourToCold: /Armour/,
  armourToLightning: /Armour/,
  armourToChaos: /Armour/,
  ward: /Ward/,
  defences: /Armour, Evasion and Energy Shield/,
  mom: /taken from Mana before Life/i,
  momElemental: /taken from Mana before Life/i,
  esToPhysical: /Energy Shield[\s\S]*Armour/,
  manaRegen: /Mana (Regeneration|Recovery) Rate/,
  critReduce: /Critical Damage Bonus/,
  enemyCrit: /Critical Hit Chance against you/,
  unluckyCrit: /Critical Hit Chance against you is/,
  effectRing1: /bonuses gained from Equipped/,
  effectRing2: /bonuses gained from Equipped/,
  effectRing3: /bonuses gained from Equipped/,
  effectAmulet: /bonuses gained from Equipped/,
};

const strip = (t: string) => t.replace(/\[[^|\]]*\|([^\]]*)\]/g, '$1').replace(/\[([^\]]*)\]/g, '$1');

/** Every (stat, pool) pair whose id is missing from our data or whose text never names the pool. */
const mismatches = (table: Record<string, { pool: Pool }[]>) => {
  const bad: string[] = [];
  for (const [stat, effects] of Object.entries(table)) {
    const texts = (textsFor.get(stat) ?? []).map(strip);
    if (texts.length === 0) bad.push(`${stat}: in neither the tree nor the mod files`);
    else for (const { pool } of effects) if (!texts.some((t) => POOL_WORDS[pool].test(t))) bad.push(`${stat}: no text mentions ${pool}`);
  }
  return bad;
};

// One test per table (not per stat id): every entry is still checked, and a failure lists every bad id.
describe('stat tables — against real data', () => {
  it('every conditional entry exists in our data and its text names each pool it maps to', () => {
    expect(mismatches(Object.fromEntries(Object.entries(CONDITIONAL_EFFECTS).map(([s, { effects }]) => [s, effects])))).toEqual([]);
  });
  it('every global entry exists in our data and its text names each pool it maps to', () => {
    expect(mismatches(GLOBAL_EFFECTS)).toEqual([]);
  });
  it('every local entry exists in our data and its text names each pool it maps to', () => {
    expect(mismatches(LOCAL_EFFECTS)).toEqual([]);
  });
});

describe('stat table — shape', () => {
  it('names every local stat with the local_ prefix, and no global one with it', () => {
    for (const stat of Object.keys(LOCAL_EFFECTS)) expect(stat.startsWith('local_'), stat).toBe(true);
    for (const stat of Object.keys(GLOBAL_EFFECTS)) expect(stat.startsWith('local_'), stat).toBe(false);
  });

  it('never both maps and lists-as-not-modelled the same stat', () => {
    for (const stat of Object.keys(NOT_MODELLED)) {
      expect(GLOBAL_EFFECTS[stat], stat).toBeUndefined();
      expect(LOCAL_EFFECTS[stat], stat).toBeUndefined();
    }
  });

  it('lists only not-modelled stats that really exist in our data', () => {
    for (const stat of Object.keys(NOT_MODELLED)) expect(textsFor.has(stat), stat).toBe(true);
  });
});

describe('looksLikeDefenceStat — which unmapped ids are worth naming on the sheet', () => {
  it('names defence ids across the pool kinds', () => {
    for (const id of ['maximum_life_+%_final', 'base_maximum_spirit', 'future_resist_all_+%', 'dexterity_+%', 'maximum_energy_shield_from_gloves_+%', 'base_physical_damage_reduction_rating_extra']) {
      expect(looksLikeDefenceStat(id), id).toBe(true);
    }
  });

  // Real ids from the reference characters: offence, conditionals, recovery rates and conversions.
  it('stays silent about offence, conditionals, recovery rates and conversions', () => {
    for (const id of [
      'attack_speed_+%',
      'attack_damage_+%_when_on_low_life',
      'mana_regeneration_rate_+%',
      'life_leech_from_physical_attack_damage_permyriad',
      'armour_break_amount_+%',
      '%_maximum_life_as_focus',
      'base_movement_velocity_+%',
      'display_passive_attribute_text',
    ]) {
      expect(looksLikeDefenceStat(id), id).toBe(false);
    }
  });
});
