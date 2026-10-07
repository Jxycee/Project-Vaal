// src/lib/build/itemCard.ts
// =============================================================================
// An item as a READER should see it: name, base, requirements, runes and every
// mod as a line with its tier tag (P1 / S2: prefix or suffix, tier counted
// from the top, 1 = best), its roll range and where the stored roll sits in
// that range. Pure: the raw wiki files are passed in (the hook loads them), so
// the data test can run on the real files.
//
// Mod text is the stored roll filled into the mod's display template
// (pob/export/renderLine). A mod whose display ranges are not its roll ranges
// (crit: "(3-4)%" over rolls 311-380, hundredths) is scaled back by
// craft.displayedValues; if no scale fits it prints at its best display value.
// Its roll bar is true either way, because values and rolls share units.
// =============================================================================

import { categoryApplies } from './stats/runes';
import { displayedValues, rangesIn, type CraftedMod, type ValueRange } from './craft';
import type { GearItem } from './gearSlots';
import { renderLine } from '@/lib/pob/export/renderLine';

export type CardRarity = 'normal' | 'magic' | 'rare' | 'unique';
export type CardModKind = 'implicit' | 'prefix' | 'suffix' | 'unique';

export interface CardMod {
  kind: CardModKind;
  /** One display line, or two for a hybrid mod. */
  lines: string[];
  /** The template's range(s), e.g. "(135-154)", muted beside the line. Empty when the line has none. */
  range: string;
  /** "P3" / "S1"; empty for implicits and unique lines. */
  tag: string;
  /** 0-100: where the stored roll sits in its range; null for a fixed line or an unset roll. */
  roll: number | null;
  /** The mod's file did not load: the line says so rather than disappearing. */
  unknown?: boolean;
}

export interface CardRune {
  name: string;
  count: number;
  effect: string[];
}

export interface ItemCard {
  name: string;
  base: string;
  rarity: CardRarity;
  quality: number;
  corrupted: boolean;
  /** "Quality" plus base weapon / armour numbers, each labelled "Base ...". */
  stats: { label: string; value: string }[];
  requirements: string;
  runes: CardRune[];
  implicits: CardMod[];
  mods: CardMod[];
  flavour: string | null;
}

export interface CardSources {
  /** items/<slug>.json */
  item: unknown;
  /** mods/<slug>.json by slug; a slug missing here did not load. */
  mods: ReadonlyMap<string, unknown>;
  /** mod-tiers.json: slug -> [tier from the top, tiers in the family]. */
  tiers: Readonly<Record<string, readonly [number, number]>>;
  /** items/<slug>.json for each socketed rune. */
  runes: ReadonlyMap<string, unknown>;
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Obj) : {});
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/**
 * Where the rolled values sit in their ranges, 0-100 (average over the ranges
 * that can vary). A range runs from `min` to `max` as the data writes it, so
 * for a negative range the larger-magnitude end is the best (100). null when
 * nothing varies.
 */
export function rollPercent(rolls: readonly ValueRange[], values: readonly number[]): number | null {
  const fractions: number[] = [];
  rolls.forEach((r, i) => {
    const v = values[i];
    if (v === undefined || r.min === r.max) return;
    fractions.push(Math.min(1, Math.max(0, (v - r.min) / (r.max - r.min))));
  });
  if (fractions.length === 0) return null;
  return Math.round((100 * fractions.reduce((a, b) => a + b, 0)) / fractions.length);
}

function rangeText(templates: readonly string[]): string {
  return templates
    .flatMap(rangesIn)
    .map((r) => `(${r.min}-${r.max})`)
    .join(' ');
}

/** An unset implicit / unique row is read by the engine at each range's midpoint, so the card prints that. */
function rowValues(template: string, row: readonly number[] | undefined): number[] {
  return rangesIn(template).map((r, i) => row?.[i] ?? (r.min + r.max) / 2);
}

function cardForCraftedMod(kind: 'prefix' | 'suffix', crafted: CraftedMod, src: CardSources): CardMod {
  const raw = src.mods.get(crafted.slug);
  if (raw === undefined || raw === null) {
    return { kind, lines: [`Unknown affix (${crafted.slug})`], range: '', tag: kind === 'prefix' ? 'P' : 'S', roll: null, unknown: true };
  }
  const mod = obj(raw);
  const stats = strings(mod.stats);
  const rolls = (Array.isArray(mod.rolls) ? mod.rolls : []).map((r) => ({ min: num(obj(r).min), max: num(obj(r).max) }));
  // Stored rolls in display units (crit's hundredths scaled back); null: the best display value, so a line is never blank.
  const shown = displayedValues(stats, rolls, crafted.values);
  let at = 0;
  const lines = stats.map((template) => {
    const n = rangesIn(template).length;
    const line = renderLine(template, shown ? shown.slice(at, at + n) : []);
    at += n;
    return line;
  });
  const tier = src.tiers[crafted.slug];
  return {
    kind,
    lines,
    range: rangeText(stats),
    tag: `${kind === 'prefix' ? 'P' : 'S'}${tier ? tier[0] : ''}`,
    roll: rollPercent(rolls, crafted.values),
  };
}

