// src/lib/build/stats/engine.ts
// =============================================================================
// The defence engine (Slice 5): summed contributions -> the numbers a stat
// sheet shows. Pure. Arithmetic ported from Path of Building Community (PoE2),
// MIT, Copyright (c) 2016 David Gowor — each rule cites the line it follows,
// read raw from the `dev` branch on 2026-09-25:
//
//   Life  BASE 12/level + 16      CalcSetup.lua:955 (life_per_level 12, Data/Misc.lua:156)
//   Mana  BASE 4/level + 30       CalcSetup.lua:956 (mana_per_level 4, Data/Misc.lua:157)
//   Evasion BASE 7                CalcSetup.lua:961 (base_evasion_rating, player constants)
//   +2 Life / Str, +2 Mana / Int  CalcPerform.lua:494-519; HalvesLifeFromStrength -> 1 / Str
//   attributes round(val), >= 0   CalcPerform.lua:236
//   Life/Mana round((base) x (1 + inc/100) x more), >= 1 CalcDefence.lua:91, 96
//   Armour/Evasion/ES round(x), >= 0                     CalcDefence.lua:1446-1455
//   an item's own Armour/Evasion/ES x (1 + (global + that slot's increased)/100) x more
//                                                        CalcDefence.lua:1445-1453
//   resist max = 75 + mods, <= 90; totals truncated; final = min(total, max)
//                                  CalcSetup.lua:27-30, CalcDefence.lua:945-966
//   elemental penalty BASE (default -60)                 CalcSetup.lua:965-967
//
// The derived stats (movement speed, charges, regeneration, evade, deflection, Runic Ward, maximum hit) are
// further down, each citing CalcDefence.lua / CalcPerform.lua / ConfigOptions.lua the same way. They assume PoB's
// DEFAULT enemy (Configuration "Is the enemy a Boss?" defaults to Guardian/Pinnacle, level 82) and no per-hit
// mitigation we do not model (block, suppression, Mind over Matter, damage-taken mods, conversion).
//
// One deliberate difference: PoB2 floors Spirit at 1 (the same CalcDefence.lua:96
// loop); a PoE2 character with no Spirit source has 0, so this floors at 0.
// "More" multipliers are modelled per pool (kind 'more') and by the two named flags.
// =============================================================================

import monsterTables from '@/lib/pob/data/misc-constants.json';
import type { GearSlot } from '../gearSlots';
import type { BuildConfig } from './buildConfig';
import type { Pool } from './statTable';

export interface Contribution {
  pool: Pool;
  kind: 'flat' | 'increased' | 'more';
  value: number;
  /** Where it came from, for the sheet's breakdown ("Candlemass (Ogham Manor)", "Amethyst Ring"). */
  source: string;
  /**
   * An item's own defence is tagged with the slot it is worn in, and an
   * `increased` carrying a slot ("from equipped body armour") scales only that
   * slot's item. Untagged contributions are global.
   */
  slot?: GearSlot;
}

export interface EngineInput {
  level: number;
  classBase: { str: number; dex: number; int: number };
  contributions: Contribution[];
  /** Added to fire, cold and lightning; see campaign.ts. */
  resistancePenalty: number;
  flags: {
    /** Giant's Blood: "Inherent Life granted by Strength is halved". */
    giantsBlood: boolean;
    /** Lord of the Wilds: "50% less Spirit". */
    lordOfTheWilds: boolean;
    /** Embrace the Darkness: "You have no Spirit". */
    noSpirit: boolean;
    /** Chaos Inoculation: "Maximum Life becomes 1, Immune to Chaos Damage" (PoB2 reports 100% chaos resistance). */
    chaosInoculation?: boolean;
    /**
     * Eldritch Battery: "Convert 100% of maximum Energy Shield to maximum Mana". PoB2's breakdown for the oracle
     * build is (1884 mana flat + 1566 ES flat) x 1.5 mana increased = 5175 and ES 0: the flat Energy Shield moves
     * into Mana's base, Mana's own increased and more apply to it, and Energy Shield's do not.
     */
    eldritchBattery?: boolean;
  };
  /** The build's PoB Configuration (conditions such as EnemyBlinded). Absent = unknown, which reads as nothing ticked. */
  config?: BuildConfig;
}

export interface Resistance {
  value: number;
  max: number;
  /** Before the cap — how much headroom or shortfall there is. */
  uncapped: number;
}

