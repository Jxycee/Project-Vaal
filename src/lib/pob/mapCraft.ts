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
// - A line none of that can hold (a mod the base's pool lacks, a unique we never
//   typed, a roll past its tier cap, "Allocates X") is kept as written in
//   `craft.verbatim` when stats/lineMods.ts can read it, instead of being
//   dropped or clamped; the text is PoB's own shown value, so it is exact. Mageblood's
//   "Legacy of X" lines are kept this way too, every copy (stats/legacies.ts).
// =============================================================================

import {
  bestRolls,
  emptyCraft,
  MAX_AFFIXES_PER_KIND,
  MAX_ITEM_QUALITY,
  MAX_RUNES,
  MAX_VERBATIM_LINES,
  RANGE_RE,
  rangesIn,
  type CraftedMod,
  type ItemCraft,
  type ItemRarity,
} from '@/lib/build/craft';
import { isLegacyLine } from '@/lib/build/stats/legacies';
import { RADIUS_GRANT_LINE, readLine, readLocalDefenceLine } from '@/lib/build/stats/lineMods';
import { matchTemplate, stripTags, valueAt } from './craftText';

export interface CraftMod {
  slug: string;
  kind: 'prefix' | 'suffix' | 'other';
  /** The mod group — one per item. Optional so a test fake can leave it out. */
  group?: string;
  rolls: { min: number; max: number }[];
  stats: string[];
}

