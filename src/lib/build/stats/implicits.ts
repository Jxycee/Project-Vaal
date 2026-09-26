// src/lib/build/stats/implicits.ts
// =============================================================================
// An item's implicits -> typed stat values (Slice 5). Pure.
//
// Two sources describe one implicit: the TYPED mods (implicit-stats.json, per
// base, [stat, min, max] as stored) and the DISPLAY lines (the item file's
// implicitMods), which is what the editor shows a value input for and what
// `craft.implicitValues` is indexed by. They do not line up 1:1 on every base
// (measured 2026-09-25: 132 of 476 typed bases differ in count), so this
// pairs them first and only then reads a chosen value:
//
//  - Same count: line i is mod i. On all 344 such bases each line's "(a-b)"
//    ranges are exactly its mod's varying stats, in order.
//  - Otherwise, a varying mod pairs with the next line whose ranges equal its
//    stored ranges (or their negation — "reduced" lines store negative);
//    failing that, varying mods pair with ranged lines by position when those
//    counts agree. A fixed-only mod left unpaired is a hidden stat (spear
//    throw, incursion limb) and counts as-is.
//
// A chosen value is mapped from its display range onto the stored range:
// identical, negated, or linearly scaled (regen shows per second, stores per
// minute). A unique carries its base's implicit under its own line index, so
// a base line is found in the worn item's lines by text; a base implicit the
// worn item does not show is not counted.
// =============================================================================

import { rangesIn, type ValueRange } from '../craft';

/** One typed implicit mod: its stats with stored min and max. */
export type TypedImplicit = [string, number, number][];

/** Words that mark a line as touching a defence the sheet reports. */
export const DEFENCE_WORDS = /Life|Mana|Energy Shield|Armour|Evasion|Resistance|Strength|Dexterity|Intelligence|Attributes|Spirit/;

export interface ImplicitResult {
  stats: [string, number][];
  /** True when any varying stat fell back to mid-roll. */
  assumedMidRoll: boolean;
  /** Worn lines touching a defence that no typed mod accounts for. */
  uncoveredLines: string[];
}

const varying = (mod: TypedImplicit) => mod.filter(([, min, max]) => min !== max);

function sameRanges(display: ValueRange[], mod: TypedImplicit): boolean {
  const v = varying(mod);
  if (v.length === 0 || v.length !== display.length) return false;
  return v.every(([, min, max], k) => {
    const d = display[k];
    return (d.min === min && d.max === max) || (d.min === -max && d.max === -min);
  });
}

/** A display-unit value -> the stored stat value. */
function toStored(value: number, d: ValueRange, min: number, max: number): number {
  if (d.min === min && d.max === max) return value;
  if (d.min === -max && d.max === -min) return -value;
  if (d.max === d.min) return min;
  return min + ((value - d.min) * (max - min)) / (d.max - d.min);
}

/** typed mod index -> base line index. */
function pairModsToLines(typed: TypedImplicit[], lines: string[]): Map<number, number> {
  const pairs = new Map<number, number>();
  if (typed.length === lines.length) {
    typed.forEach((_, i) => pairs.set(i, i));
    return pairs;
  }
  const ranges = lines.map((l) => rangesIn(l));
  const varyingMods = typed.map((m, i) => [i, m] as const).filter(([, m]) => varying(m).length > 0);
  let cursor = 0;
  for (const [i, mod] of varyingMods) {
    for (let j = cursor; j < lines.length; j++) {
      if (sameRanges(ranges[j], mod)) {
        pairs.set(i, j);
        cursor = j + 1;
        break;
      }
    }
  }
  if (pairs.size === varyingMods.length) return pairs;
  const ranged = ranges.map((r, j) => [j, r] as const).filter(([, r]) => r.length > 0);
  if (ranged.length === varyingMods.length && varyingMods.every(([, m], k) => varying(m).length === ranged[k][1].length)) {
    pairs.clear();
    varyingMods.forEach(([i], k) => pairs.set(i, ranged[k][0]));
  }
  return pairs;
}

/**
 * @param typed      the base's typed implicit mods (undefined = none typed)
 * @param baseLines  the base's display lines — what `typed` describes
 * @param wornLines  the worn item's display lines — what `rows` is indexed by
 *                   (the base's own lines for a non-unique)
 * @param rows       craft.implicitValues
 */
export function implicitStats(
  typed: TypedImplicit[] | undefined,
  baseLines: string[],
  wornLines: string[],
  rows: readonly (readonly number[])[],
): ImplicitResult {
  const stats: [string, number][] = [];
  let assumedMidRoll = false;
  const mods = typed ?? [];
  const pairs = pairModsToLines(mods, baseLines);

  // Base line index -> worn line index, by text, each worn line used once.
  const claimedWorn = new Set<number>();
  const wornOf = (baseIndex: number): number | undefined => {
    const text = baseLines[baseIndex];
    const w = wornLines.findIndex((l, k) => l === text && !claimedWorn.has(k));
    if (w === -1) return undefined;
    claimedWorn.add(w);
    return w;
  };
  // A worn item that shows every base line carries the base's hidden stats too.
  const carriesBase = baseLines.every((l) => wornLines.includes(l));

  let unpairedCounted = false;
  mods.forEach((mod, i) => {
    const b = pairs.get(i);
    if (b === undefined) {
      if (!carriesBase) return;
      unpairedCounted = true;
      for (const [stat, min, max] of mod) {
        if (min !== max) assumedMidRoll = true;
        stats.push([stat, (min + max) / 2]);
      }
      return;
    }
    const w = wornOf(b);
    if (w === undefined) return;
    const display = rangesIn(wornLines[w]);
    const row = rows[w] ?? [];
    let k = 0;
    for (const [stat, min, max] of mod) {
      if (min === max) {
        stats.push([stat, min]);
        continue;
      }
      const chosen = row[k];
      const d = display[k];
      k++;
      if (chosen === undefined || d === undefined) {
        assumedMidRoll = true;
        stats.push([stat, (min + max) / 2]);
      } else {
        stats.push([stat, toStored(chosen, d, min, max)]);
      }
    }
  });

  // Unclaimed worn lines touching a defence are named — unless an unpaired
  // (hidden or unmatched) typed mod was counted and may be what they show.
  const uncoveredLines = unpairedCounted
    ? []
    : wornLines.filter((l, k) => !claimedWorn.has(k) && DEFENCE_WORDS.test(l));
  return { stats, assumedMidRoll, uncoveredLines };
}