export interface DefenceSheet {
  str: number;
  dex: number;
  int: number;
  life: number;
  mana: number;
  energyShield: number;
  armour: number;
  evasion: number;
  fire: Resistance;
  cold: Resistance;
  lightning: Resistance;
  chaos: Resistance;
  spirit: number;
  derived: DerivedStats;
}

/** The three damage-type keys the maximum-hit values use, in PoB's dmgTypeList order. */
export type HitType = 'physical' | 'fire' | 'cold' | 'lightning' | 'chaos';

export interface DerivedStats {
  /** Enemy Accuracy against this character (the default boss at level 82, less Blind when the Configuration ticks it). */
  enemyAccuracy: number;
  evadeChance: number;
  deflectionRating: number;
  deflectChance: number;
  deflectEffect: number;
  /** Runic Ward (the Runeforged armour bases' own ward, scaled). */
  ward: number;
  /** Life regenerated per second. */
  lifeRegen: number;
  /** Mana regenerated per second. */
  manaRegen: number;
  /** Energy Shield recharged per second once it starts, and the seconds before it starts. */
  esRecharge: number;
  esRechargeDelay: number;
  /** Movement speed as a percent (100 = base). */
  movementSpeed: number;
  enduranceCharges: number;
  frenzyCharges: number;
  powerCharges: number;
  /** PoB's effective health pool: the hits the pools survive x the default enemy's damage per hit (TotalEHP, CalcDefence.lua:3416). */
  effectiveHealthPool: number;
  /** The largest single hit of each type that leaves the character alive; Infinity = immune. */
  maxHit: Record<HitType, number>;
}

const BASE_RESIST_MAX = 75;
const MAX_RESIST_CAP = 90;
const RESIST_FLOOR = -200; // data.misc.ResistFloor

export function computeDefences(input: EngineInput): DefenceSheet {
  const level = Number.isFinite(input.level) ? Math.min(100, Math.max(1, Math.trunc(input.level))) : 1;
  const flatOf = (pool: Pool) => sum(input.contributions, pool, 'flat', true);
  const incOf = (pool: Pool) => sum(input.contributions, pool, 'increased', false);
  const moreOf = (pool: Pool) => product(input.contributions, pool);
  const scaled = (base: number, pool: Pool) => base * (1 + incOf(pool) / 100) * moreOf(pool);

  const str = Math.max(Math.round(scaled(input.classBase.str + flatOf('str'), 'str')), 0);
  const dex = Math.max(Math.round(scaled(input.classBase.dex + flatOf('dex'), 'dex')), 0);
  const int = Math.max(Math.round(scaled(input.classBase.int + flatOf('int'), 'int')), 0);

  const lifePerStr = input.flags.giantsBlood ? 1 : 2;
  const ci = input.flags.chaosInoculation === true;
  const life = ci ? 1 : Math.max(Math.round(scaled(12 * level + 16 + str * lifePerStr + flatOf('life'), 'life')), 1);
  const converted = input.flags.eldritchBattery === true;
  const mana = Math.max(Math.round(scaled(4 * level + 30 + int * 2 + flatOf('mana') + (converted ? flatOf('energyShield') : 0), 'mana')), 1);

  // Each slot's item gets the global increase plus its own slot's (CalcDefence.lua:1445-1453);
  // everything else (class base, global flats) gets the global one only. With no slot-scoped
  // increase this is the same number as scaling the grand total.
  const defence = (pool: Pool, base = 0) => {
    const slotted = slotsOf(input.contributions, pool);
    let total = (base + sum(input.contributions, pool, 'flat', false)) * (1 + incOf(pool) / 100);
    for (const slot of slotted) {
      total += sumSlot(input.contributions, pool, 'flat', slot) * (1 + (incOf(pool) + sumSlot(input.contributions, pool, 'increased', slot)) / 100);
    }
    return Math.max(Math.round(total * moreOf(pool)), 0);
  };

  const resist = (pool: Pool, maxPool: Pool, penalty: number): Resistance => {
    const max = Math.trunc(Math.min(MAX_RESIST_CAP, BASE_RESIST_MAX + flatOf(maxPool)));
    const uncapped = Math.trunc(penalty + flatOf(pool));
    return { value: Math.max(Math.min(uncapped, max), RESIST_FLOOR), max, uncapped };
  };

  let spirit = scaled(flatOf('spirit'), 'spirit');
  if (input.flags.lordOfTheWilds) spirit *= 0.5;
  if (input.flags.noSpirit) spirit = 0;

  const sheet = {
    str,
    dex,
    int,
    life,
    mana,
    energyShield: converted ? 0 : defence('energyShield'),
    armour: defence('armour'),
    evasion: defence('evasion', 7),
    fire: resist('fireRes', 'fireMax', input.resistancePenalty),
    cold: resist('coldRes', 'coldMax', input.resistancePenalty),
    lightning: resist('lightningRes', 'lightningMax', input.resistancePenalty),
    chaos: ci ? { value: 100, max: 100, uncapped: 100 } : resist('chaosRes', 'chaosMax', 0),
    spirit: Math.max(Math.round(spirit), 0),
  };
  return { ...sheet, derived: computeDerived(input, sheet, { flatOf, incOf, moreOf }) };
}

