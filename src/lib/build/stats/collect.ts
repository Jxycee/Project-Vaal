// src/lib/build/stats/collect.ts
// =============================================================================
// Tree + gear + campaign -> the contributions the engine sums, for ONE weapon
// set (Slice 5). Pure; the caller supplies node, item and mod data.
//
// The rule that matters most here: anything that could change a reported
// defence but is not counted is NAMED in `notCounted`, and anything counted
// on an assumption is named in `assumed`. A sheet must never be quietly short.
//
// Items follow PoB2's item formula (src/Classes/Item.lua:2586-2590, MIT,
// Copyright (c) 2016 David Gowor): an item's own Armour / Evasion / Energy
// Shield is round((base + local flat) x (1 + local increased/100) x
// (1 + quality/100)), and that is what reaches the character. When the tree
// says "Cannot gain Spirit from Equipment", every Spirit an item grants is
// dropped, as PoB2 does (src/Modules/CalcSetup.lua:1470-1476, 1684).
// Flasks and charms are left out: their stats apply while used, not always.
// =============================================================================

import type { AttributeChoice } from '@poe2-toolkit/tree-core';
import type { CraftedMod } from '../craft';
import { GEAR_SLOTS, type GearItem, type GearSlot } from '../gearSlots';
import type { GearState } from '../gearState';
import type { PassiveState } from '../types';
import { campaignAt } from './campaign';
import type { Contribution } from './engine';
import { GLOBAL_EFFECTS, LOCAL_EFFECTS, NOT_MODELLED, type Pool } from './statTable';

/**
 * Embrace the Darkness: "You have no Spirit". Its typed stats (base_darkness
 * …) do not carry that line, so the node itself is the flag. Pinned by name
 * and text in __tests__/collect.data.test.ts.
 */
export const NO_SPIRIT_NODE = 41076;
/** "+5 to any Attribute" — the text of all 293 generic attribute nodes (checked 2026-09-25). */
const GENERIC_ATTRIBUTE_AMOUNT = 5;

export interface CollectData {
  node(id: number): { name: string; stats: [string, number][]; attribute?: boolean } | undefined;
  item(slug: string): { armour: { armour: number; evasion: number; energyShield: number } | null; spirit: number; implicits?: [string, number, number][][] } | undefined;
  mod(slug: string): { stat: string; min: number; max: number }[] | undefined;
  /**
   * A unique by name: the slug of its base (for base defences) and its lines,
   * each with the stat ids unique-stats.json typed it to (null = untyped).
   */
  unique(name: string, slug: string): { baseSlug: string; lines: { text: string; stats: string[] | null }[] } | undefined;
}

/** Words that mark a line as touching a defence the sheet reports — an untyped one is named. */
const DEFENCE_WORDS = /Life|Mana|Energy Shield|Armour|Evasion|Resistance|Strength|Dexterity|Intelligence|Attributes|Spirit/;
/** A number in a line: a "(a-b)" range, or a fixed number. */
const NUMBER_TOKEN = /\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)|(-?\d+(?:\.\d+)?)/g;

export interface Collected {
  contributions: Contribution[];
  flags: { giantsBlood: boolean; lordOfTheWilds: boolean; noSpirit: boolean; noSpiritFromEquipment: boolean };
  resistancePenalty: number;
  act: string;
  notCounted: string[];
  assumed: string[];
}

const NOT_ON_CHARACTER: ReadonlySet<GearSlot> = new Set(['flask1', 'flask2', 'charm1', 'charm2', 'charm3']);
const ATTRIBUTE_POOL: Record<AttributeChoice, Pool> = { str: 'str', dex: 'dex', int: 'int' };

