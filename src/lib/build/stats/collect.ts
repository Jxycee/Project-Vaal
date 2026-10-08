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
//
// Conditional modifiers ("40% increased Evasion Rating while moving"): counted only when the build's Path of
// Building Configuration (PassiveState.buildConfig, buildConfig.ts) has the condition true; with no Configuration
// at all they are named in `notCounted`. Failure modes are listed in buildConfig.ts.
// =============================================================================

import type { AttributeChoice } from '@poe2-toolkit/tree-core';
import type { CraftedMod } from '../craft';
import { GEAR_SLOTS, RING_SLOT_3_NODE, type GearItem, type GearSlot } from '../gearSlots';
import type { GearState } from '../gearState';
import type { GemState } from '../gemState';
import { conditionHolds, type BuildConfig } from './buildConfig';
import { skillBuffContributions } from './skillBuffs';
import type { PassiveState } from '../types';
import { campaignAt } from './campaign';
import { DEFENCE_WORDS, implicitStats } from './implicits';
import { isLegacyLine, LEGACY_EFFECT_LINE, legacyContributions } from './legacies';
import { RADIUS_GRANT_LINE, readLine, readLocalDefenceLine, type LineMod } from './lineMods';
import type { JewelRadiusNode } from '@/lib/tree/treeLite';
import { categoryApplies, isKnownCategory, readRuneLine } from './runes';
import type { Contribution } from './engine';
import { CONDITIONAL_EFFECTS, GLOBAL_EFFECTS, LOCAL_EFFECTS, looksLikeDefenceStat, NOT_MODELLED, PER_ITEM_DEFENCE, SUPPORT_THRESHOLD, type PerItemDefence, type Pool } from './statTable';
import supportColours from '@/lib/pob/data/support-colours.json';

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
        armour: { armour: number; evasion: number; energyShield: number; ward?: number } | null;
        /** The armour base's movement speed penalty as a fraction (0.03 = 3% slower), 0 for none (base-movement-penalty.json). */
        movementPenalty?: number;
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
   * The notables and smalls near a jewel socket, with their distance from it (treeLite.ts). undefined = the tree
   * positions are not loaded, so a radius jewel is named, not counted.
   */
  radiusNodes?(socket: number): JewelRadiusNode[] | undefined;
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
  flags: { giantsBlood: boolean; lordOfTheWilds: boolean; noSpirit: boolean; noSpiritFromEquipment: boolean; chaosInoculation: boolean; eldritchBattery: boolean };
  resistancePenalty: number;
  act: string;
  notCounted: string[];
  assumed: string[];
}

const NOT_ON_CHARACTER: ReadonlySet<GearSlot> = new Set(['flask1', 'flask2', 'charm1', 'charm2', 'charm3']);
const ATTRIBUTE_POOL: Record<AttributeChoice, Pool> = { str: 'str', dex: 'dex', int: 'int' };

