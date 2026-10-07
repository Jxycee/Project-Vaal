// src/lib/build/craft.ts
// =============================================================================
// What an equipped item carries beyond its base (Slice 4, competitor gap #3):
// everything our data can back — rarity, name, item level, quality,
// corruption, implicit/unique roll values, prefixes and suffixes with rolled
// values, and socketed runes / soul cores. See
// plans/2026-09-25-slice4-item-affixes.md.
//
// Lives on gear-slot and jewel items only (`GearItem.craft`), never on gems.
// Optional: rows saved before Slice 4 have no `craft`, and read exactly as
// they always did. Pure module, no fetch, no React.
// =============================================================================

export type ItemRarity = 'normal' | 'magic' | 'rare' | 'unique';

export const RARITIES: readonly ItemRarity[] = ['normal', 'magic', 'rare', 'unique'];

/** A chosen affix: the mod file's slug, and one value per entry of that mod's `rolls[]`. */
export interface CraftedMod {
  slug: string;
  values: number[];
}

export interface ItemCraft {
  rarity: ItemRarity;
  /** A magic or rare item's own name. */
  name: string | null;
  /** 1–100, or null when not set. */
  itemLevel: number | null;
  /** 0–MAX_ITEM_QUALITY. */
  quality: number;
  corrupted: boolean;
  /** One row per `implicitMods` line of the base, one value per "(a-b)" range in that line. */
  implicitValues: number[][];
  /** One row per `uniqueMods.explicitMods` line, same rule. */
  uniqueValues: number[][];
  prefixes: CraftedMod[];
  suffixes: CraftedMod[];
  /** SoulCore item slugs (runes, soul cores), in socket order. */
  runes: string[];
}

/**
 * Item quality cap. Not the "usual 20": real items exceed it (the momentsZX
 * reference character's helmet is at 22%, and the handoff saw 21-23% on live
 * characters), and clamping to 20 silently lost defences on import. 30 is a
 * generous ceiling, not a value read from our data — still an assumption, but
 * one that no longer under-counts a real item.
 */
export const MAX_ITEM_QUALITY = 30;

/**
 * Storage bounds the write gate (stateInput.ts) refuses a craft over: affixes
 * per side, and runes / soul cores per item. Headroom over the game (a rare is
 * 3+3; PoB2's socketLimit is lower still), so the editor and the PoB importer
 * stop here while the validator WARNS at the game's own limits.
 */
export const MAX_AFFIXES_PER_KIND = 6;
export const MAX_RUNES = 6;

export function emptyCraft(isUnique: boolean): ItemCraft {
  return {
    rarity: isUnique ? 'unique' : 'normal',
    name: null,
    itemLevel: null,
    quality: 0,
    corrupted: false,
    implicitValues: [],
    uniqueValues: [],
    prefixes: [],
    suffixes: [],
    runes: [],
  };
}

export interface ValueRange {
  min: number;
  max: number;
}

// PoB2's own pattern for a ranged value (src/Modules/ItemTools.lua,
// itemLib.applyRange): "(min-max)", either bound optionally negative or decimal.
export const RANGE_RE = /\((-?\d+(?:\.\d+)?)-(-?\d+(?:\.\d+)?)\)/g;

/** Clamps `value` into `range`, whichever way round the bounds are written; a non-number reads as the lower bound. */
export function clampToRange(value: number, range: ValueRange): number {
  const lo = Math.min(range.min, range.max);
  const hi = Math.max(range.min, range.max);
  if (!Number.isFinite(value)) return lo;
  return Math.min(hi, Math.max(lo, value));
}

/**
 * The values a newly added affix starts at: each roll's `max` as the data
 * writes it — the best roll, which is what a planner usually targets. For a
 * negative range the data's `max` is its larger-magnitude end.
 */
export function bestRolls(rolls: readonly ValueRange[]): number[] {
  return rolls.map((r) => r.max);
}

/** Every "(a-b)" range in a display line, in order. */
export function rangesIn(line: string): ValueRange[] {
  return Array.from(line.matchAll(RANGE_RE), (m) => ({ min: Number(m[1]), max: Number(m[2]) }));
}