/** Sum of one kind for one pool. `withSlots` false skips slot-tagged contributions. */
function sum(list: readonly Contribution[], pool: Pool, kind: Contribution['kind'], withSlots: boolean): number {
  let total = 0;
  for (const c of list) {
    if (c.pool === pool && c.kind === kind && Number.isFinite(c.value) && (withSlots || c.slot === undefined)) total += c.value;
  }
  return total;
}

function sumSlot(list: readonly Contribution[], pool: Pool, kind: Contribution['kind'], slot: GearSlot): number {
  let total = 0;
  for (const c of list) if (c.pool === pool && c.kind === kind && c.slot === slot && Number.isFinite(c.value)) total += c.value;
  return total;
}

function product(list: readonly Contribution[], pool: Pool): number {
  let total = 1;
  for (const c of list) if (c.pool === pool && c.kind === 'more' && Number.isFinite(c.value)) total *= 1 + c.value / 100;
  return total;
}

/** Slots whose item carries a flat of this pool: the items whose own defence a slot increase can scale. */
function slotsOf(list: readonly Contribution[], pool: Pool): Set<GearSlot> {
  const out = new Set<GearSlot>();
  for (const c of list) if (c.pool === pool && c.kind === 'flat' && c.slot !== undefined) out.add(c.slot);
  return out;
}

// =============================================================================
// Derived stats. The default enemy is PoB's: ConfigOptions.lua:1982-2057 defaults "Is the enemy a Boss?" to
// Guardian/Pinnacle (defaultIndex 3), whose level is 82 (:2046-2049), whose elemental penetration is
// data.misc.pinnacleBossPen = 3 (Data.lua:298) and whose Accuracy is monsterAccuracyTable[level]
// (CalcSetup.lua:1029). Failure modes, decided before the code:
//   1. The Configuration is absent: nothing is ticked (no Blind), the same answer PoB gives an empty Config.
//   2. An immunity (Chaos Inoculation's 100% chaos resistance) makes the hit pool unreachable: Infinity, which the
//      oracle maps to PoB's 2147483647.
//   3. Armour 0 takes the simple branch of CalcDefence.lua:3711 (no quadratic, no floor), as PoB does.
//   4. A stat none of our contributions feed (no source modelled yet) reads as its base value, never NaN.
// Not modelled (each would move a number, so a miss in the oracle's gaps is expected there): block and
// suppression, Mind over Matter, "damage taken" modifiers, take-as conversion, charge-count scaling mods.
// =============================================================================

