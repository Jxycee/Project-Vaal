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
//   Life/Mana round((base) x (1 + inc/100)), >= 1        CalcDefence.lua:96
//   Armour/Evasion/ES round(x), >= 0                     CalcDefence.lua:1446-1455
//   resist max = 75 + mods, <= 90; totals truncated; final = min(total, max)
//                                  CalcSetup.lua:27-30, CalcDefence.lua:945-966
//   elemental penalty BASE (default -60)                 CalcSetup.lua:965-967
//
// One deliberate difference: PoB2 floors Spirit at 1 (the same CalcDefence.lua:96
// loop); a PoE2 character with no Spirit source has 0, so this floors at 0.
// "More" multipliers are not modelled apart from the two named flags.
// =============================================================================

import type { Pool } from './statTable';

export interface Contribution {
  pool: Pool;
  kind: 'flat' | 'increased';
  value: number;
  /** Where it came from, for the sheet's breakdown ("Candlemass (Ogham Manor)", "Amethyst Ring"). */
  source: string;
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
  const flatOf = (pool: Pool) => sum(input.contributions, pool, 'flat');
  const incOf = (pool: Pool) => sum(input.contributions, pool, 'increased');
  const scaled = (base: number, pool: Pool) => base * (1 + incOf(pool) / 100);

  const str = Math.max(Math.round(scaled(input.classBase.str + flatOf('str'), 'str')), 0);
  const dex = Math.max(Math.round(scaled(input.classBase.dex + flatOf('dex'), 'dex')), 0);
  const int = Math.max(Math.round(scaled(input.classBase.int + flatOf('int'), 'int')), 0);

  const lifePerStr = input.flags.giantsBlood ? 1 : 2;
  const life = Math.max(Math.round(scaled(12 * level + 16 + str * lifePerStr + flatOf('life'), 'life')), 1);
  const mana = Math.max(Math.round(scaled(4 * level + 30 + int * 2 + flatOf('mana'), 'mana')), 1);

  const defence = (pool: Pool, base = 0) => Math.max(Math.round(scaled(base + flatOf(pool), pool)), 0);

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
    chaos: resist('chaosRes', 'chaosMax', 0),
    spirit: Math.max(Math.round(spirit), 0),
  };
}

function sum(list: readonly Contribution[], pool: Pool, kind: Contribution['kind']): number {
  let total = 0;
  for (const c of list) if (c.pool === pool && c.kind === kind && Number.isFinite(c.value)) total += c.value;
  return total;
}
