// src/lib/pob/mapCraft.ts
// =============================================================================
// One PoB item's text -> our ItemCraft (Slice 4,
// plans/2026-09-25-slice4-item-affixes.md), plus a note for everything that
// could not come across. Pure: the caller supplies the lookups.
//
// What PoB writes (verified on the vendored fixture, 2026-09-24):
// - "Rarity: X", then the name line(s), then header lines: "Crafted: true",
//   "Prefix: {range:R}ModId" / "Suffix: …" / "Prefix: None", "Quality: N",
//   "Rune: Name", "LevelReq: N", sometimes "Item Level: N", then
//   "Implicits: N". The next N lines are implicits — `{enchant}` ones are
//   enchantments or rune-granted lines, not the base's implicits. Every line
//   after them is an explicit display line.
// - A CRAFTED item names its mods by GGG id, and every id in the fixture
//   joins one of our mod files (35/35). Its value is PoB's
//   min + R × (max − min), rounded for an integer roll — which reproduces
//   PoB's own displayed lines on the fixture's crossbow exactly. Its display
//   lines are renders of those mods and are not read again.
// - A PASTED item (the common case for a real character) has only display
//   text. Each line is matched against the templates of mods that can roll
//   on the base; a two-line hybrid mod consumes two lines. Where a mod's
//   display ranges differ from its roll units (crit: "(3-4)%" over rolls
//   311–380) the mod is kept at its best roll and the note says so.
// - A unique's lines are matched against its own uniqueMods lines.
// =============================================================================

import {
  bestRolls,
  rollAt,
  emptyCraft,
  MAX_AFFIXES_PER_KIND,
  MAX_ITEM_QUALITY,
  MAX_RUNES,
  rangesIn,
  type CraftedMod,
  type ItemCraft,
  type ItemRarity,
} from '@/lib/build/craft';
import { matchTemplate, stripTags } from './craftText';

export interface CraftMod {
  slug: string;
  kind: 'prefix' | 'suffix' | 'other';
  rolls: { min: number; max: number }[];
  stats: string[];
}

export interface CraftLookups {
  /** A mod by the GGG id PoB writes ("LocalIncreasedEvasionRating9___"), or null. */
  modById(id: string): CraftMod | null;
  /** Prefix and suffix tiers that can roll on this base, for pasted text. */
  candidates: CraftMod[];
  /** The base's implicit lines and, for a unique, its own lines. */
  base: { implicitLines: string[]; uniqueLines: string[] } | null;
  runeSlugByName(name: string): string | null;
}

export interface CraftNote {
  kind: 'dropped' | 'inferred';
  message: string;
}

const RARITY: Record<string, ItemRarity> = { NORMAL: 'normal', MAGIC: 'magic', RARE: 'rare', UNIQUE: 'unique' };

function rangeFractionOf(line: string): number {
  const m = /\{range:([\d.]+)\}/.exec(line);
  return m ? Number(m[1]) : 0.5;
}

/**
 * Lines PoB writes after the mods that describe the item, not a mod
 * (Item.lua:2120-2128; read back at 682-693).
 */
const ITEM_FLAG_LINES: ReadonlySet<string> = new Set([
  'Corrupted',
  'Twice Corrupted',
  'Mirrored',
  'Sanctified',
  'Desecrated Prefix',
  'Desecrated Suffix',
]);

/** Whether a mod's display ranges are its roll ranges — then a shown number IS the rolled value. */
function sameUnits(mod: CraftMod): boolean {
  const shown = mod.stats.flatMap(rangesIn);
  return shown.length === mod.rolls.length && shown.every((r, i) => r.min === mod.rolls[i].min && r.max === mod.rolls[i].max);
}

/**
 * A "reduced"/"less" mod: every displayed range is its roll's magnitude
 * ("(18-20)% reduced" over rolls -20..-18), so a shown value is its roll negated.
 */
function shownAsMagnitudes(mod: CraftMod): boolean {
  const shown = mod.stats.flatMap(rangesIn);
  return (
    shown.length === mod.rolls.length &&
    mod.rolls.some((r) => r.min < 0 || r.max < 0) &&
    shown.every((r, i) => r.min === -mod.rolls[i].max && r.max === -mod.rolls[i].min)
  );
}