/**
 * The numbers a mod's display lines would show for stored roll `values`, or
 * null when they cannot be known. Our files keep a roll in game units and the
 * line in display units, and for a few mods the two differ: crit prints
 * "(3-4)%" over rolls 311-380, i.e. hundredths. Same ranges: the values as
 * stored. Every range a power of ten apart (311-380 floors to 3 and ceils to 4
 * at /100): the values divided by it. Anything else: null, and the caller
 * falls back to the best display value.
 */
export function displayedValues(stats: readonly string[], rolls: readonly ValueRange[], values: readonly number[]): number[] | null {
  const shown = stats.flatMap(rangesIn);
  if (shown.length === 0 || shown.length !== rolls.length) return null;
  if (shown.every((r, i) => r.min === rolls[i].min && r.max === rolls[i].max)) return [...values];
  for (const k of [10, 100, 1000]) {
    const fits = shown.every((r, i) => Math.floor(Math.min(rolls[i].min, rolls[i].max) / k) === Math.min(r.min, r.max) && Math.ceil(Math.max(rolls[i].min, rolls[i].max) / k) === Math.max(r.min, r.max));
    if (fits) return values.map((v) => Math.round((v / k) * 1e6) / 1e6);
  }
  return null;
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function numberRow(raw: unknown): number[] {
  return Array.isArray(raw) ? raw.filter(isFiniteNumber) : [];
}

function parseMods(raw: unknown): CraftedMod[] {
  if (!Array.isArray(raw)) return [];
  const mods: CraftedMod[] = [];
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue;
    const e = entry as Record<string, unknown>;
    if (typeof e.slug !== 'string' || e.slug.length === 0 || !Array.isArray(e.values)) continue;
    mods.push({ slug: e.slug, values: numberRow(e.values) });
  }
  return mods;
}

/**
 * A stored `craft` (raw jsonb) -> typed `ItemCraft`, or `undefined` when there
 * is none. Each malformed field falls back to its default on its own; one bad
 * affix never takes its siblings with it. Value rows stay positional (a bad
 * row reads as `[]`), so row i always means line i.
 */
export function parseCraft(raw: unknown, isUnique: boolean): ItemCraft | undefined {
  if (raw === undefined || raw === null) return undefined;
  const craft = emptyCraft(isUnique);
  if (typeof raw !== 'object' || Array.isArray(raw)) return craft;
  const v = raw as Record<string, unknown>;

  if (typeof v.rarity === 'string' && (RARITIES as readonly string[]).includes(v.rarity)) craft.rarity = v.rarity as ItemRarity;
  if (typeof v.name === 'string') craft.name = v.name;
  if (isFiniteNumber(v.itemLevel) && v.itemLevel >= 1 && v.itemLevel <= 100) craft.itemLevel = Math.trunc(v.itemLevel);
  if (isFiniteNumber(v.quality)) craft.quality = Math.min(MAX_ITEM_QUALITY, Math.max(0, Math.trunc(v.quality)));
  if (typeof v.corrupted === 'boolean') craft.corrupted = v.corrupted;
  if (Array.isArray(v.implicitValues)) craft.implicitValues = v.implicitValues.map(numberRow);
  if (Array.isArray(v.uniqueValues)) craft.uniqueValues = v.uniqueValues.map(numberRow);
  craft.prefixes = parseMods(v.prefixes);
  craft.suffixes = parseMods(v.suffixes);
  if (Array.isArray(v.runes)) craft.runes = v.runes.filter((r): r is string => typeof r === 'string' && r.length > 0);
  return craft;
}

/** One line describing a craft — "rare · 3 affixes · 2 runes · corrupted" — for the gear lists. */
export function craftSummary(craft: ItemCraft): string {
  const affixes = craft.prefixes.length + craft.suffixes.length;
  const parts = [craft.rarity, `${affixes} ${affixes === 1 ? 'affix' : 'affixes'}`];
  if (craft.runes.length > 0) parts.push(`${craft.runes.length} ${craft.runes.length === 1 ? 'rune' : 'runes'}`);
  if (craft.corrupted) parts.push('corrupted');
  return parts.join(' · ');
}