export function collectContributions(
  input: { passive: PassiveState; gear: GearState; level: number; set: 1 | 2 },
  data: CollectData,
): Collected {
  const contributions: Contribution[] = [];
  const notCounted: string[] = [];
  const assumed: string[] = [];
  const flags = { giantsBlood: false, lordOfTheWilds: false, noSpirit: false, noSpiritFromEquipment: false };

  // ---- Tree: this set's nodes (shared ones are in both lists) and the ascendancy.
  const nodes = new Set([...(input.set === 1 ? input.passive.set1 : input.passive.set2), ...input.passive.ascendancyNodes]);
  let unchosen = 0;
  for (const id of nodes) {
    const node = data.node(id);
    if (!node) continue;
    if (id === NO_SPIRIT_NODE) flags.noSpirit = true;
    if (node.attribute) {
      const choice = input.passive.attributeChoices?.[String(id)];
      if (choice) contributions.push({ pool: ATTRIBUTE_POOL[choice], kind: 'flat', value: GENERIC_ATTRIBUTE_AMOUNT, source: 'Attribute passive' });
      else unchosen++;
      continue;
    }
    for (const [stat, value] of node.stats) {
      if (stat === 'keystone_giants_blood') flags.giantsBlood = true;
      else if (stat === 'keystone_lord_of_the_wilds') flags.lordOfTheWilds = true;
      else if (stat === 'cannot_gain_spirit_from_equipment') flags.noSpiritFromEquipment = true;
      addGlobal(contributions, notCounted, stat, value, node.name);
    }
  }
  if (unchosen > 0) {
    notCounted.push(`${unchosen} "+5 to any Attribute" ${unchosen === 1 ? 'passive has' : 'passives have'} no attribute chosen`);
  }

  // ---- Gear: every slot but the other set's weapons, flasks and charms; jewels whose socket is allocated here.
  const otherSet: ReadonlySet<GearSlot> = new Set(input.set === 1 ? ['weapon2_main', 'weapon2_off'] : ['weapon1_main', 'weapon1_off']);
  const equipped: GearItem[] = [];
  for (const slot of GEAR_SLOTS) {
    const item = input.gear[slot];
    if (item && !otherSet.has(slot) && !NOT_ON_CHARACTER.has(slot)) equipped.push(item);
  }
  for (const [socket, jewel] of Object.entries(input.gear.jewels)) {
    if (nodes.has(Number(socket))) equipped.push(jewel);
  }
  for (const item of equipped) collectItem(item, data, flags, contributions, notCounted, assumed);

  // ---- Campaign, derived from the level.
  const campaign = campaignAt(input.level);
  for (const r of campaign.rewards) addGlobal(contributions, notCounted, r.stat, r.value, r.source);
  if (campaign.choiceRewardsNotCounted.length > 0) {
    notCounted.push(`Quest rewards you choose: ${campaign.choiceRewardsNotCounted.join(', ')}`);
  }

  return { contributions, flags, resistancePenalty: campaign.resistancePenalty, act: campaign.act, notCounted, assumed };
}

function addGlobal(out: Contribution[], notCounted: string[], stat: string, value: number, source: string): void {
  const effects = GLOBAL_EFFECTS[stat];
  if (effects) for (const e of effects) out.push({ pool: e.pool, kind: e.kind, value, source });
  else if (NOT_MODELLED[stat]) notCounted.push(`${source}: ${NOT_MODELLED[stat]}`);
}