const ENEMY_LEVEL = 82; // ConfigOptions.lua:2046-2049 (Pinnacle default)
const ENEMY_ELEMENTAL_PEN = 3; // Data.lua:298 pinnacleBossPen = 15 / 5
const ARMOUR_RATIO = 10; // Data.lua:261
const DAMAGE_REDUCTION_CAP = 90; // Data.lua:246, characterConstants maximum_physical_damage_reduction_%
const EVADE_CHANCE_CAP = 95; // Data.lua:250, gameConstants DefaultMaxEvadeChancePercent
const DEFLECTION_CHANCE_CAP = 95; // Data.lua:251
const BASE_DEFLECT_EFFECT = 40; // Data.lua:256, gameConstants BasePercentDamageDeflected
const MANA_REGEN_BASE = 0.04; // characterConstants character_inherent_mana_regeneration_rate_per_minute_% 240 / 60 / 100
const ES_RECHARGE_BASE = 0.125; // energy_shield_recharge_rate_per_minute_% 750 / 60 / 100
const ES_RECHARGE_DELAY = 4; // Data.lua:265
const PINNACLE_DPS_MULT = 8 / 4.4; // Misc.lua pinnacleBossDPSMult
const ENEMY_CRIT_CHANCE = 5; // ConfigOptions.lua:1985 placeholder
const ENEMY_CRIT_DAMAGE = 30; // monsterConstants base_critical_hit_damage_bonus
const EHP_SPEEDUP = 8; // Misc.lua ehpCalcSpeedUp
const EHP_MAX_ITERATIONS = 50; // Misc.lua ehpCalcMaxIterationsToCalc
const EHP_MAX_DAMAGE = 100000000; // Misc.lua ehpCalcMaxDamage
const BASE_CHARGES = 3; // characterConstants max_*_charges

/** CalcDefence.lua:41-47 (round half up, clamped 5..100). */
export function monsterHitChance(evasion: number, accuracy: number): number {
  if (accuracy < 0) return 5;
  const raw = (1 - (0.95 * evasion) / (evasion + 4 * accuracy)) * 100;
  return Math.max(Math.min(Math.round(raw), 100), 5);
}

/** CalcDefence.lua:49-55. */
export function deflectChanceOf(deflection: number, accuracy: number): number {
  if (deflection < 1) return 0;
  const chanceToNotDeflect = (accuracy / (accuracy + deflection * 0.12)) * 150 - 50;
  return Math.max(Math.min(100 - Math.round(chanceToNotDeflect), DEFLECTION_CHANCE_CAP), 0);
}

interface DeriveHelpers {
  flatOf(pool: Pool): number;
  incOf(pool: Pool): number;
  moreOf(pool: Pool): number;
}

