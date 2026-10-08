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
// Runes follow PoB2 Item.lua:2179-2198 per item type, see runes.ts.
// A stat id the table does not know is not dropped silently: if it looks like it
// could move a reported number (statTable.ts looksLikeDefenceStat) it is named
// in `notCounted` by id, once, with every source that carries it.
// =============================================================================

import type { AttributeChoice } from '@poe2-toolkit/tree-core';
import type { CraftedMod } from '../craft';
import { GEAR_SLOTS, type GearItem, type GearSlot } from '../gearSlots';
import type { GearState } from '../gearState';
import type { PassiveState } from '../types';
import { campaignAt } from './campaign';
import { DEFENCE_WORDS, implicitStats } from './implicits';
import { readLine } from './lineMods';
import { categoryApplies, isKnownCategory, readRuneLine } from './runes';
import type { Contribution } from './engine';
import { GLOBAL_EFFECTS, LOCAL_EFFECTS, looksLikeDefenceStat, NOT_MODELLED, PER_ITEM_DEFENCE, type PerItemDefence, type Pool } from './statTable';

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
  /**
   * The one passive with this exact name, for "Allocates <name>" enchants. undefined when the name is
   * unknown or shared by several passives (never a guess). Optional: without it such an enchant is named, not counted.
   */
  nodeByName?(name: string): number | undefined;
  item(slug: string):
    | {
        armour: { armour: number; evasion: number; energyShield: number } | null;
        spirit: number;
        implicits?: [string, number, number][][];
        /** The item file's implicit display lines — what `implicits` describes. */
        implicitLines?: string[];
        /** The item file's `itemClass`, and whether it carries weapon data: where a rune's effect applies (runes.ts). */
        itemClass?: string | null;
        weapon?: boolean;
      }
    | undefined;
  /**
   * A rune or soul core by item slug: its effect lines per equipment category
   * (the wiki's `soulCoreEffects`). Optional: without it runes are named, not counted.
   */
  rune?(slug: string): { name: string; effects: { category: string; lines: string[] }[] } | undefined;
  mod(slug: string): { stat: string; min: number; max: number }[] | undefined;
  /**
   * A unique by name: the slug of its base (for base defences) and its lines,
   * each with the stat ids unique-stats.json typed it to (null = untyped),
   * and its own implicit display lines (craft.implicitValues is indexed by them).
   */
  unique(name: string, slug: string): { baseSlug: string; lines: { text: string; stats: string[] | null }[]; implicitLines?: string[] } | undefined;
}

/** A number in a line: a "(a-b)" range, or a fixed number. */
const NUMBER_TOKEN = /\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)|(-?\d+(?:\.\d+)?)/g;

export interface Collected {
  contributions: Contribution[];
  flags: { giantsBlood: boolean; lordOfTheWilds: boolean; noSpirit: boolean; noSpiritFromEquipment: boolean; chaosInoculation: boolean };
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
  const unknown = new Map<string, Set<string>>();
  const assumed: string[] = [];
  const flags = { giantsBlood: false, lordOfTheWilds: false, noSpirit: false, noSpiritFromEquipment: false, chaosInoculation: false };

  // ---- Tree: this set's nodes (shared ones are in both lists) and the ascendancy.
  const nodes = new Set([...(input.set === 1 ? input.passive.set1 : input.passive.set2), ...input.passive.ascendancyNodes]);
  let unchosen = 0;
  /** Passives that scale off an item's own defence: resolved once every item is read (statTable PER_ITEM_DEFENCE). */
  const perItem: { rule: PerItemDefence; value: number; source: string }[] = [];
  const addNode = (id: number): void => {
    const node = data.node(id);
    if (!node) return;
    if (id === NO_SPIRIT_NODE) flags.noSpirit = true;
    if (node.attribute) {
      const choice = input.passive.attributeChoices?.[String(id)];
      if (choice) contributions.push({ pool: ATTRIBUTE_POOL[choice], kind: 'flat', value: GENERIC_ATTRIBUTE_AMOUNT, source: 'Attribute passive' });
      else unchosen++;
      return;
    }
    for (const [stat, value] of node.stats) {
      if (stat === 'keystone_giants_blood') flags.giantsBlood = true;
      else if (stat === 'keystone_lord_of_the_wilds') flags.lordOfTheWilds = true;
      else if (stat === 'keystone_chaos_inoculation') flags.chaosInoculation = true;
      else if (stat === 'cannot_gain_spirit_from_equipment') flags.noSpiritFromEquipment = true;
      if (PER_ITEM_DEFENCE[stat]) perItem.push({ rule: PER_ITEM_DEFENCE[stat], value, source: node.name });
      else addGlobal(contributions, notCounted, unknown, stat, value, node.name);
    }
  };
  for (const id of nodes) addNode(id);
  /** "Allocates <passive>" on an item: that passive's stats, unless the tree already allocates it (PoB counts it once). */
  const allocate = (name: string): void => {
    const id = data.nodeByName?.(name);
    if (id === undefined) notCounted.push(`Allocates ${name}: passive not found by name, so it was not counted`);
    else if (!nodes.has(id)) {
      nodes.add(id);
      addNode(id);
    }
  };
  if (unchosen > 0) {
    notCounted.push(`${unchosen} "+5 to any Attribute" ${unchosen === 1 ? 'passive has' : 'passives have'} no attribute chosen`);
  }