export function collectContributions(
  input: { passive: PassiveState; gear: GearState; level: number; set: 1 | 2; gems?: GemState },
  data: CollectData,
): Collected {
  const contributions: Contribution[] = [];
  const notCounted: string[] = [];
  const unknown = new Map<string, Set<string>>();
  const assumed: string[] = [];
  const config = input.passive.buildConfig;
  const flags = { giantsBlood: false, lordOfTheWilds: false, noSpirit: false, noSpiritFromEquipment: false, chaosInoculation: false, eldritchBattery: false };

  // ---- Tree: this set's nodes (shared ones are in both lists) and the ascendancy.
  const nodes = new Set([...(input.set === 1 ? input.passive.set1 : input.passive.set2), ...input.passive.ascendancyNodes]);
  let unchosen = 0;
  /** Passives that scale off an item's own defence: resolved once every item is read (statTable PER_ITEM_DEFENCE). */
  const perItem: { rule: PerItemDefence; value: number; source: string }[] = [];
  /** Passives that need N support gems of a colour (statTable SUPPORT_THRESHOLD): resolved once the gems are read. */
  const needsSupports: { stat: string; value: number; source: string }[] = [];
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
      else if (stat === 'keystone_eldritch_battery') flags.eldritchBattery = true;
      else if (stat === 'cannot_gain_spirit_from_equipment') flags.noSpiritFromEquipment = true;
      if (SUPPORT_THRESHOLD[stat]) needsSupports.push({ stat, value, source: node.name });
      else if (PER_ITEM_DEFENCE[stat]) perItem.push({ rule: PER_ITEM_DEFENCE[stat], value, source: node.name });
      else addGlobal(contributions, notCounted, unknown, stat, value, node.name, config);
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
  const equipped: { item: GearItem; slot?: GearSlot; socket?: number }[] = [];
  for (const slot of GEAR_SLOTS) {
    const item = input.gear[slot];
    // The third ring exists only while "Unfurled Finger" (+1 Ring Slot) is allocated; PoB wears nothing in a slot it lacks.
    if (item && slot === 'ring3' && !nodes.has(RING_SLOT_3_NODE)) {
      notCounted.push(`${item.name}: in Ring 3, but the "Unfurled Finger" passive that opens a third ring slot is not allocated, so it was not counted`);
      continue;
    }
    if (item && !otherSet.has(slot) && !NOT_ON_CHARACTER.has(slot)) equipped.push({ item, slot });
  }
  for (const [socket, jewel] of Object.entries(input.gear.jewels)) {
    if (nodes.has(Number(socket))) equipped.push({ item: jewel, socket: Number(socket) });
  }
  const wornAt = new Map<GearSlot, { from: number; to: number; name: string }>();
  // Gear-counted multipliers (lineMods.ts GEAR_MULTIPLIERS): PoB adds Multiplier:GrandSpectrum 1 per Grand Spectrum worn.
  const gearCounts: Record<string, number> = {
    GrandSpectrum: equipped.filter((e) => e.item.name.includes('Grand Spectrum')).length,
    CorruptedItem: corruptedItemCount(equipped),
  };
  /** Radius jewels wait until every item has allocated what it grants (Megalomaniac's "Allocates X"): PoB counts a node in the radius however it was allocated. */
  const radiusJewels: { item: GearItem; socket: number }[] = [];
  for (const { item, slot, socket } of equipped) {
    const from = contributions.length;
    collectItem(item, slot, data, flags, contributions, notCounted, unknown, assumed, allocate, config, gearCounts);
    if (socket !== undefined) radiusJewels.push({ item, socket });
    if (slot) wornAt.set(slot, { from, to: contributions.length, name: item.name });
  }
  for (const { item, socket } of radiusJewels) radiusGrants(item, socket, nodes, data, contributions, notCounted, config);
  // "N% increased ... from Equipped Shield" carries PoB's Condition UsingShield: a focus in the same off-hand slot
  // is not a shield, so the increase must not scale its Energy Shield. Dropped when the slot's item is another class.
  for (let i = contributions.length - 1; i >= 0; i--) {
    const c = contributions[i];
    if (!c.itemClass || !c.slot) continue;
    const worn = input.gear[c.slot];
    const unique = worn?.isUnique ? data.unique(worn.name, worn.slug) : undefined;
    const base = !worn ? undefined : unique ? ((worn.craft?.baseSlug ? data.item(worn.craft.baseSlug) : undefined) ?? data.item(unique.baseSlug)) : data.item(worn.slug);
    if (base?.itemClass !== c.itemClass) contributions.splice(i, 1);
  }
  reflectOppositeRing(wornAt, contributions);
  bonusEffectFromJewellery(wornAt, contributions);

  // ---- Passives that scale off an item's defence, now that every item's own figure is known. An empty slot
  // is 0 steps. PoB floors the step count (PerStat tag, ModStore.lua).
  for (const { rule, value, source } of perItem) {
    const have = contributions.filter((c) => c.slot === rule.slot && c.pool === rule.from && c.kind === 'flat').reduce((n, c) => n + c.value, 0);
    const [amount, div] = rule.valueIs === 'amount' ? [value, rule.fixed] : [rule.fixed, value];
    // PercentStat: floor(figure x percent / 100) Life, one each.
    const steps = rule.valueIs === 'percent' ? Math.floor((have * value) / 100) : div > 0 ? Math.floor(have / div) : 0;
    if (steps * amount !== 0) {
      contributions.push({ pool: rule.pool, kind: 'flat', value: steps * amount, source });
    }
  }

  // ---- Passives that count support gems by colour (Gem Enthusiast). PoB counts every enabled support in the skills of
  // the active weapon set; a gem of no colour (a unique support, "w") is none of the three.
  if (needsSupports.length > 0) {
    const count = { r: 0, g: 0, b: 0 };
    for (const loadout of input.gems?.loadouts ?? []) {
      if (!loadout.sets.includes(input.set)) continue;
      for (const support of loadout.supports) {
        const colour = (supportColours as Record<string, string>)[support.name];
        if (colour === 'r' || colour === 'g' || colour === 'b') count[colour]++;
      }
    }
    for (const { stat, value, source } of needsSupports) {
      const rule = SUPPORT_THRESHOLD[stat];
      if (count[rule.colour] >= rule.atLeast) contributions.push({ pool: rule.pool, kind: 'increased', value, source });
    }
  }

  // ---- Skill-granted buffs (Auras): once every "increased Aura magnitudes" is known (skillBuffs.ts).
  const buffs = skillBuffContributions(
    input.gems,
    input.set,
    contributions.filter((c) => c.pool === 'auraEffect' && c.kind === 'increased').reduce((n, c) => n + c.value, 0),
    config,
  );
  contributions.push(...buffs.contributions);
  notCounted.push(...buffs.notCounted);
  if (buffs.counted.length > 0) {
    assumed.push(`${buffs.counted.join(', ')}: read at the gem's own level; "+N to Level of all skills" from gear is not modelled`);
  }

  // ---- Campaign, derived from the level.
  const campaign = campaignAt(input.level, input.passive.questChoices, config?.questsOff);
  for (const r of [...campaign.rewards, ...campaign.choiceRewards]) addGlobal(contributions, notCounted, unknown, r.stat, r.value, r.source, config);
  notCounted.push(...campaign.choiceRewardsUnmodelled);
  if (campaign.choiceRewardsNotCounted.length > 0) {
    notCounted.push(`Quest rewards you choose: ${campaign.choiceRewardsNotCounted.join(', ')}`);
  }

  for (const [stat, sources] of unknown) notCounted.push(`Unrecognised stat ${stat} (${[...sources].join(', ')})`);

  return { contributions, flags, resistancePenalty: campaign.resistancePenalty, act: campaign.act, notCounted, assumed };
}