/** Matches lines to template lines, each template used once; rows sized to the templates. */
function matchLines(lines: string[], templates: string[], notes: CraftNote[], what: string): number[][] {
  const rows: number[][] = templates.map(() => []);
  const used = new Set<number>();
  for (const line of lines) {
    const plain = stripTags(line);
    const at = templates.findIndex((t, j) => !used.has(j) && matchTemplate(plain, t, rangeFractionOf(line)) !== null);
    if (at === -1) {
      notes.push({ kind: 'dropped', message: `${what} "${plain}" does not match this patch's data, so it was not kept.` });
      continue;
    }
    used.add(at);
    rows[at] = matchTemplate(plain, templates[at], rangeFractionOf(line))!;
  }
  return rows;
}

/**
 * @param options.standInFor the unique this base was imported in place of,
 *   when the unique is not in our data. The item is then the plain base: its
 *   rarity is normal and the unique's own lines are reported, never turned
 *   into the base's affixes (they are not affixes, and a "unique" base with
 *   affixes only produced false affix-limit warnings).
 */
export function mapCraft(
  raw: string,
  isUnique: boolean,
  lookups: CraftLookups,
  options: { standInFor?: string } = {},
): { craft: ItemCraft; notes: CraftNote[] } {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const notes: CraftNote[] = [];
  const craft = emptyCraft(isUnique);

  const rarityWord = /^Rarity: (\w+)$/.exec(lines[0] ?? '')?.[1] ?? '';
  craft.rarity = isUnique ? 'unique' : options.standInFor !== undefined ? 'normal' : (RARITY[rarityWord] ?? 'normal');
  if (craft.rarity === 'rare' || craft.rarity === 'magic') craft.name = lines[1] ?? null;
  craft.corrupted = lines.includes('Corrupted') || lines.includes('Twice Corrupted');

  const implicitsAt = lines.findIndex((l) => /^Implicits: \d+$/.test(l));
  const header = implicitsAt === -1 ? lines : lines.slice(0, implicitsAt);
  const implicitCount = implicitsAt === -1 ? 0 : Number(lines[implicitsAt].slice('Implicits: '.length));
  const implicitLines = implicitsAt === -1 ? [] : lines.slice(implicitsAt + 1, implicitsAt + 1 + implicitCount);
  // A line tagged {variant:a,b} belongs only to those variants; keep it only
  // when the selected one is among them.
  const selected = /^Selected Variant: (\d+)$/.exec(lines.find((l) => l.startsWith('Selected Variant: ')) ?? '')?.[1];
  const inSelectedVariant = (line: string) => {
    const tag = /\{variant:([\d,]+)\}/.exec(line);
    return !tag || selected === undefined || tag[1].split(',').includes(selected);
  };
  const explicitLines = (implicitsAt === -1 ? [] : lines.slice(implicitsAt + 1 + implicitCount)).filter(
    (l) => !ITEM_FLAG_LINES.has(l) && inSelectedVariant(l),
  );

  const crafted: Record<'prefix' | 'suffix', CraftedMod[]> = { prefix: [], suffix: [] };
  let isCrafted = false;
  for (const line of header) {
    const quality = /^Quality: (\d+)$/.exec(line);
    if (quality) craft.quality = Math.min(MAX_ITEM_QUALITY, Number(quality[1]));
    const level = /^Item Level: (\d+)$/.exec(line);
    if (level) craft.itemLevel = Math.min(100, Math.max(1, Number(level[1])));
    const rune = /^Rune: (.+)$/.exec(line);
    // PoB writes "Rune: None" for every empty socket (Item.lua:2080).
    if (rune && rune[1] !== 'None') {
      const slug = lookups.runeSlugByName(rune[1]);
      if (slug) craft.runes.push(slug);
      else notes.push({ kind: 'dropped', message: `The rune "${rune[1]}" is not in this patch's data, so it was not kept.` });
    }
    // PoB's own form (Item.lua:1894-1899, read back at 908-932): an optional
    // {fractured}, then an optional {range:x} or {range:x,y,…}, then the id.
    const affix = /^(Prefix|Suffix): (\{fractured\})?(?:\{range:([^}]+)\})?(\S+)$/.exec(line);
    if (affix) {
      isCrafted = true;
      const [, side, fractured, rangeText, id] = affix;
      if (id === 'None') continue;
      const mod = lookups.modById(id);
      if (!mod) {
        notes.push({ kind: 'dropped', message: `The mod ${id} is not in this patch's data, so it was not kept.` });
        continue;
      }
      // One fraction per roll for a list; a lone fraction applies to all.
      const fractions = (rangeText ?? '0.5').split(',').map(Number).filter(Number.isFinite);
      const fractionFor = (i: number) => fractions[Math.min(i, fractions.length - 1)] ?? 0.5;
      crafted[side === 'Prefix' ? 'prefix' : 'suffix'].push({ slug: mod.slug, values: mod.rolls.map((r, i) => rollAt(r, fractionFor(i))) });
      if (fractured) {
        notes.push({ kind: 'dropped', message: `${id} is fractured in Path of Building; the mod was kept, but its fractured mark was not — Project Vaal does not mark mods as fractured.` });
      }
    }
  }
  if (craft.runes.length > MAX_RUNES) craft.runes = craft.runes.slice(0, MAX_RUNES);

  // Implicits: an {enchant} line is an enchantment, or rune-granted if also {rune}.
  const baseImplicits: string[] = [];
  for (const line of implicitLines) {
    if (line.includes('{enchant}')) {
      if (!line.includes('{rune}')) notes.push({ kind: 'dropped', message: `The enchantment "${stripTags(line)}" was not kept — enchantments come in a later update.` });
      continue;
    }
    baseImplicits.push(line);
  }
  craft.implicitValues = matchLines(baseImplicits, lookups.base?.implicitLines ?? [], notes, 'The implicit');

  if (options.standInFor !== undefined) {
    const lost = explicitLines.filter((l) => !l.includes('{rune}')).length;
    if (lost > 0) {
      notes.push({ kind: 'dropped', message: `${lost} ${lost === 1 ? 'line' : 'lines'} of ${options.standInFor} ${lost === 1 ? 'was' : 'were'} not kept — only its base is in this patch's data.` });
    }
  } else if (isUnique) {
    craft.uniqueValues = matchLines(explicitLines.filter((l) => !l.includes('{rune}')), lookups.base?.uniqueLines ?? [], notes, 'The unique line');
  } else if (isCrafted) {
    craft.prefixes = crafted.prefix;
    craft.suffixes = crafted.suffix;
  } else {
    const pasted = explicitLines.filter((l) => !l.includes('{rune}')).map(stripTags);
    for (let i = 0; i < pasted.length; i++) {
      const two = lookups.candidates.find(
        (c) => c.stats.length === 2 && i + 1 < pasted.length && matchTemplate(pasted[i], c.stats[0]) && matchTemplate(pasted[i + 1], c.stats[1]),
      );
      const one = two ? undefined : lookups.candidates.find((c) => c.stats.length === 1 && matchTemplate(pasted[i], c.stats[0]));
      const hit = two ?? one;
      if (!hit || hit.kind === 'other') {
        notes.push({ kind: 'dropped', message: `The mod line "${pasted[i]}" matches nothing this base can roll, so it was not kept.` });
        continue;
      }
      const shown = two ? [...matchTemplate(pasted[i], hit.stats[0])!, ...matchTemplate(pasted[i + 1], hit.stats[1])!] : matchTemplate(pasted[i], hit.stats[0])!;
      let values = shown;
      if (shownAsMagnitudes(hit)) {
        // "19% reduced" on a roll stored as -20..-18 is a roll of -19.
        values = shown.map((v) => -v);
      } else if (!sameUnits(hit)) {
        values = bestRolls(hit.rolls);
        notes.push({ kind: 'inferred', message: `"${pasted[i]}" was kept as its mod at the best roll — its shown value is in different units from the roll.` });
      }
      (hit.kind === 'prefix' ? craft.prefixes : craft.suffixes).push({ slug: hit.slug, values });
      if (two) i++;
    }
  }

  for (const side of ['prefixes', 'suffixes'] as const) {
    if (craft[side].length > MAX_AFFIXES_PER_KIND) {
      notes.push({ kind: 'dropped', message: `The item listed ${craft[side].length} ${side}; the first ${MAX_AFFIXES_PER_KIND} were kept.` });
      craft[side] = craft[side].slice(0, MAX_AFFIXES_PER_KIND);
    }
  }
  return { craft, notes };
}
