// src/lib/build/validate/affixRules.ts
// =============================================================================
// Warnings about an item's craft (Slice 4, plans/2026-09-25-slice4-item-affixes.md):
// affix counts per rarity, one mod per group, mods the base cannot roll,
// tiers above the item level, values outside their rolls, and runes over the
// base's sockets. Every result is a warning — the editor clamps as you type,
// so these catch imports, old rows and direct POSTs, and nothing is dropped.
//
// Pure. Data is injected: a slug ABSENT from a map is "not loaded yet" and is
// skipped silently; a slug mapped to null (mods, bases) or false (runes) was
// fetched and does not exist, which IS worth a warning.
// =============================================================================

import { rangesIn, type CraftedMod, type ItemCraft, type ValueRange } from '../craft';
import type { GearItem } from '../gearSlots';
import type { GearState } from '../gearState';
import { GEAR_SLOTS } from '../gearSlots';
import { canSpawn, type SpawnWeight } from '@/lib/wiki/spawn';
import { handednessOf } from './handedness';
import type { BuildWarning, WarningTarget } from './types';

export interface ModData {
  kind: 'prefix' | 'suffix' | 'other';
  group: string;
  /** Item level the tier needs. */
  level: number;
  domain: string;
  rolls: ValueRange[];
  spawnWeights: SpawnWeight[];
}

export interface BaseData {
  tags: string[];
  modDomain: string | null;
  /** The base's `implicitMods` display lines. */
  implicitLines: string[];
  /** A unique's `uniqueMods.explicitMods` display lines. */
  uniqueLines: string[];
}

export interface CraftData {
  mods: ReadonlyMap<string, ModData | null>;
  bases: ReadonlyMap<string, BaseData | null>;
  runes: ReadonlyMap<string, boolean>;
}

/**
 * Affixes per side for a rarity — PoB2 src/Classes/Item.lua:1750-1768: Magic
 * 1 + 1, Rare 3 + 3 except a rare jewel 2 + 2. Normal and unique items take
 * none. PoB2's per-item limit modifiers are not modelled.
 */
function affixLimit(craft: ItemCraft, category: string): number {
  if (craft.rarity === 'magic') return 1;
  if (craft.rarity === 'rare') return category === 'Jewel' ? 2 : 3;
  return 0;
}

const FOUR_SOCKETS = new Set(['Two Hand Sword', 'Two Hand Axe', 'Two Hand Mace', 'Bow', 'Crossbow', 'Staff', 'Warstaff', 'Talisman', 'Body Armour']);
const THREE_SOCKETS = new Set([
  'One Hand Sword', 'One Hand Axe', 'One Hand Mace', 'Claw', 'Dagger', 'Flail', 'Spear', 'Sceptre', 'Wand',
  'Shield', 'Buckler', 'Focus', 'Focii', 'Helmet', 'Gloves', 'Boots',
]);

/**
 * Augment sockets a base has, per PoB2's hand-set `socketLimit` (Data/Bases/*.lua,
 * tabulated 2026-09-24): 4 for two-handers and body armour, 3 for one-handers,
 * off-hands and the other armour pieces. `null` = no rule: jewellery, belts
 * and quivers have no PoB2 limit, yet PoB2 marks runes socketable in
 * jewellery, so no count is asserted there. A unique mace reads its known base.
 */
export function socketLimitFor(item: { category: string; slug: string }): number | null {
  if (FOUR_SOCKETS.has(item.category)) return 4;
  if (THREE_SOCKETS.has(item.category)) return 3;
  if (item.category === 'Mace') {
    const hands = handednessOf('Mace', item.slug);
    return hands === 'two' ? 4 : hands === 'one' ? 3 : null;
  }
  return null;
}

function inRange(value: number, range: ValueRange): boolean {
  return value >= Math.min(range.min, range.max) && value <= Math.max(range.min, range.max);
}

/** A value row checked against the ranges it fills. An empty row is "not set", which is fine. */
function rowFits(values: readonly number[], ranges: readonly ValueRange[]): boolean {
  if (values.length === 0) return true;
  return values.length === ranges.length && values.every((v, i) => inRange(v, ranges[i]));
}