/**
 * Time-Lost jewels: "Notable Passive Skills in Radius also grant 3% increased Global Armour, Evasion and Energy
 * Shield" gives that line once for EACH allocated notable (or small) within the jewel's radius. PoB2 does it per
 * node (ModParser.lua:7170 adds the parsed mod to the node's own list), which is why its breakdown lists the
 * modifier seven times for seven notables: one contribution per node here too.
 *
 * Radius: the importer keeps the jewel's label ("Very Large", craft.radius). Fixed rings are PoB2's Data.lua
 * jewelRadii "0_1": Small 1000, Medium 1150, Large 1300, Very Large 1500, each x PassiveTreeJewelDistanceMultiplier
 * (1.2, misc-constants.json gameConstants), measured socket to node, inner edge 0, inclusive (PassiveTree.lua).
 *
 * Failure modes, decided before the code:
 *   1. No radius label, or a "Variable" one (a ring with an inner edge): the jewel is named, not guessed at.
 *   2. Tree positions not loaded (a lite.json older than jewelRadius): named, not counted.
 *   3. Nothing allocated in the radius: no contribution, and no note (a real zero).
 *   4. The granted line is an offence line: the importer never keeps it (mapCraft keepVerbatim), so it is not here.
 *   5. The granted line is a defence line PoB parses with a condition or scaling: named.
 *   6. The jewel's socket is not allocated: never reaches here (the jewel is not worn).
 *   8. Another item allocates a passive inside the radius (Megalomaniac's "Allocates X") and sits in a later socket:
 *      radius jewels are measured after every item is read, so the order of sockets never changes the count.
 *   7. Attribute passives, keystones, masteries, sockets and blighted nodes are in neither set (treeLite.ts).
 */
const RADIUS_OUTER: Readonly<Record<string, number>> = { Small: 1000, Medium: 1150, Large: 1300, 'Very Large': 1500 };
const JEWEL_DISTANCE_MULTIPLIER = 1.2;