function computeDerived(input: EngineInput, sheet: Omit<DefenceSheet, 'derived'>, h: DeriveHelpers): DerivedStats {
  const { flatOf, incOf, moreOf } = h;
  const tables = monsterTables as unknown as { monsterAccuracyTable: number[] };

  // Enemy Accuracy: the level-82 table entry; a Blinded enemy has m_floor(-20 x (1 + Blind effect)) % more
  // (CalcPerform.lua:744-753 for the player's own Blind; the enemy side follows the same -20% base).
  let accuracy = tables.monsterAccuracyTable[ENEMY_LEVEL - 1] ?? 0;
  if (input.config?.conditions.includes('EnemyBlinded')) {
    accuracy *= 1 + Math.floor(-20 * (1 + incOf('blindEffect') / 100)) / 100;
  }
  accuracy = Math.round(accuracy);

  // Evade chance: CalcDefence.lua:1512, 1524 (no "chance to evade" base or Unlucky modelled).
  const evadeChance = Math.min(100 - monsterHitChance(sheet.evasion, accuracy), EVADE_CHANCE_CAP);

  // Deflection: CalcDefence.lua:1565-1566; the displayed rating is truncated (PoB shows %d).
  const deflectionRaw =
    flatOf('deflection') +
    ((sheet.evasion * flatOf('evasionToDeflection')) / 100 + (sheet.armour * flatOf('armourToDeflection')) / 100) * (1 + incOf('deflection') / 100) * moreOf('deflection');
  const deflectChance = deflectChanceOf(deflectionRaw, accuracy);

  // Runic Ward: base from the Runeforged bases, scaled by Ward's and the global "Defences" increases
  // (CalcDefence.lua:1224, 1306-1311, 1475). poe.ninja shows it truncated (item base Ward is level-scaled, so PoB's own
  // total is a fraction short of the rounded sum: 155 x 1.45 = 224.75 prints 224).
  const ward = Math.max(Math.floor(flatOf('ward') * (1 + (incOf('ward') + incOf('defences')) / 100) * moreOf('ward')), 0);

  // Life regeneration: (flat + % of maximum Life) x (1 + inc) x more, one decimal (CalcDefence.lua:1722-1736).
  const lifeRegen = Math.floor(Math.round(((flatOf('lifeRegen') + (sheet.life * flatOf('lifeRegenPercent')) / 100) * (1 + incOf('lifeRegen') / 100) * moreOf('lifeRegen')) * 10) / 10);

  // Mana regeneration: the inherent 4% of maximum Mana per second (characterConstants, Data.lua:263), scaled by the
  // increased regeneration rate (CalcDefence.lua:1722-1736).
  const manaRegen = Math.floor(Math.round(((sheet.mana * MANA_REGEN_BASE) / 1 + flatOf('manaRegen')) * (1 + incOf('manaRegen') / 100) * moreOf('manaRegen') * 10) / 10);

  // Energy Shield recharge: 12.5% of maximum ES per second (Data.lua:264) x (1 + inc) x more, one decimal, and a
  // 4 second start (Data.lua:265) divided by (1 + faster start) (CalcDefence.lua:1796-1838).
  const esRecharge = sheet.energyShield > 0 ? Math.floor(Math.round(sheet.energyShield * ES_RECHARGE_BASE * (1 + incOf('esRecharge') / 100) * moreOf('esRecharge') * 10) / 10) : 0;
  const esRechargeDelay = Math.round((ES_RECHARGE_DELAY + flatOf('esRechargeFaster')) / (1 + incOf('esRechargeFaster') / 100) * 10000) / 10000;

  // Movement speed: (1 + BASE) x (1 + inc) x more, three decimals of the multiplier (CalcDefence.lua:1926).
  const movementSpeed = Math.floor(Math.round((1 + flatOf('movementSpeed') / 100) * (1 + incOf('movementSpeed') / 100) * moreOf('movementSpeed') * 1000) / 10);

  const charges = (pool: Pool) => Math.max(BASE_CHARGES + flatOf(pool), 0);

  // Maximum hit: CalcDefence.lua:3595-3760, solved in reverse from the hit pool.
  const life = input.flags.chaosInoculation === true ? 1 : sheet.life;
  // Mind over Matter (:2947-2991): MoM% of damage comes off Mana first, so Life behaves as life / (1 - MoM) until the
  // Mana that backs it runs out. Harmony Within's flag is a full 100% while Mana exceeds Life (30904).
  const momOf = (type: HitType) => {
    // Eldritch Battery: the Mana it converts to is the pool the oracle build's hits come off (5175 + 1 Life = 5176).
    const harmony = input.flags.eldritchBattery === true || (flatOf('momHarmony') > 0 && sheet.mana > life) ? 100 : 0;
    const elemental = type === 'fire' || type === 'cold' || type === 'lightning' ? flatOf('momElemental') : 0;
    return Math.min(flatOf('mom') + elemental + harmony, 100);
  };
  const effectiveLife = (type: HitType) => {
    const mom = momOf(type);
    if (mom <= 0) return life;
    if (mom >= 100) return life + sheet.mana;
    const protectedLife = (sheet.mana / (mom / 100)) * (1 - mom / 100);
    return Math.max(life - protectedLife, 0) + Math.min(life, protectedLife) / (1 - mom / 100);
  };
  const hitPoolOf = (type: HitType) => effectiveLife(type) + sheet.energyShield / (type === 'chaos' ? 2 : 1) + ward; // :3199-3217, 3587
  const resistOf = (type: HitType) => (type === 'physical' ? 0 : sheet[type].value);
  const armourPercent = (type: HitType) => (type === 'physical' ? 100 : 0) + flatOf(type === 'physical' ? 'armourToPhysical' : (`armourTo${type[0].toUpperCase()}${type.slice(1)}` as Pool));
  const maxHit = {} as Record<HitType, number>;
  for (const type of ['physical', 'fire', 'cold', 'lightning', 'chaos'] as const) {
    const res = resistOf(type);
    const pen = type === 'fire' || type === 'cold' || type === 'lightning' ? ENEMY_ELEMENTAL_PEN : 0;
    const resMult = 1 - (res > 0 ? Math.max(res - pen, 0) : res) / 100; // :2575
    if (resMult <= 0) {
      maxHit[type] = Infinity;
      continue;
    }
    const pool = hitPoolOf(type);
    const applied = (sheet.armour * armourPercent(type)) / 100 + (type === 'physical' ? (sheet.energyShield * flatOf('esToPhysical')) / 100 : 0); // :2563-2577
    const flatDR = type === 'physical' ? Math.min(flatOf('physReduction'), DAMAGE_REDUCTION_CAP) / 100 : 0;
    if (applied <= 0) {
      maxHit[type] = Math.round(pool / (resMult * (1 - flatDR)));
      continue;
    }
    const hp = pool / resMult;
    const oneMinus = 1 - flatDR;
    const a = ARMOUR_RATIO * oneMinus;
    const b = applied * oneMinus - applied - hp * ARMOUR_RATIO;
    const c = -hp * applied;
    const raw = (Math.sqrt(Math.max(b * b - 4 * a * c, 0)) - b) / (2 * a);
    const noDR = pool / resMult;
    const maxDR = noDR / (1 - DAMAGE_REDUCTION_CAP / 100);
    maxHit[type] = Math.round(Math.floor(Math.max(Math.min(raw, maxDR), noDR)));
  }

  // Effective health pool: CalcDefence.lua:3232-3416. Every hit is the default enemy's, one of each type per hit (the
  // "Average" damage-type setting), reduced by resistance, armour and flat reduction, then thinned by deflection; the
  // pools are drained in PoB's order until Life is gone, and evasion multiplies the hits that land by 1/(1 - evade).
  function effectiveHealthPoolOf(): number {
    const types = ['physical', 'fire', 'cold', 'lightning', 'chaos'] as const;
    const table = (monsterTables as unknown as { monsterDamageTable: number[] }).monsterDamageTable;
    const base = Math.round((table[ENEMY_LEVEL - 1] ?? 0) * 1.5 * PINNACLE_DPS_MULT); // ConfigOptions.lua:2084
    const enemyDamage: Record<HitType, number> = { physical: base, fire: base, cold: base, lightning: base, chaos: Math.round(base / 2.5) };
    let critChance = Math.max(Math.min(ENEMY_CRIT_CHANCE * (1 + incOf('enemyCrit') / 100) * (1 - evadeChance / 100), 100), 0); // :2283
    if (flatOf('unluckyCrit') > 0) critChance = (critChance / 100) * critChance; // :2284-2286
    const critEffect = 1 + (critChance / 100) * (ENEMY_CRIT_DAMAGE / 100) * (1 - Math.min(flatOf('critReduce'), 100) / 100); // :2289
    const deflectMulti = deflectChance < 100 ? 1 - (deflectChance * BASE_DEFLECT_EFFECT) / 10000 : 1; // :3278
    const damageIn = {} as Record<HitType, number>;
    for (const type of types) {
      const damage = enemyDamage[type] * critEffect;
      const res = resistOf(type);
      const pen = type === 'fire' || type === 'cold' || type === 'lightning' ? ENEMY_ELEMENTAL_PEN : 0;
      const resMult = Math.max(1 - (res > 0 ? Math.max(res - pen, 0) : res) / 100, 0);
      const applied = (sheet.armour * armourPercent(type)) / 100 + (type === 'physical' ? (sheet.energyShield * flatOf('esToPhysical')) / 100 : 0);
      const flatDR = type === 'physical' ? Math.min(flatOf('physReduction'), DAMAGE_REDUCTION_CAP) : 0;
      const armourReduct = applied > 0 ? Math.min(DAMAGE_REDUCTION_CAP, Math.round((applied / (applied + damage * ARMOUR_RATIO)) * 100)) : 0; // :56-72, 2594
      const reductMult = 1 - Math.max(Math.min(DAMAGE_REDUCTION_CAP, armourReduct + flatDR), 0) / 100;
      damageIn[type] = damage * resMult * reductMult * deflectMulti;
    }
    const hits = hitsToDie({ life, mana: sheet.mana, energyShield: sheet.energyShield, ward }, damageIn, momOf);
    if (!Number.isFinite(hits)) return Infinity;
    const total = hits / (1 - evadeChance / 100);
    return Math.floor(total * types.reduce((n, t) => n + enemyDamage[t], 0));
  }

  return {
    enemyAccuracy: accuracy,
    evadeChance,
    deflectionRating: Math.floor(deflectionRaw),
    deflectChance,
    deflectEffect: BASE_DEFLECT_EFFECT,
    ward,
    lifeRegen,
    manaRegen,
    esRecharge,
    esRechargeDelay,
    movementSpeed,
    enduranceCharges: charges('maxEndurance'),
    frenzyCharges: charges('maxFrenzy'),
    powerCharges: charges('maxPower'),
    effectiveHealthPool: effectiveHealthPoolOf(),
    maxHit,
  };
}