export interface CraftLookups {
  /** A mod by the GGG id PoB writes ("LocalIncreasedEvasionRating9___"), or null. */
  modById(id: string): CraftMod | null;
  /** Prefix and suffix tiers that can roll on this base, for pasted text. */
  candidates: CraftMod[];
  /** The base's implicit lines and, for a unique, its own lines. */
  base: { implicitLines: string[]; uniqueLines: string[]; /** A unique's own base name ("Tempered Mitts"), to tell a transformed base from a Runemastered one. */ baseType?: string } | null;
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

/** A line as plain text with any "(a-b)" range filled at the line's {range:R} fraction, the way PoB shows it. */
function resolveLine(line: string): string {
  const fraction = rangeFractionOf(line);
  return stripTags(line).replace(RANGE_RE, (_, min: string, max: string) => String(Number(valueAt(Number(min), Number(max), fraction).toFixed(2))));
}

/**
 * Keeps a line the slug model cannot hold, when it can be read from its text: a defence line
 * (stats/lineMods.ts) or an "Allocates <passive>" enchant. Returns whether it was kept.
 */
function keepVerbatim(line: string, verbatim: string[]): boolean {
  const text = resolveLine(line);
  // A radius jewel's "also grant" line is kept when the line it grants is one we can read; offence ones are not.
  const grant = RADIUS_GRANT_LINE.exec(text);
  if (grant) {
    if (readLine(grant[2]) === null) return false;
    verbatim.push(text);
    return true;
  }
  if (!/^Allocates .+/.test(text) && !isLegacyLine(text) && readLine(text) === null && readLocalDefenceLine(text) === null) return false;
  verbatim.push(text);
  return true;
}

/**
 * The Adorned: "N% increased Effect of Jewel Socket Passive Skills" + "containing Corrupted Magic|Rare Jewels" on the next
 * line, once per rarity (the wiki lists only the Magic one, so the Rare pair matched no template and was dropped).
 *
 * Failure modes, decided first:
 *   1. The effect line without a "containing Corrupted ..." line after it (another item, or a wording we do not know):
 *      left alone for the template matcher, as before.
 *   2. A pair is joined into ONE verbatim line (SOCKET_EFFECT_LINE) and removed from the printed lines, so it can never
 *      be matched to a template as a half and counted twice.
 *   3. The joined line is at most ~100 characters, under the write gate's per-line cap, and unreadable to readLine,
 *      so readVerbatim passes it over silently; collect.ts reads it.
 */
function joinSocketEffectLines(printed: string[], verbatim: string[]): string[] {
  const effect = /^(\d+(?:\.\d+)?)% increased Effect of Jewel Socket Passive Skills$/;
  const containing = /^containing Corrupted (Magic|Rare) Jewels$/;
  const kept: string[] = [];
  for (let i = 0; i < printed.length; i++) {
    const head = effect.exec(resolveLine(printed[i]));
    const tail = i + 1 < printed.length ? containing.exec(resolveLine(printed[i + 1])) : null;
    if (head && tail) {
      verbatim.push(`${head[1]}% increased Effect of Jewel Socket Passive Skills containing Corrupted ${tail[1]} Jewels`);
      i++;
      continue;
    }
    kept.push(printed[i]);
  }
  return kept;
}

/** Whether a mod's display ranges are its roll ranges — then a shown number IS the rolled value. */
export function sameUnits(mod: CraftMod): boolean {
  const shown = mod.stats.flatMap(rangesIn);
  return shown.length === mod.rolls.length && shown.every((r, i) => r.min === mod.rolls[i].min && r.max === mod.rolls[i].max);
}

/** Matches lines to template lines, each template used once; rows sized to the templates. */
function matchLines(lines: string[], templates: string[], notes: CraftNote[], what: string, verbatim: string[], matchedOut?: Set<number>): number[][] {
  const rows: number[][] = templates.map(() => []);
  const used = matchedOut ?? new Set<number>();
  for (const line of lines) {
    const plain = stripTags(line);
    let at = templates.findIndex((t, j) => !used.has(j) && matchTemplate(plain, t, rangeFractionOf(line)) !== null);
    // A shown number past its range (an implicit scaled by quality, a corrupted roll) is still that line: the
    // shown value is the real one. Read it from the same template, unbounded, rather than let the template
    // fall back to its mid-roll beside a verbatim copy of the line (which counted it twice).
    const outOfRange = at === -1;
    if (outOfRange) at = templates.findIndex((t, j) => !used.has(j) && matchTemplate(plain, t, rangeFractionOf(line), false) !== null);
    if (at === -1) {
      if (keepVerbatim(line, verbatim)) {
        notes.push({ kind: 'inferred', message: `${what} "${plain}" does not match this patch's data, so it was kept as written and counted from its text.` });
      } else {
        notes.push({ kind: 'dropped', message: `${what} "${plain}" does not match this patch's data, so it was not kept.` });
      }
      continue;
    }
    used.add(at);
    rows[at] = matchTemplate(plain, templates[at], rangeFractionOf(line), !outOfRange)!;
  }
  return rows;
}

/**
 * Several mods can print the same line — a prefix and a suffix of "Rarity of
 * Items found" do. PoB's text does not say which one an item has, but an item
 * has at most three of each kind (one if magic) and one mod per group, so
 * take the first (the natural, lowest-level) match whose kind still has room
 * and whose group is unused; with none, the first match, as before.
 */
function pickOne(matches: CraftMod[], craft: ItemCraft, all: CraftMod[]): CraftMod | undefined {
  if (matches.length < 2) return matches[0];
  const used = new Set<string>();
  for (const m of [...craft.prefixes, ...craft.suffixes]) {
    const group = all.find((c) => c.slug === m.slug)?.group;
    if (group) used.add(group);
  }
  // What a rare item can hold per kind (affixRules.ts: magic 1, rare 3); the write gate's own cap is looser.
  const room = craft.rarity === 'magic' ? 1 : 3;
  const fits = (c: CraftMod) => c.kind !== 'other' && craft[c.kind === 'prefix' ? 'prefixes' : 'suffixes'].length < room && !(c.group && used.has(c.group));
  return matches.find(fits) ?? matches[0];
}


/** A display template with its "(a-b)" ranges blanked: two mods print the same line when their shapes match. */
const shapeOf = (template: string) => template.replace(RANGE_RE, '#');

/** Distance of each shown number outside its roll range: 0 inside, negative below the minimum (not "above"). */
function overshoot(shown: number[], rolls: { min: number; max: number }[]): number | null {
  if (shown.length !== rolls.length) return null;
  let total = 0;
  for (let i = 0; i < shown.length; i++) {
    if (shown[i] < rolls[i].min) return null;
    total += Math.max(0, shown[i] - rolls[i].max);
  }
  return total;
}

/** The number a line shows for any template of its shape (its first), ignoring range bounds — null when no single-stat mod prints this shape. */
function matchTemplateAny(line: string, candidates: CraftMod[]): number | null {
  for (const c of candidates) {
    if (c.stats.length !== 1) continue;
    const v = matchTemplate(line, c.stats[0], 0.5, false);
    if (v) return v[0];
  }
  return null;
}

/**
 * A line whose number sits above the top of every tier that prints it
 * (matchTemplate said no only because of range): the legal mod nearest the
 * shown value, at its closest roll. Never for a value below a tier's minimum,
 * and only where the shown units are the roll units.
 */
function closestLegal(line: string, candidates: CraftMod[], craft: ItemCraft): { mod: CraftMod; values: number[] } | undefined {
  const scored: { mod: CraftMod; shown: number[]; gap: number }[] = [];
  for (const c of candidates) {
    if (c.stats.length !== 1 || c.kind === 'other' || !sameUnits(c)) continue;
    const shown = matchTemplate(line, c.stats[0], 0.5, false);
    const gap = shown ? overshoot(shown, c.rolls) : null;
    if (shown && gap !== null && gap > 0) scored.push({ mod: c, shown, gap });
  }
  if (scored.length === 0) return undefined;
  const best = Math.min(...scored.map((s) => s.gap));
  const nearest = scored.filter((s) => s.gap === best);
  const mod = pickOne(nearest.map((s) => s.mod), craft, candidates);
  const row = nearest.find((s) => s.mod === mod) ?? nearest[0];
  return { mod: row.mod, values: row.mod.rolls.map((r) => r.max) };
}

interface SummedSplit {
  hybrid: CraftMod;
  pure: CraftMod;
  hybridValues: number[];
  pureValues: number[];
  /** Index of the other pasted line the hybrid's second stat read from. */
  partner: number;
}

/**
 * One printed line can be two mods added together: the game sums a stat across
 * mods before printing it, so a pure "(80-100)% increased Evasion and Energy
 * Shield" and a hybrid "(33-38)% ... + (27-32) to maximum Mana" print a single
 * 126% line, with the hybrid's other stat on a line of its own. (PoB's own
 * "Evasion: 728" header on the same item reproduces only at 126%, checked
 * 2026-10-05.) Called only for a line no single tier can print. Finds a hybrid
 * whose OTHER stat is a pasted line in range, and a pure mod of another group
 * for the same stat so that hybrid + pure can reach the shown value. Only the
 * sum is known: the hybrid's roll is placed at the same fraction of its range
 * as its other stat's, and the pure mod takes the rest (any split that fits a
 * tier is tried if that one does not).
 */
function splitSummed(shown: number, at: number, pasted: string[], consumed: Set<number>, candidates: CraftMod[]): SummedSplit | null {
  for (const hybrid of candidates) {
    if (hybrid.stats.length !== 2 || hybrid.kind === 'other' || !sameUnits(hybrid)) continue;
    for (const k of [0, 1] as const) {
      if (!matchTemplate(pasted[at], hybrid.stats[k], 0.5, false)) continue;
      const partner = pasted.findIndex((l, j) => j !== at && !consumed.has(j) && matchTemplate(l, hybrid.stats[1 - k]) !== null);
      if (partner === -1) continue;
      const partnerValue = matchTemplate(pasted[partner], hybrid.stats[1 - k])!;
      const { min, max } = hybrid.rolls[k];
      const own = hybrid.rolls[1 - k];
      const fraction = own.max === own.min ? 0 : (partnerValue[0] - own.min) / (own.max - own.min);
      const preferred = Math.round(min + fraction * (max - min));
      const tried = [preferred, ...Array.from({ length: max - min + 1 }, (_, i) => min + i)];
      for (const pure of candidates) {
        if (pure.stats.length !== 1 || pure.kind === 'other' || pure.group === hybrid.group || !sameUnits(pure)) continue;
        if (shapeOf(pure.stats[0]) !== shapeOf(hybrid.stats[k])) continue;
        for (const h of tried) {
          const p = shown - h;
          if (h < min || h > max || p < pure.rolls[0].min || p > pure.rolls[0].max) continue;
          const hybridValues = k === 0 ? [h, partnerValue[0]] : [partnerValue[0], h];
          return { hybrid, pure, hybridValues, pureValues: [p], partner };
        }
      }
    }
  }
  return null;
}

export function mapCraft(raw: string, isUnique: boolean, lookups: CraftLookups): { craft: ItemCraft; notes: CraftNote[] } {
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const notes: CraftNote[] = [];
  const craft = emptyCraft(isUnique);

  const rarityWord = /^Rarity: (\w+)$/.exec(lines[0] ?? '')?.[1] ?? '';
  craft.rarity = isUnique ? 'unique' : (RARITY[rarityWord] ?? 'normal');
  if (craft.rarity === 'rare' || craft.rarity === 'magic') craft.name = lines[1] ?? null;
  craft.corrupted = lines.includes('Corrupted');

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
  // "Upgrades Radius to X" is not a stat: it sets the jewel's radius (PoB2 Item.lua:1823), over the "Radius:" header.
  const upgrade = /^Upgrades Radius to ([A-Za-z ]+)$/;
  const explicitLines = (implicitsAt === -1 ? [] : lines.slice(implicitsAt + 1 + implicitCount)).filter((l) => {
    if (l === 'Corrupted' || !inSelectedVariant(l)) return false;
    const radiusUpgrade = upgrade.exec(stripTags(l));
    if (radiusUpgrade) craft.radius = radiusUpgrade[1];
    return !radiusUpgrade;
  });

  const verbatim: string[] = [];
  const crafted: Record<'prefix' | 'suffix', CraftedMod[]> = { prefix: [], suffix: [] };
  let isCrafted = false;
  let runeLinesSeen = 0;
  for (const line of header) {
    const quality = /^Quality: (\d+)$/.exec(line);
    if (quality) {
      craft.quality = Math.min(MAX_ITEM_QUALITY, Number(quality[1]));
      if (Number(quality[1]) > MAX_ITEM_QUALITY) {
        notes.push({ kind: 'inferred', message: `Quality ${quality[1]}% is above the ${MAX_ITEM_QUALITY}% this builder stores, so it was kept at ${MAX_ITEM_QUALITY}%; the item's own defences will read slightly low.` });
      }
    }
    const level = /^Item Level: (\d+)$/.exec(line);
    if (level) craft.itemLevel = Math.min(100, Math.max(1, Number(level[1])));
    const radius = /^Radius: ([A-Za-z ]+)$/.exec(line);
    if (radius && craft.radius === undefined) craft.radius = radius[1];
    const rune = /^Rune: (.+)$/.exec(line);
    if (rune) {
      runeLinesSeen++;
      const slug = lookups.runeSlugByName(rune[1]);
      if (slug) craft.runes.push(slug);
      else notes.push({ kind: 'dropped', message: `The rune "${rune[1]}" is not in this patch's data, so it was not kept.` });
    }
    const affix = /^(Prefix|Suffix): (?:\{range:([\d.]+)\})?(\S+)$/.exec(line);
    if (affix) {
      isCrafted = true;
      if (affix[3] === 'None') continue;
      const mod = lookups.modById(affix[3]);
      if (!mod) {
        notes.push({ kind: 'dropped', message: `The mod ${affix[3]} is not in this patch's data, so it was not kept.` });
        continue;
      }
      const fraction = affix[2] === undefined ? 0.5 : Number(affix[2]);
      crafted[affix[1] === 'Prefix' ? 'prefix' : 'suffix'].push({ slug: mod.slug, values: mod.rolls.map((r) => valueAt(r.min, r.max, fraction)) });
    }
  }
  if (craft.runes.length > MAX_RUNES) craft.runes = craft.runes.slice(0, MAX_RUNES);
  // A rune our data lacks is dropped from `runes` but still fills its socket ("per Socket filled" counts it).
  if (runeLinesSeen > craft.runes.length) craft.filledSockets = Math.min(MAX_RUNES, runeLinesSeen);

  // Implicits: an {enchant} line is an enchantment, or rune-granted if also {rune}.
  const baseImplicits: string[] = [];
  const printedRunes: string[] = [];
  for (const line of implicitLines) {
    if (line.includes('{enchant}')) {
      if (line.includes('{rune}')) printedRunes.push(resolveLine(line));
      if (!line.includes('{rune}')) {
        if (keepVerbatim(line, verbatim)) {
          notes.push({ kind: 'inferred', message: `The enchantment "${stripTags(line)}" was kept as written and counted from its text.` });
        } else {
          notes.push({ kind: 'dropped', message: `The enchantment "${stripTags(line)}" was not kept — enchantments come in a later update.` });
        }
      }
      continue;
    }
    baseImplicits.push(line);
  }
  craft.implicitValues = matchLines(baseImplicits, lookups.base?.implicitLines ?? [], notes, 'The implicit', verbatim);

  if (isUnique) {
    // A corrupted unique can lose a line (Atziri's Step prints no "+(70-100) to maximum Life"): PoB counts what it
    // prints, so a template line with no printed counterpart must not fall back to a mid-roll. Only for a corrupted
    // item: an uncorrupted one missing a line is an export from another patch (the Cloak of Flame fixture), where
    // the data's current line is the better guess.
    const printed = joinSocketEffectLines(
      explicitLines.filter((l) => !l.includes('{rune}')),
      verbatim,
    );
    const matched = new Set<number>();
    const templates = lookups.base?.uniqueLines ?? [];
    craft.uniqueValues = matchLines(printed, templates, notes, 'The unique line', verbatim, matched);
    // Way of the Stonefist (and any effect like it) turns a unique's base into another one and its explicit lines into
    // different ones: PoB prints the transformed item and counts only what it prints. A Runemastered/Runeforged base keeps
    // the original name inside its own, so a printed base that does not contain the unique's base is a transformed item.
    const baseType = lookups.base?.baseType;
    const printedBase = lines[2];
    const transformed = baseType !== undefined && printedBase !== undefined && !/^(Rarity|Item Level|Quality|Sockets|Unique ID|LevelReq|Implicits|Rune|Selected Variant):/.test(printedBase) && !printedBase.includes(baseType);
    if ((craft.corrupted || transformed) && printed.length > 0) {
      const absent = templates.map((_, i) => i).filter((i) => !matched.has(i));
      if (absent.length > 0) craft.absentLines = absent;
    }
  } else if (isCrafted) {
    craft.prefixes = crafted.prefix;
    craft.suffixes = crafted.suffix;
  } else {
    const pasted = explicitLines.filter((l) => !l.includes('{rune}')).map(stripTags);
    const twoAt = (i: number) =>
      lookups.candidates.find(
        (c) => c.stats.length === 2 && i + 1 < pasted.length && matchTemplate(pasted[i], c.stats[0]) && matchTemplate(pasted[i + 1], c.stats[1]),
      );
    const oneMatches = (i: number) => lookups.candidates.filter((c) => c.stats.length === 1 && matchTemplate(pasted[i], c.stats[0]) !== null);

    // Pre-pass: a line no single tier (or in-range hybrid) can print may be two
    // mods summed; its partner line can sit anywhere, so find the splits first.
    const splits = new Map<number, SummedSplit>();
    const consumed = new Set<number>();
    for (let i = 0; i < pasted.length; i++) {
      if (consumed.has(i) || twoAt(i) || oneMatches(i).length > 0) continue;
      const shown = matchTemplateAny(pasted[i], lookups.candidates);
      if (shown === null) continue;
      const split = splitSummed(shown, i, pasted, consumed, lookups.candidates);
      if (!split) continue;
      splits.set(i, split);
      consumed.add(i);
      consumed.add(split.partner);
    }

    for (let i = 0; i < pasted.length; i++) {
      const split = splits.get(i);
      if (split) {
        for (const [m, values] of [[split.hybrid, split.hybridValues], [split.pure, split.pureValues]] as const) {
          (m.kind === 'prefix' ? craft.prefixes : craft.suffixes).push({ slug: m.slug, values });
        }
        notes.push({
          kind: 'inferred',
          message: `"${pasted[i]}" is two mods added together (${split.hybrid.slug} and ${split.pure.slug}); the game shows only the sum, so the split between them is assumed.`,
        });
        continue;
      }
      if (consumed.has(i)) continue;
      const two = twoAt(i);
      const one = two ? undefined : pickOne(oneMatches(i), craft, lookups.candidates);
      const hit = two ?? one;
      if (!hit || hit.kind === 'other') {
        // A shown value above every tier is the real value; where the text is readable it is kept as written,
        // not clamped to the top tier (which short-changed the sheet by the overshoot).
        if (!hit && closestLegal(pasted[i], lookups.candidates, craft) && keepVerbatim(pasted[i], verbatim)) {
          notes.push({ kind: 'inferred', message: `"${pasted[i]}" is above the highest roll this base can have for it (quality or a catalyst), so it was kept as written and counted from its text.` });
          continue;
        }
        const capped = hit ? undefined : closestLegal(pasted[i], lookups.candidates, craft);
        if (capped) {
          (capped.mod.kind === 'prefix' ? craft.prefixes : craft.suffixes).push({ slug: capped.mod.slug, values: capped.values });
          notes.push({
            kind: 'inferred',
            message: `"${pasted[i]}" is above the highest roll this base can have for it, so it was kept at ${capped.mod.slug}'s best roll (${capped.values.join(', ')}); a roll past its top tier usually means a quality or catalyst scaling this builder does not model.`,
          });
          continue;
        }
        if (!hit && keepVerbatim(pasted[i], verbatim)) {
          notes.push({ kind: 'inferred', message: `The mod line "${pasted[i]}" matches nothing this base can roll, so it was kept as written and counted from its text.` });
          continue;
        }
        notes.push({ kind: 'dropped', message: `The mod line "${pasted[i]}" matches nothing this base can roll, so it was not kept.` });
        continue;
      }
      const shown = two ? [...matchTemplate(pasted[i], hit.stats[0])!, ...matchTemplate(pasted[i + 1], hit.stats[1])!] : matchTemplate(pasted[i], hit.stats[0])!;
      let values = shown;
      if (!sameUnits(hit)) {
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
  if (verbatim.length > 0) craft.verbatim = verbatim.slice(0, MAX_VERBATIM_LINES);
  if (printedRunes.length > 0) craft.runeLines = printedRunes.slice(0, MAX_VERBATIM_LINES);
  return { craft, notes };
}