function collectItem(
  item: GearItem,
  data: CollectData,
  flags: Collected['flags'],
  contributions: Contribution[],
  notCounted: string[],
  assumed: string[],
): void {
  const craft = item.craft;
  const stats: [string, number][] = [];
  let detail: ReturnType<CollectData['item']>;

  if (item.isUnique) {
    const unique = data.unique(item.name, item.slug);
    detail = unique ? data.item(unique.baseSlug) : undefined;
    if (!unique || !detail) {
      notCounted.push(`${item.name}: unique — not in our data`);
      return;
    }
    let assumedRoll = false;
    unique.lines.forEach((line, i) => {
      const row = craft?.uniqueValues[i] ?? [];
      const values: number[] = [];
      let range = 0;
      for (const m of line.text.matchAll(NUMBER_TOKEN)) {
        if (m[3] !== undefined) {
          values.push(Number(m[3]));
          continue;
        }
        const chosen = row[range++];
        if (chosen === undefined) assumedRoll = true;
        values.push(chosen ?? (Number(m[1]) + Number(m[2])) / 2);
      }
      if (!line.stats || line.stats.length !== values.length) {
        if (DEFENCE_WORDS.test(line.text)) notCounted.push(`${item.name}: "${line.text}" not counted`);
        return;
      }
      line.stats.forEach((stat, k) => stats.push([stat, values[k]]));
    });
    if (assumedRoll) assumed.push(`${item.name}: unique rolls at mid-roll`);
  } else {
    detail = data.item(item.slug);
    if (!detail) {
      notCounted.push(`${item.name}: not in our item data`);
      return;
    }
  }

  // Implicits: typed per implicit mod; a chosen value per range where the
  // counts line up, otherwise mid-roll — and say so.
  const implicitRolls = item.isUnique ? [] : (detail.implicits ?? []).flat();
  if (implicitRolls.length > 0) {
    const chosen = (craft?.implicitValues ?? []).flat();
    if (chosen.length === implicitRolls.length) implicitRolls.forEach(([stat], i) => stats.push([stat, chosen[i]]));
    else {
      implicitRolls.forEach(([stat, min, max]) => stats.push([stat, (min + max) / 2]));
      assumed.push(`${item.name}: implicit at mid-roll`);
    }
  }

  for (const affix of [...(craft?.prefixes ?? []), ...(craft?.suffixes ?? [])] as CraftedMod[]) {
    const rolls = data.mod(affix.slug);
    if (!rolls) {
      notCounted.push(`${item.name}: mod "${affix.slug}" is not in our data`);
      continue;
    }
    rolls.forEach((roll, i) => {
      if (i < affix.values.length) stats.push([roll.stat, affix.values[i]]);
    });
  }
  if ((craft?.runes.length ?? 0) > 0) {
    const n = craft!.runes.length;
    notCounted.push(`${item.name}: ${n} ${n === 1 ? 'rune' : 'runes'} not counted`);
  }

  // Local stats shape the item's own defences and Spirit; the rest are global.
  const localFlat: Partial<Record<Pool, number>> = {};
  const localInc: Partial<Record<Pool, number>> = {};
  for (const [stat, value] of stats) {
    const local = LOCAL_EFFECTS[stat];
    if (local) {
      for (const e of local) {
        const bucket = e.kind === 'flat' ? localFlat : localInc;
        bucket[e.pool] = (bucket[e.pool] ?? 0) + value;
      }
    } else {
      addGlobal(contributions, notCounted, stat, value, item.name);
    }
  }

  const quality = craft?.quality ?? 0;
  const itemDefence = (pool: Pool, base: number) =>
    Math.round((base + (localFlat[pool] ?? 0)) * (1 + (localInc[pool] ?? 0) / 100) * (1 + quality / 100));
  const armour = detail.armour;
  for (const [pool, base] of [
    ['armour', armour?.armour ?? 0],
    ['evasion', armour?.evasion ?? 0],
    ['energyShield', armour?.energyShield ?? 0],
  ] as const) {
    const value = itemDefence(pool, base);
    if (value !== 0) contributions.push({ pool, kind: 'flat', value, source: item.name });
  }
  if (detail.spirit > 0) {
    contributions.push({ pool: 'spirit', kind: 'flat', value: Math.round(detail.spirit * (1 + (localInc.spirit ?? 0) / 100)), source: item.name });
  }

  if (flags.noSpiritFromEquipment) {
    for (let i = contributions.length - 1; i >= 0; i--) {
      const c = contributions[i];
      if (c.source === item.name && c.pool === 'spirit' && c.kind === 'flat') contributions.splice(i, 1);
    }
  }
}