interface HitPools {
  life: number;
  mana: number;
  energyShield: number;
  ward: number;
}

/**
 * CalcDefence.lua:473-700 (reducePoolsByDamage) for the pools this engine has: Energy Shield first (Chaos takes it at
 * double), then the Mana Mind over Matter sends damage to, then Life down to 1, Runic Ward, and the last point of Life.
 * Chaos is reduced first, Physical last (PoB walks dmgTypeList backwards). Returns the pools left and the overkill.
 */
function reducePools(pools: HitPools, damage: Partial<Record<HitType, number>>, momOf: (t: HitType) => number): HitPools & { overkill: number } {
  let { life, mana, energyShield, ward } = pools;
  let overkill = 0;
  for (const type of ['chaos', 'fire', 'cold', 'lightning', 'physical'] as const) {
    let remainder = damage[type];
    if (remainder === undefined || remainder <= 0) continue;
    const esMult = type === 'chaos' ? 2 : 1;
    if (energyShield > 0) {
      const taken = Math.min(remainder, energyShield / esMult);
      energyShield -= taken * esMult;
      remainder -= taken;
    }
    const momEffect = momOf(type) / 100;
    if (momEffect > 0 && mana > 0) {
      const momPool = momEffect < 1 ? Math.min(life / (1 - momEffect) - life, mana) : mana;
      const taken = Math.min(remainder * momEffect, momPool);
      mana -= taken;
      remainder -= taken;
    }
    if (life > 0) {
      let taken = Math.min(remainder, life - 1);
      life -= taken;
      remainder -= taken;
      if (ward > 0) {
        taken = Math.min(remainder, ward);
        ward -= taken;
        remainder -= taken;
      }
      if (remainder > 0) {
        taken = Math.min(remainder, life);
        life -= taken;
        remainder -= taken;
      }
    }
    overkill += remainder;
  }
  return { life, mana, energyShield, ward, overkill };
}