function radiusGrants(
  item: GearItem,
  socket: number,
  allocated: ReadonlySet<number>,
  data: CollectData,
  contributions: Contribution[],
  notCounted: string[],
  config: BuildConfig | undefined,
): void {
  const grants = (item.craft?.verbatim ?? []).map((l) => RADIUS_GRANT_LINE.exec(l)).filter((m): m is RegExpExecArray => m !== null);
  if (grants.length === 0) return;
  const outer = RADIUS_OUTER[item.craft?.radius ?? ''];
  if (outer === undefined) {
    notCounted.push(`${item.name}: its radius (${item.craft?.radius ?? 'not stated'}) is not one this builder measures, so its "also grant" lines were not counted`);
    return;
  }
  const near = data.radiusNodes?.(socket);
  if (!near) {
    notCounted.push(`${item.name}: the tree positions are not loaded, so its "also grant" lines were not counted`);
    return;
  }
  const limit = outer * JEWEL_DISTANCE_MULTIPLIER;
  for (const [, type, inner] of grants) {
    const kind = type === 'Notable' ? 0 : 1;
    const reached = near.filter(([id, distance, k]) => k === kind && distance <= limit && allocated.has(id)).length;
    const read = readLine(inner);
    if (read === null) continue;
    if ('unmodelled' in read) {
      notCounted.push(`${item.name}: "${read.unmodelled}" (granted to ${type.toLowerCase()} passives in its radius) not counted`);
      continue;
    }
    const counted = gate(read.mods, config, inner, item.name, notCounted);
    for (let i = 0; i < reached; i++) {
      for (const mod of counted) contributions.push({ pool: mod.pool, kind: mod.kind, value: mod.value, source: item.name });
    }
  }
}

/**
 * Kalandra's Touch: "Reflects opposite Ring" (PoB2 uniques.json lists it as the only item with that line,
 * pinned in __tests__/collect.reflect.test.ts). It wears a COPY of the other ring's modifiers, implicit
 * included: PoB's breakdown for the oracle build counts Soul Circle's +198 mana and both of its 7% increased
 * maximum Mana lines a second time under "Kalandra's Touch", and its +16% to all Elemental Resistances too.
 *
 * Failure modes, decided before the code:
 *   1. The opposite ring slot is empty: nothing to reflect, nothing added.
 *   2. Both rings are Kalandra's Touch: each would reflect the other; PoB has nothing to copy, so neither does.
 *   3. The opposite ring is a unique our data lacks: it contributes only what the importer kept, and the copy
 *      carries exactly that (never more than the original).
 *   4. Passives an item grants ("Allocates X") are NOT the ring's modifiers: only contributions sourced by
 *      the other ring's own name are copied, so a granted node is not counted twice.
 *   5. A rare ring named like the unique: the name is checked on the equipped item, not on the lines.
 */
export const MIRROR_RING_NAMES: ReadonlySet<string> = new Set(["Kalandra's Touch"]);

/**
 * Multiplier:CorruptedItem (CalcSetup.lua 1640-1711): one for each corrupted item in a gear slot, plus the corrupted
 * jewels in allocated sockets (ordinary-life-1: body, gloves, boots, ring + 3 jewels = 7), and Kalandra's Touch swaps its
 * own corruption for the opposite ring's (it does not count itself, it counts the ring it copies): +1 = PoB's 8.
 */
function corruptedItemCount(equipped: readonly { item: GearItem; slot?: GearSlot }[]): number {
  const corrupted = (item: GearItem | undefined) => item?.craft?.corrupted === true;
  let count = equipped.filter((e) => corrupted(e.item)).length;
  for (const [slot, other] of [['ring1', 'ring2'], ['ring2', 'ring1']] as const) {
    const ring = equipped.find((e) => e.slot === slot);
    if (!ring?.item.name.includes("Kalandra's Touch")) continue;
    const opposite = equipped.find((e) => e.slot === other)?.item;
    if (corrupted(ring.item)) count--;
    if (opposite && !opposite.name.includes("Kalandra's Touch") && corrupted(opposite)) count++;
  }
  return count;
}

function reflectOppositeRing(wornAt: ReadonlyMap<GearSlot, { from: number; to: number; name: string }>, contributions: Contribution[]): void {
  const rings: GearSlot[] = ['ring1', 'ring2'];
  for (const slot of rings) {
    const mirror = wornAt.get(slot);
    const other = wornAt.get(slot === 'ring1' ? 'ring2' : 'ring1');
    if (!mirror || !other || !MIRROR_RING_NAMES.has(mirror.name) || MIRROR_RING_NAMES.has(other.name)) continue;
    const copied = contributions.slice(other.from, other.to).filter((c) => c.source === other.name);
    for (const c of copied) contributions.push({ ...c, source: mirror.name });
  }
}