function checkItem(item: GearItem, target: WarningTarget, data: CraftData): BuildWarning[] {
  const craft = item.craft;
  if (!craft) return [];
  const out: BuildWarning[] = [];
  const warn = (code: BuildWarning['code'], message: string) => out.push({ code, severity: 'warning', target, message });

  const limit = affixLimit(craft, item.category);
  for (const [side, list] of [['prefix', craft.prefixes], ['suffix', craft.suffixes]] as const) {
    if (list.length > limit) {
      warn('affix-over-limit', `${item.name} has ${list.length} ${side}es; a ${craft.rarity} item can have ${limit}.`);
    }
  }

  const base = data.bases.get(item.slug);
  const tags = new Set(base?.tags ?? []);
  const groups = new Set<string>();
  const affixes: [CraftedMod, 'prefix' | 'suffix'][] = [
    ...craft.prefixes.map((m) => [m, 'prefix'] as [CraftedMod, 'prefix']),
    ...craft.suffixes.map((m) => [m, 'suffix'] as [CraftedMod, 'suffix']),
  ];
  for (const [chosen, side] of affixes) {
    if (!data.mods.has(chosen.slug)) continue; // still loading
    const m = data.mods.get(chosen.slug);
    if (!m) {
      warn('affix-unknown', `${item.name}: the mod "${chosen.slug}" is not in our data.`);
      continue;
    }
    if (m.kind !== side) warn('affix-wrong-kind', `${item.name}: "${chosen.slug}" is not a ${side}.`);
    if (groups.has(m.group)) warn('affix-duplicate-group', `${item.name} has two mods from the ${m.group} group; an item can roll only one.`);
    groups.add(m.group);
    if (base && (m.domain !== base.modDomain || !canSpawn(m.spawnWeights, tags))) {
      warn('affix-not-eligible', `${item.name} cannot roll "${chosen.slug}".`);
    }
    if (craft.itemLevel !== null && m.level > craft.itemLevel) {
      warn('affix-above-item-level', `${item.name}: "${chosen.slug}" needs item level ${m.level}; this one is ${craft.itemLevel}.`);
    }
    if (!(chosen.values.length === m.rolls.length && chosen.values.every((v, i) => inRange(v, m.rolls[i])))) {
      warn('roll-out-of-range', `${item.name}: a value on "${chosen.slug}" is outside what it can roll.`);
    }
  }

  if (base) {
    const lineRows: [string, readonly string[], readonly number[][]][] = [
      ['implicit', base.implicitLines, craft.implicitValues],
      ['unique', base.uniqueLines, craft.uniqueValues],
    ];
    for (const [label, lines, rows] of lineRows) {
      const bad = rows.some((row, i) => (i < lines.length ? !rowFits(row, rangesIn(lines[i])) : row.length > 0));
      if (bad) warn('roll-out-of-range', `${item.name}: an ${label} value is outside what it can roll.`);
    }
  }

  const sockets = socketLimitFor(item);
  if (sockets !== null && craft.runes.length > sockets) {
    warn('runes-over-limit', `${item.name} has ${craft.runes.length} runes; it has ${sockets} sockets.`);
  }
  for (const rune of new Set(craft.runes)) {
    if (data.runes.get(rune) === false) warn('rune-unknown', `${item.name}: the rune "${rune}" is not in our data.`);
  }
  return out;
}

/** Craft warnings for every gear slot (in slot order), then every jewel. */
export function validateCrafts(gear: GearState, data: CraftData): BuildWarning[] {
  const out: BuildWarning[] = [];
  for (const slot of GEAR_SLOTS) {
    const item = gear[slot];
    if (item) out.push(...checkItem(item, { kind: 'gear', slot }, data));
  }
  for (const [nodeId, item] of Object.entries(gear.jewels)) {
    out.push(...checkItem(item, { kind: 'jewel', nodeId }, data));
  }
  return out;
}
