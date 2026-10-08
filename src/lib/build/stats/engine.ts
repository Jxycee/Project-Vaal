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
// One deliberate difference: PoB2 floors Spirit at 1 (the same CalcDefence.lua:96
// loop); a PoE2 character with no Spirit source has 0, so this floors at 0.
// "More" multipliers are modelled per pool (kind 'more') and by the two named flags.
// =============================================================================

import type { GearSlot } from '../gearSlots';
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
  };
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
  const mana = Math.max(Math.round(scaled(4 * level + 30 + int * 2 + flatOf('mana'), 'mana')), 1);

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

  return {
    str,
    dex,
    int,
    life,
    mana,
    energyShield: defence('energyShield'),
    armour: defence('armour'),
    evasion: defence('evasion', 7),
    fire: resist('fireRes', 'fireMax', input.resistancePenalty),
    cold: resist('coldRes', 'coldMax', input.resistancePenalty),
    lightning: resist('lightningRes', 'lightningMax', input.resistancePenalty),
    chaos: ci ? { value: 100, max: 100, uncapped: 100 } : resist('chaosRes', 'chaosMax', 0),
    spirit: Math.max(Math.round(spirit), 0),
  };
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