  // ---- Gear: every slot but the other set's weapons, flasks and charms; jewels whose socket is allocated here.
  const otherSet: ReadonlySet<GearSlot> = new Set(input.set === 1 ? ['weapon2_main', 'weapon2_off'] : ['weapon1_main', 'weapon1_off']);
  const equipped: { item: GearItem; slot?: GearSlot }[] = [];
  for (const slot of GEAR_SLOTS) {
    const item = input.gear[slot];
    if (item && !otherSet.has(slot) && !NOT_ON_CHARACTER.has(slot)) equipped.push({ item, slot });
  }
  for (const [socket, jewel] of Object.entries(input.gear.jewels)) {
    if (nodes.has(Number(socket))) equipped.push({ item: jewel });
  }
  for (const { item, slot } of equipped) collectItem(item, slot, data, flags, contributions, notCounted, unknown, assumed, allocate);

  // ---- Passives that scale off an item's defence, now that every item's own figure is known. An empty slot
  // is 0 steps. PoB floors the step count (PerStat tag, ModStore.lua).
  for (const { rule, value, source } of perItem) {
    const have = contributions.filter((c) => c.slot === rule.slot && c.pool === rule.from && c.kind === 'flat').reduce((n, c) => n + c.value, 0);
    const [amount, div] = rule.valueIs === 'amount' ? [value, rule.fixed] : [rule.fixed, value];
    const steps = div > 0 ? Math.floor(have / div) : 0;
    if (steps * amount !== 0) {
      contributions.push({ pool: rule.pool, kind: 'flat', value: steps * amount, source });
    }
  }

  // ---- Campaign, derived from the level.
  const campaign = campaignAt(input.level, input.passive.questChoices);
  for (const r of [...campaign.rewards, ...campaign.choiceRewards]) addGlobal(contributions, notCounted, unknown, r.stat, r.value, r.source);
  notCounted.push(...campaign.choiceRewardsUnmodelled);
  if (campaign.choiceRewardsNotCounted.length > 0) {
    notCounted.push(`Quest rewards you choose: ${campaign.choiceRewardsNotCounted.join(', ')}`);
  }

  for (const [stat, sources] of unknown) notCounted.push(`Unrecognised stat ${stat} (${[...sources].join(', ')})`);

  return { contributions, flags, resistancePenalty: campaign.resistancePenalty, act: campaign.act, notCounted, assumed };
}

function addGlobal(out: Contribution[], notCounted: string[], unknown: Map<string, Set<string>>, stat: string, value: number, source: string): void {
  const effects = GLOBAL_EFFECTS[stat];
  if (effects) {
    for (const e of effects) out.push({ pool: e.pool, kind: e.kind, value, source, ...(e.slot ? { slot: e.slot } : {}) });
  } else if (NOT_MODELLED[stat]) {
    notCounted.push(`${source}: ${NOT_MODELLED[stat]}`);
  } else if (!LOCAL_EFFECTS[stat] && looksLikeDefenceStat(stat)) {
    unknown.set(stat, (unknown.get(stat) ?? new Set<string>()).add(source));
  }
}