/**
 * "N% increased bonuses gained from Equipped Rings and Amulets" (Mystic Attunement, 25%): PoB2 adds a SECOND, scaled
 * copy of the worn item's modifiers, value x N/100 (CalcSetup.lua:1814 for the Amulet, CalcPerform.lua:1491 for each
 * Ring). Its breakdown lists them as "Many Sources: 25% Ring 1 Bonus Effect".
 *
 * Failure modes, decided before the code:
 *   1. No "increased bonuses" on the sheet (the normal case): nothing is copied, nothing is named.
 *   2. The slot is empty, or holds an item our data lacks: it has no contributions, so the copy is empty.
 *   3. Only the item's own modifiers are scaled (contributions sourced by its name): a passive an item grants
 *      ("Allocates Battle Trance") is not the item's modifier and is never scaled.
 *   4. A Ring's flat and increased modifiers of one kind and pool are summed before scaling (PoB groups them by key);
 *      the Amulet's are scaled one by one. A scaled value is floored to a whole number (verified: 10 x 25% = 2, 106 x 25% = 26, 57 x 25% = 14 in PoB's breakdown).
 *   5. The item's local base defences (its slot-tagged contributions) are not modifiers: rings and amulets have none.
 *   6. A reduction (a negative total) scales to nothing: PoB clamps the scale at 0.
 *   7. Kalandra's Touch wears the opposite ring: the copy is of that ring's modifiers, as the reflection is.
 */
const EFFECT_POOLS = {
  ring1: 'effectRing1',
  ring2: 'effectRing2',
  ring3: 'effectRing3',
  amulet: 'effectAmulet',
} as const;
const EFFECT_LABEL = { ring1: 'Ring 1', ring2: 'Ring 2', ring3: 'Ring 3', amulet: 'Amulet' } as const;

function bonusEffectFromJewellery(wornAt: ReadonlyMap<GearSlot, { from: number; to: number; name: string }>, contributions: Contribution[]): void {
  const added: Contribution[] = [];
  for (const slot of Object.keys(EFFECT_POOLS) as (keyof typeof EFFECT_POOLS)[]) {
    const percent = contributions.filter((c) => c.pool === EFFECT_POOLS[slot] && c.kind === 'increased').reduce((n, c) => n + c.value, 0);
    const scale = Math.max(percent, 0) / 100;
    if (scale === 0) continue;
    let worn = wornAt.get(slot);
    if (worn && MIRROR_RING_NAMES.has(worn.name)) worn = wornAt.get(slot === 'ring1' ? 'ring2' : 'ring1');
    if (!worn) continue;
    const source = `Many Sources: ${percent}% ${EFFECT_LABEL[slot]} Bonus Effect`;
    const mods = contributions.slice(worn.from, worn.to).filter((c) => c.source === worn!.name && !c.slot && !(c.pool in EFFECT_POOLS_BY_NAME));
    const floored = (value: number) => Math.floor(value * scale);
    if (slot === 'amulet') {
      for (const c of mods) added.push({ pool: c.pool, kind: c.kind, value: floored(c.value), source });
    } else {
      const grouped = new Map<string, Contribution>();
      for (const c of mods) {
        const key = `${c.pool}|${c.kind}`;
        const have = grouped.get(key);
        if (have) have.value += c.value;
        else grouped.set(key, { pool: c.pool, kind: c.kind, value: c.value, source });
      }
      for (const c of grouped.values()) added.push({ ...c, value: floored(c.value) });
    }
  }
  contributions.push(...added);
}
const EFFECT_POOLS_BY_NAME: Readonly<Record<string, true>> = { effectRing1: true, effectRing2: true, effectRing3: true, effectAmulet: true };

/**
 * The modifiers of one line that count under this Configuration: unconditional ones always; a conditional one when
 * its condition holds. Configuration absent = unknown: the line is named once and none of its conditional mods count.
 */
function gate(mods: readonly LineMod[], config: BuildConfig | undefined, line: string, source: string, notCounted: string[]): LineMod[] {
  const kept: LineMod[] = [];
  let named = false;
  for (const mod of mods) {
    const holds = mod.condition ? conditionHolds(config, mod.condition.name, mod.condition.negate) : true;
    if (holds === true) kept.push(mod);
    else if (holds === undefined && !named) {
      named = true;
      notCounted.push(`${source}: "${line}" needs ${mod.condition!.negate ? 'not ' : ''}${mod.condition!.name} (a Path of Building configuration setting), so it was not counted`);
    }
  }
  return kept;
}