/**
 * CalcDefence.lua:2040-2224 (numberOfHitsToDie): hits of damageIn the pools survive. PoB speeds the walk up by
 * running eight hits at once and recursing, which is why the answer is not simply pool / damage; this follows its
 * control flow so the same rounding falls out. Runic Ward only protects the first hit (cycles > 1 drops it).
 */
function hitsToDie(start: HitPools, damageIn: Record<HitType, number>, momOf: (t: HitType) => number): number {
  const types = ['physical', 'fire', 'cold', 'lightning', 'chaos'] as const;
  const run = (damage: Record<HitType, number>, cycles: number, state: { iterations: number }): number => {
    if (types.every((t) => damage[t] === 0)) return Infinity;
    let pools: HitPools = { ...start, ward: cycles > 1 ? 0 : start.ward };
    let numHits = 0;
    let overkill = 0;
    let multiplier = 1;
    let cyclesRan = false;
    const damageTotal = types.reduce((n, t) => n + damage[t], 0);
    while (pools.life > 0 && state.iterations < EHP_MAX_ITERATIONS) {
      state.iterations++;
      const dmg: Partial<Record<HitType, number>> = {};
      for (const t of types) if (damage[t] > 0) dmg[t] = damage[t] * multiplier;
      const reduced = reducePools(pools, dmg, momOf);
      pools = reduced;
      overkill = reduced.overkill;
      if (pools.life > 0 && damageTotal >= EHP_MAX_DAMAGE) return Infinity;
      multiplier = 1;
      if (!cyclesRan && pools.life > 0 && state.iterations < EHP_MAX_ITERATIONS) {
        const sped = Object.fromEntries(types.map((t) => [t, damage[t] * EHP_SPEEDUP])) as Record<HitType, number>;
        const inner = run(sped, cycles * EHP_SPEEDUP, state);
        multiplier = Math.max((inner - 1) * EHP_SPEEDUP - 1, 1);
        if (multiplier === Infinity) return Infinity;
        cyclesRan = true;
      }
      numHits += multiplier;
    }
    if (pools.life === 0 && cycles === 1) numHits -= overkill / damageTotal;
    if (pools.life >= 0 && damageTotal * numHits >= EHP_MAX_DAMAGE) return Infinity;
    if (Number.isNaN(numHits)) return 0;
    return Math.max(numHits, 0);
  };
  return run(damageIn, 1, { iterations: 0 });
}