function collectItem(
  item: GearItem,
  slot: GearSlot | undefined,
  data: CollectData,
  flags: Collected['flags'],
  contributions: Contribution[],
  notCounted: string[],
  unknown: Map<string, Set<string>>,
  assumed: string[],
  allocate: (name: string) => void,
): void {
  const craft = item.craft;
  const stats: [string, number][] = [];
  let detail: ReturnType<CollectData['item']>;
  /** A unique's own implicit lines; undefined for a base (it shows its own). */
  let wornImplicitLines: string[] | undefined;

  if (item.isUnique) {
    const unique = data.unique(item.name, item.slug);
    detail = unique ? data.item(unique.baseSlug) : undefined;
    wornImplicitLines = unique?.implicitLines ?? [];
    if (!unique || !detail) {
      notCounted.push(`${item.name}: unique — not in our data`);
      // Its lines as the importer kept them still count, as global modifiers (no base to scale locally).
      readVerbatim(craft?.verbatim, item.name, { defences: false, spirit: false }, {}, {}, contributions, notCounted, allocate);
      return;
    }
    // Lines typed to exactly the same stats are one roll's alternatives, which
    // our data lists side by side (Sunsplinter's six "+N% to Maximum Fire
    // Resistance" lines; Guiding Palm; The Unborn Lich — every repeat in the
    // data, checked 2026-09-26). A real item has one of them and nothing says
    // which, so none is counted and the sheet names them. Summing them gave
    // Sunsplinter +87% maximum resistances.
    const statKey = (stats: string[] | null) => (stats ? stats.join('+') : null);
    const seen = new Map<string, number>();
    for (const line of unique.lines) {
      const key = statKey(line.stats);
      if (key !== null) seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    const alternatives = new Map<string, string[]>();
    let assumedRoll = false;
    unique.lines.forEach((line, i) => {
      const key = statKey(line.stats);
      if (key !== null && (seen.get(key) ?? 0) > 1) {
        alternatives.set(key, [...(alternatives.get(key) ?? []), line.text]);
        return;
      }
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
    for (const texts of alternatives.values()) {
      notCounted.push(`${item.name}: rolls one of ${texts.map((t) => `"${t}"`).join(' / ')} — not counted`);
    }
    if (assumedRoll) assumed.push(`${item.name}: unique rolls at mid-roll`);
  } else {
    detail = data.item(item.slug);
    if (!detail) {
      notCounted.push(`${item.name}: not in our item data`);
      return;
    }
  }

  // Implicits: a unique carries its base's, read at the unique's own line
  // index; chosen values where they pair with a typed stat, else mid-roll —
  // and say so. See implicits.ts.
  const baseLines = detail.implicitLines ?? [];
  const implicits = implicitStats(detail.implicits, baseLines, wornImplicitLines ?? baseLines, craft?.implicitValues ?? []);
  stats.push(...implicits.stats);
  if (implicits.assumedMidRoll) assumed.push(`${item.name}: implicit at mid-roll`);
  for (const line of implicits.uncoveredLines) notCounted.push(`${item.name}: implicit "${line}" not counted`);

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
  // Runes: each one's effect for THIS item's type, as typed stats the local /
  // global split below reads (runes.ts). A rune we have no data for is named.
  const host = { itemClass: detail.itemClass ?? null, weapon: detail.weapon ?? false, armour: detail.armour !== null };
  let runesUnread = 0;
  for (const slug of craft?.runes ?? []) {
    const rune = data.rune?.(slug);
    if (!rune) {
      runesUnread++;
      continue;
    }
    for (const effect of rune.effects) {
      if (!isKnownCategory(effect.category)) {
        notCounted.push(`${item.name}: rune "${rune.name}" has an equipment category this builder does not recognise ("${effect.category}"), so it was not counted`);
        continue;
      }
      if (!categoryApplies(effect.category, host)) continue;
      for (const line of effect.lines) {
        const read = readRuneLine(line);
        if (read === null) continue;
        if ('unmodelled' in read) notCounted.push(`${item.name}: rune line "${read.unmodelled}" not counted`);
        else stats.push([read.stat, read.value]);
      }
    }
  }
  if (runesUnread > 0) notCounted.push(`${item.name}: ${runesUnread} ${runesUnread === 1 ? 'rune' : 'runes'} not counted`);

  // Local stats shape the item's own defences and Spirit; the rest are global.
  const localFlat: Partial<Record<Pool, number>> = {};
  const localInc: Partial<Record<Pool, number>> = {};
  readVerbatim(craft?.verbatim, item.name, { defences: detail.armour !== null, spirit: detail.spirit > 0 }, localFlat, localInc, contributions, notCounted, allocate);
  for (const [stat, value] of stats) {
    const local = LOCAL_EFFECTS[stat];
    if (local) {
      for (const e of local) {
        const bucket = e.kind === 'flat' ? localFlat : localInc;
        bucket[e.pool] = (bucket[e.pool] ?? 0) + value;
      }
    } else {
      addGlobal(contributions, notCounted, unknown, stat, value, item.name);
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
    if (value !== 0) contributions.push({ pool, kind: 'flat', value, source: item.name, ...(slot ? { slot } : {}) });
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

/**
 * Lines the importer kept as written (ItemCraft.verbatim), read by PoB's own parse of their text
 * (lineMods.ts). A defence line on an item that has its own defences (or Spirit) and that PoB does not tag
 * Global is LOCAL: it scales that item's base, as the wiki-typed `local_*` stats do. Everything else is global.
 * Unreadable lines are named, never dropped.
 */
function readVerbatim(
  lines: readonly string[] | undefined,
  source: string,
  host: { defences: boolean; spirit: boolean },
  localFlat: Partial<Record<Pool, number>>,
  localInc: Partial<Record<Pool, number>>,
  contributions: Contribution[],
  notCounted: string[],
  allocate: (name: string) => void,
): void {
  for (const line of lines ?? []) {
    const allocates = /^Allocates (.+)$/.exec(line);
    if (allocates) {
      allocate(allocates[1]);
      continue;
    }
    const read = readLine(line);
    if (read === null) continue;
    if ('unmodelled' in read) {
      notCounted.push(`${source}: "${read.unmodelled}" not counted`);
      continue;
    }
    for (const mod of read.mods) {
      const defence = mod.pool === 'armour' || mod.pool === 'evasion' || mod.pool === 'energyShield';
      const local = !read.global && mod.kind !== 'more' && ((host.defences && defence) || (host.spirit && mod.pool === 'spirit' && mod.kind === 'increased'));
      if (local) {
        const bucket = mod.kind === 'flat' ? localFlat : localInc;
        bucket[mod.pool] = (bucket[mod.pool] ?? 0) + mod.value;
      } else {
        contributions.push({ pool: mod.pool, kind: mod.kind, value: mod.value, source });
      }
    }
  }
}