function addGlobal(
  out: Contribution[],
  notCounted: string[],
  unknown: Map<string, Set<string>>,
  stat: string,
  value: number,
  source: string,
  config: BuildConfig | undefined,
): void {
  const conditional = CONDITIONAL_EFFECTS[stat];
  if (conditional) {
    const holds = conditionHolds(config, conditional.condition, conditional.negate);
    if (holds === true) for (const e of conditional.effects) out.push({ pool: e.pool, kind: e.kind, value, source, ...(e.slot ? { slot: e.slot } : {}), ...(e.itemClass ? { itemClass: e.itemClass } : {}) });
    else if (holds === undefined) {
      notCounted.push(`${source}: ${stat} needs ${conditional.negate ? 'not ' : ''}${conditional.condition} (a Path of Building configuration setting), so it was not counted`);
    }
    return;
  }
  const effects = GLOBAL_EFFECTS[stat];
  if (effects) {
    for (const e of effects) out.push({ pool: e.pool, kind: e.kind, value: value * (e.scale ?? 1), source, ...(e.slot ? { slot: e.slot } : {}), ...(e.itemClass ? { itemClass: e.itemClass } : {}) });
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
  config: BuildConfig | undefined,
  gearCounts: Readonly<Record<string, number>>,
): void {
  const craft = item.craft;
  const stats: [string, number][] = [];
  let detail: ReturnType<CollectData['item']>;
  /** A unique's own implicit lines; undefined for a base (it shows its own). */
  let wornImplicitLines: string[] | undefined;
  /** A unique's lines our data has no typed stat for, numbers filled in: read from their text below. */
  const untypedLines: string[] = [];
  /** 1 + the item's "N% increased effect of Socketed Runes" (Runeseeker's Call 200% -> 3): how much a printed rune line was scaled. */
  let runeEffect = 1;

  if (item.isUnique) {
    const unique = data.unique(item.name, item.slug);
    // The base PoB printed wins over the wiki's listed one: Alpha's Howl on a Runemastered Armoured Cap has 178 base
    // Evasion + 113 Ward where plain Armoured Cap has 296 (the importer keeps that base in craft.baseSlug).
    detail = unique ? ((craft?.baseSlug ? data.item(craft.baseSlug) : undefined) ?? data.item(unique.baseSlug)) : undefined;
    wornImplicitLines = unique?.implicitLines ?? [];
    if (!unique || !detail) {
      notCounted.push(`${item.name}: unique — not in our data`);
      // Its lines as the importer kept them still count, as global modifiers (no base to scale locally).
      readVerbatim(craft?.verbatim, item.name, { defences: false, spirit: false }, {}, {}, contributions, notCounted, allocate, config, { sockets: filledSockets(craft), gear: gearCounts });
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
    // Mageblood: the wiki lists all 14 legacies as sentences, the item wears a few by name (kept verbatim,
    // every copy). PoB builds their modifiers by name and duplicate count: legacies.ts.
    let legacyEffect: number | undefined;
    unique.lines.forEach((line, i) => {
      const socketed = /^\(?(\d+(?:\.\d+)?)(?:-(\d+(?:\.\d+)?)\))?% increased effect of Socketed (?:Runes|Augment Items|Soul Cores)/i.exec(line.text.trim());
      if (socketed) {
        const rolled = socketed[2] !== undefined ? craft?.uniqueValues[i]?.[0] : undefined;
        runeEffect += (rolled ?? (socketed[2] !== undefined ? (Number(socketed[1]) + Number(socketed[2])) / 2 : Number(socketed[1]))) / 100;
      }
      const effectLine = LEGACY_EFFECT_LINE.exec(line.text);
      if (effectLine) {
        const row = craft?.uniqueValues[i] ?? [];
        legacyEffect = row[0] ?? (effectLine[3] !== undefined ? Number(effectLine[3]) : (Number(effectLine[1]) + Number(effectLine[2])) / 2);
      }
    });
    const worn = (craft?.verbatim ?? []).filter(isLegacyLine);
    if (worn.length > 0) {
      const unknownLegacies: string[] = [];
      contributions.push(...legacyContributions(worn, legacyEffect, item.name, unknownLegacies));
      for (const name of unknownLegacies) notCounted.push(`${item.name}: Legacy of ${name} is not in this builder's legacy table, so it was not counted`);
    }
    unique.lines.forEach((line, i) => {
      if (worn.length > 0 && (/^Legacy of \w+ /.test(line.text) || LEGACY_EFFECT_LINE.test(line.text))) return;
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
        // No typed stat for this line (Andvarius's "-20% to all Elemental Resistances"): its text is still what
        // PoB parses, so it is read the way a verbatim line is (lineMods.ts) instead of being dropped.
        // A line PoB's parse has no flat reading for stays named, never silently dropped.
        if (DEFENCE_WORDS.test(line.text)) {
          const text = resolveLine(line.text, values);
          if (readLine(text) === null) notCounted.push(`${item.name}: "${line.text}" not counted`);
          else untypedLines.push(text);
        }
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
  // On an item with armour data a rune's flat "+N to maximum Energy Shield" is the item's OWN Energy Shield (it takes the
  // item's increases and quality: Morior Invictus (50 + 10) x 5.66 x 1.2 = 408); Spirit on an item with Spirit is local too.
  const runeStat = (stat: string) =>
    stat === 'spirit_+%' && detail.spirit > 0 ? 'local_spirit_+%' : stat === 'base_maximum_energy_shield' && detail.armour !== null ? 'local_energy_shield' : stat;
  // PoB's own printed rune lines are its answer for the sockets (effect of Socketed Augment Items, bonded rules and
  // its rune data already applied): they replace the recomputation from rune slugs below. A line is a typed
  // defence stat the same way a data line is, so "increased Armour, Evasion and Energy Shield" stays LOCAL.
  const printedRunes = craft?.runeLines;
  // A printed line our typed table (runes.ts) cannot type is read the way PoB parses ANY modifier line (lineMods.ts):
  // "Aura Skills have 25% increased Magnitudes" (Kraken Bane), "45% less maximum Life" (Runeseeker's Call), "1% increased
  // maximum Life for each Corrupted Item Equipped" (Morior Invictus). They count like the item's other verbatim lines.
  const runeVerbatim: string[] = [];
  // FAILURE MODE: "200% increased effect of Socketed Runes" (Runeseeker's Call) prints a rune's "15% less maximum Life" as ONE
  // "45% less" line, but PoB2 keeps the rune's own mod AND an extra mod for the added effect (-15 and -30). Two lesses multiply
  // (0.85 x 0.70 = 0.595 -> 0.60), one 45% less does not (0.55): Life 904 instead of 987. Flat and increased lines add, so
  // splitting them changes nothing; only a "more"/"less" line is split, and only when the scale divides it evenly.
  for (const l of craft?.verbatim ?? []) {
    const m = /^(\d+(?:\.\d+)?)% increased effect of Socketed (?:Runes|Augment Items|Soul Cores)\b/i.exec(l.trim());
    if (m) runeEffect += Number(m[1]) / 100;
  }
  const splitRuneMore = (line: string): string[] => {
    const read = runeEffect > 1 ? readLine(line) : null;
    if (read === null || 'unmodelled' in read || !read.mods.every((x) => x.kind === 'more')) return [line];
    const n = Number(line.match(/\d+(?:\.\d+)?/)?.[0]);
    const base = Math.round((n / runeEffect) * 100) / 100;
    if (!Number.isFinite(n) || base <= 0 || base >= n || Math.abs(base * runeEffect - n) > 0.01) return [line];
    const extra = Math.round((n - base) * 100) / 100;
    return [line.replace(/\d+(?:\.\d+)?/, String(base)), line.replace(/\d+(?:\.\d+)?/, String(extra))];
  };
  for (const line of printedRunes ?? []) {
    const read = readRuneLine(line);
    if (read !== null && 'stat' in read) {
      stats.push([runeStat(read.stat), read.value]);
      continue;
    }
    if (!/^Bonded:/i.test(line) && readLine(line) !== null) {
      runeVerbatim.push(...splitRuneMore(line));
      continue;
    }
    if (read !== null) notCounted.push(`${item.name}: rune line "${read.unmodelled}" not counted`);
  }
  for (const slug of printedRunes ? [] : (craft?.runes ?? [])) {
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
        // "15% increased Spirit" on an item that has Spirit of its own (a sceptre, a body armour) is LOCAL in PoB2:
        // the item's Spirit becomes round(base x 1.15), as the oracle's Palm of the Dreamer shows (100 -> 115).
        else stats.push([runeStat(read.stat), read.value]);
      }
    }
  }
  if (runesUnread > 0) notCounted.push(`${item.name}: ${runesUnread} ${runesUnread === 1 ? 'rune' : 'runes'} not counted`);

  // Local stats shape the item's own defences and Spirit; the rest are global.
  const localFlat: Partial<Record<Pool, number>> = {};
  const localInc: Partial<Record<Pool, number>> = {};
  readVerbatim([...(craft?.verbatim ?? []), ...untypedLines, ...runeVerbatim], item.name, { defences: detail.armour !== null, spirit: detail.spirit > 0 }, localFlat, localInc, contributions, notCounted, allocate, config, { sockets: filledSockets(craft), gear: gearCounts });
  for (const [stat, value] of stats) {
    const local = LOCAL_EFFECTS[stat];
    if (local) {
      for (const e of local) {
        const bucket = e.kind === 'flat' ? localFlat : localInc;
        bucket[e.pool] = (bucket[e.pool] ?? 0) + value;
      }
    } else {
      addGlobal(contributions, notCounted, unknown, stat, value, item.name, config);
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
  // Runic Ward is a base stat of the Runeforged armour bases (Item.lua armourData.Ward, CalcDefence.lua:1218): it
  // gets the item's quality like the other three, and the slot tag so a slot increase can scale it later.
  const wardBase = armour?.ward ?? 0;
  if (wardBase > 0) {
    contributions.push({ pool: 'ward', kind: 'flat', value: Math.round(wardBase * (1 + quality / 100)), source: item.name, ...(slot ? { slot } : {}) });
  }
  // An armour base's movement penalty (Item.lua: MovementSpeed BASE -penalty); the engine reads it as a percent.
  if (slot && (detail.movementPenalty ?? 0) > 0) {
    contributions.push({ pool: 'movementSpeed', kind: 'flat', value: -(detail.movementPenalty ?? 0) * 100, source: item.name });
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
  config: BuildConfig | undefined,
  /** What a scaled line multiplies by: the runes in this item ("per Socket filled"), and the gear-wide counts (Grand Spectrum). */
  counts: { sockets: number; gear: Readonly<Record<string, number>> },
): void {
  for (const line of lines ?? []) {
    const allocates = /^Allocates (.+)$/.exec(line);
    if (allocates) {
      allocate(allocates[1]);
      continue;
    }
    const read = readLine(line);
    if (read === null) {
      // An item-local wording the cache lacks ("22% increased Evasion and Energy Shield"): the item's own defence.
      if (host.defences) {
        for (const mod of readLocalDefenceLine(line) ?? []) {
          const bucket = mod.kind === 'flat' ? localFlat : localInc;
          bucket[mod.pool] = (bucket[mod.pool] ?? 0) + mod.value;
        }
      }
      continue;
    }
    if ('unmodelled' in read) {
      notCounted.push(`${source}: "${read.unmodelled}" not counted`);
      continue;
    }
    for (const mod of gate(read.mods, config, line, source, notCounted)) {
      const defence = mod.pool === 'armour' || mod.pool === 'evasion' || mod.pool === 'energyShield';
      const local = !mod.condition && !mod.perSocket && !mod.multiplier && !read.global && mod.kind !== 'more' && ((host.defences && defence) || (host.spirit && mod.pool === 'spirit' && mod.kind === 'increased'));
      if (local) {
        const bucket = mod.kind === 'flat' ? localFlat : localInc;
        bucket[mod.pool] = (bucket[mod.pool] ?? 0) + mod.value;
      } else {
        // "per Socket filled" (Morior Invictus): PoB multiplies by the runes in this item (RunesSocketedIn<slot>).
        contributions.push({ pool: mod.pool, kind: mod.kind, value: mod.perSocket ? mod.value * counts.sockets : mod.multiplier ? mod.value * (counts.gear[mod.multiplier] ?? 0) : mod.value, source });
      }
    }
  }
}

/**
 * Sockets with a rune or soul core in them: what "per Socket filled" multiplies by (PoB Multiplier:RunesSocketedIn<slot>).
 * The importer counts PoB's own "Rune:" lines (filledSockets) because a rune our data lacks is not in `runes`; a
 * hand-built item has only `runes`. An empty item is 0, so the line adds nothing rather than a guess.
 */
function filledSockets(craft: GearItem['craft']): number {
  return craft?.filledSockets ?? craft?.runes.length ?? 0;
}

/**
 * A unique's line text with its numbers filled in: each "(a-b)" range and plain number is replaced by the value
 * the build rolled (or the mid-roll collectItem assumed), in the order they appear. A minus written before a range
 * ("-(20-5)% to all Elemental Resistances") belongs to the value: the roll is the magnitude, the line negative.
 */
function resolveLine(text: string, values: readonly number[]): string {
  let i = 0;
  return text.replace(new RegExp(`(-)?(?:${NUMBER_TOKEN.source})`, 'g'), (_all, minus: string | undefined, lo: string | undefined) => {
    const value = values[i++];
    return String(lo !== undefined && minus ? -value : value);
  });
}