const ARMOUR_CATEGORIES = new Set(['Body Armour', 'Helmet', 'Gloves', 'Boots', 'Shield', 'Buckler', 'Focus']);

const title = (s: string) => s.replace(/(^|-)([a-z])/g, (_m, sep: string, c: string) => `${sep ? ' ' : ''}${c.toUpperCase()}`);

export function buildItemCard(item: GearItem, src: CardSources): ItemCard {
  const raw = obj(src.item);
  const craft = item.craft;
  const rarity: CardRarity = item.isUnique ? 'unique' : (craft?.rarity ?? 'normal');
  const unique = obj(raw.uniqueMods);
  const baseName = rarity === 'unique' ? (typeof unique.baseType === 'string' ? unique.baseType : item.name) : item.name;
  const itemClass = typeof raw.itemClass === 'string' ? raw.itemClass : item.category;

  const name = rarity === 'unique' ? item.name : (craft?.name || item.name);
  const base = name === baseName ? itemClass : `${baseName} · ${itemClass}`;

  const stats: ItemCard['stats'] = [];
  const quality = craft?.quality ?? 0;
  if (quality > 0) stats.push({ label: 'Quality', value: `+${quality}%` });
  const weapon = raw.weapon === null || raw.weapon === undefined ? null : obj(raw.weapon);
  if (weapon) {
    stats.push({ label: 'Base Physical Damage', value: `${num(weapon.damageMin)}-${num(weapon.damageMax)}` });
    if (num(weapon.critical) > 0) stats.push({ label: 'Base Critical Hit Chance', value: `${(num(weapon.critical) / 100).toFixed(2)}%` });
    if (num(weapon.attackTime) > 0) stats.push({ label: 'Base Attacks per Second', value: (1000 / num(weapon.attackTime)).toFixed(2) });
  }
  const armour = raw.armour === null || raw.armour === undefined ? null : obj(raw.armour);
  if (armour) {
    for (const [key, label] of [['armour', 'Base Armour'], ['evasion', 'Base Evasion Rating'], ['energyShield', 'Base Energy Shield'], ['block', 'Base Block Chance']] as const) {
      if (num(armour[key]) > 0) stats.push({ label, value: String(num(armour[key])) });
    }
  }

  const req = obj(raw.requirements);
  const level = num(unique.requiresLevel) || num(raw.dropLevel);
  const parts = [
    level > 0 ? `Level ${level}` : '',
    num(req.strength) > 0 ? `${num(req.strength)} Strength` : '',
    num(req.dexterity) > 0 ? `${num(req.dexterity)} Dexterity` : '',
    num(req.intelligence) > 0 ? `${num(req.intelligence)} Intelligence` : '',
  ].filter(Boolean);
  const requirements = parts.length > 0 ? `Requires: ${parts.join(', ')}` : '';

  // Runes: one box per kind, with the effect that applies to THIS kind of item.
  // A unique's file can carry no armour numbers (Cloak of Flame), so the category counts too.
  const host = {
    itemClass: typeof raw.itemClass === 'string' ? raw.itemClass : null,
    weapon: weapon !== null,
    armour: armour !== null || ARMOUR_CATEGORIES.has(item.category),
  };
  const runes: CardRune[] = [];
  for (const slug of craft?.runes ?? []) {
    const existing = runes.find((r) => r.name === runeName(slug, src));
    if (existing) {
      existing.count += 1;
      continue;
    }
    const effects = (Array.isArray(obj(src.runes.get(slug)).soulCoreEffects) ? (obj(src.runes.get(slug)).soulCoreEffects as unknown[]) : []).map(obj);
    runes.push({
      name: runeName(slug, src),
      count: 1,
      effect: effects.filter((e) => typeof e.category === 'string' && categoryApplies(e.category, host)).flatMap((e) => strings(e.lines)),
    });
  }

  const implicits: CardMod[] = strings(raw.implicitMods).map((template, i) => ({
    kind: 'implicit',
    lines: [renderLine(template, rowValues(template, craft?.implicitValues[i]))],
    range: rangeText([template]),
    tag: '',
    roll: null,
  }));

  const mods: CardMod[] = [];
  if (rarity === 'unique') {
    strings(unique.explicitMods).forEach((template, i) => {
      const row = craft?.uniqueValues[i];
      const ranges = rangesIn(template);
      mods.push({
        kind: 'unique',
        lines: [renderLine(template, rowValues(template, row))],
        range: rangeText([template]),
        tag: '',
        roll: row && row.length > 0 ? rollPercent(ranges, row) : null,
      });
    });
  }
  for (const m of craft?.prefixes ?? []) mods.push(cardForCraftedMod('prefix', m, src));
  for (const m of craft?.suffixes ?? []) mods.push(cardForCraftedMod('suffix', m, src));

  const flavour = strings(raw.flavourText).join(' ');
  return { name, base, rarity, quality, corrupted: craft?.corrupted ?? false, stats, requirements, runes, implicits, mods, flavour: flavour || null };
}

function runeName(slug: string, src: CardSources): string {
  const n = obj(src.runes.get(slug)).name;
  return typeof n === 'string' ? n : title(slug);
}
