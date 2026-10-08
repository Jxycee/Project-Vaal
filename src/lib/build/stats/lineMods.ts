// src/lib/build/stats/lineMods.ts
// =============================================================================
// An item's display line ("+9 to all Attributes") -> the defence modifiers
// Path of Building 2 reads from it, using PoB's OWN parse of that text.
//
// Why this exists. Our item model stores an item as references into the wiki's
// mod pool (a slug plus rolls). A real character's item routinely carries a
// line that pool cannot hold: a desecrated/corrupted/essence mod the base's
// pool lacks, a unique our data never typed, a roll past the tier cap (quality
// and catalysts push it there), an "Allocates X" enchant. The importer used to
// drop or clamp those, so the sheet came out short by exactly that line. The
// line's text IS the truth (PoB shows the rolled value), so the importer now
// keeps it verbatim (ItemCraft.verbatim) and this module reads it.
//
// Source of the reading: src/lib/pob/data/modcache.json, PoB2's ModCache.lua
// (MIT, Copyright (c) 2016 David Gowor), the cache of "line text -> parsed
// modifiers" its hand-written parser produced. The cache is keyed by LITERAL
// text, so each key is turned into a template by blanking its number, and the
// parsed modifier's value is expressed as +/- that number ("+10 to all
// Attributes" parses to Str/Dex/Int BASE 10, so a template "+# to all
// Attributes" -> value = +n for each).
//
// FAILURE MODES (decided before the code; covered end to end by the oracles, not by a unit test:
// multiOracle.test.ts and momentsZX.oracle.test.ts, plus the mapCraft and roundTrip cases):
//   1. A line with a condition, a per-X scaling or a multiplier ("while on Low
//      Life", "per Frenzy Charge", "+1 Life per 4 Dexterity"). Not a flat
//      sheet number: the template is not indexed, the line reads as unmodelled
//      and the collector names it in notCounted. Never guessed.
//   2. A template whose cached value is not the line's number (the cache key
//      "+1 Life per 4 Dexterity" caches Life at 1 beside the number 4): skipped,
//      because dividing it out would be a guess.
//   3. A partly parsed entry (PoB left `rest` text over, e.g. "...% to
//      Cold Resistance while affected by Herald of Ice"): skipped.
//   4. Two cache entries that normalise to the same template but disagree on
//      the modifiers: the template is dropped, not resolved by order.
//   5. A line with more than one number ("Adds 13 to 22 Cold damage"): never
//      matches a one-number template, reads as unmodelled/ignored.
//   6. A modifier name we do not report (Ward, Deflection): not turned into a
//      contribution; the line reads as unmodelled so it is named.
//   7. Fragments of a wrapped line ("enemy affected by Abyssal Wasting") or a
//      pure offence line: no template, so null = "not a defence line", silently
//      ignored by the caller (it is only named when it LOOKS like a defence).
// =============================================================================

import modcache from '@/lib/pob/data/modcache.json';
import type { Pool } from './statTable';

/**
 * A Time-Lost jewel's "Notable / Small Passive Skills in Radius also grant <line>" (PoB2 ModParser.lua:7170). The
 * inner line is read by readLine; how many passives it reaches is collect.ts's job (the jewel's radius).
 */
export const RADIUS_GRANT_LINE = /^(Small|Notable) Passive Skills in Radius also grant (.+)$/;

export interface LineMod {
  pool: Pool;
  kind: 'flat' | 'increased' | 'more';
  value: number;
}

export type LineRead =
  /** A recognised, unconditional defence modifier (or several, e.g. "all Attributes"). */
  | { mods: LineMod[]; global: boolean }
  /** A defence line PoB parses but with a condition or scaling we do not model. */
  | { unmodelled: string };

interface CachedMod {
  name: string;
  type: string;
  value: number;
  tagType?: string;
}
type CacheEntry = { mods: CachedMod[]; rest?: string };

const NUMBER = /-?\d+(?:\.\d+)?/g;

/** PoB modifier name -> the pools it feeds. */
const POOLS: Record<string, Pool[]> = {
  Life: ['life'],
  Mana: ['mana'],
  EnergyShield: ['energyShield'],
  Armour: ['armour'],
  Evasion: ['evasion'],
  Spirit: ['spirit'],
  Str: ['str'],
  Dex: ['dex'],
  Int: ['int'],
  AllAttributes: ['str', 'dex', 'int'],
  FireResist: ['fireRes'],
  ColdResist: ['coldRes'],
  LightningResist: ['lightningRes'],
  ChaosResist: ['chaosRes'],
  ElementalResist: ['fireRes', 'coldRes', 'lightningRes'],
  FireResistMax: ['fireMax'],
  ColdResistMax: ['coldMax'],
  LightningResistMax: ['lightningMax'],
  ChaosResistMax: ['chaosMax'],
  ElementalResistMax: ['fireMax', 'coldMax', 'lightningMax'],
  MaxResist: ['fireMax', 'coldMax', 'lightningMax', 'chaosMax'],
};
const KINDS: Record<string, LineMod['kind']> = { BASE: 'flat', INC: 'increased', MORE: 'more' };

interface Template {
  /** Per modifier: its pools, kind and the sign it applies to the line's number. */
  mods: { pools: Pool[]; kind: LineMod['kind']; sign: 1 | -1 }[];
  global: boolean;
}

let templates: Map<string, Template | null> | undefined;

/** What one cache entry says about its template: a flat reading, or null when it cannot be one (conditional, scaled, partly parsed, not ours). */
function derive(entry: CacheEntry, n: number): Template | null {
  const mods = entry.mods ?? [];
  if (entry.rest !== undefined || mods.length === 0 || n === 0) return null;
  if (mods.some((m) => m.tagType !== undefined && m.tagType !== 'Global')) return null;
  const read: Template['mods'] = [];
  for (const m of mods) {
    const pools = POOLS[m.name];
    const kind = KINDS[m.type];
    // The cached value must be the line's number up to sign; anything else is a scaling we cannot invert.
    if (!pools || !kind || typeof m.value !== 'number' || Math.abs(m.value) !== Math.abs(n)) return null;
    read.push({ pools, kind, sign: Math.sign(m.value) === Math.sign(n) ? 1 : -1 });
  }
  return { mods: read, global: mods.some((m) => m.tagType === 'Global') };
}

function build(): Map<string, Template | null> {
  const out = new Map<string, Template | null>();
  for (const [text, entry] of Object.entries(modcache as Record<string, CacheEntry>)) {
    const numbers = text.match(NUMBER) ?? [];
    const key = text.replace(NUMBER, '#');
    const template = numbers.length === 1 ? derive(entry, Number(numbers[0])) : null;
    // A key seen twice must read the same both times (failure mode 4); null poisons the template.
    if (!out.has(key)) out.set(key, template);
    else if (JSON.stringify(out.get(key)) !== JSON.stringify(template)) out.set(key, null);
  }
  return out;
}

/**
 * Reads one display line (PoB's `{...}` markup already removed, ranges already resolved to a number).
 * null = not a line this reader has a template for (offence, fragments, unknown shapes).
 */
export function readLine(line: string): LineRead | null {
  templates ??= build();
  const numbers = line.match(NUMBER) ?? [];
  if (numbers.length !== 1) return null;
  const template = templates.get(line.replace(NUMBER, '#'));
  if (template === undefined) return null;
  if (template === null) return { unmodelled: line };
  const n = Number(numbers[0]);
  return { mods: template.mods.flatMap((m) => m.pools.map((pool) => ({ pool, kind: m.kind, value: m.sign * n }))), global: template.global };
}
