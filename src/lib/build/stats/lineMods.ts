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
//   1. A line with a per-X scaling or a multiplier ("per Frenzy Charge", "+1 Life
//      per 4 Dexterity"). Not a flat sheet number: the template is not indexed,
//      the line reads as unmodelled and the collector names it in notCounted.
//      Never guessed.
//   1b. A line with exactly ONE Condition tag ("40% increased Evasion Rating while
//      moving", Condition:Moving) is a flat number that counts only when the
//      build's Path of Building Configuration has that condition (buildConfig.ts);
//      the mod carries `condition`. A negated one ("if you haven't been Hit
//      Recently") counts when the flag is NOT set; the cache drops PoB's `neg`
//      flag, so negation is read from the line's own words. A line that also says
//      "per" is not read (the cache keeps only a mod's first tag, so a second,
//      Multiplier, tag could hide behind the Condition).
//   2. A template whose cached value is not the line's number (the cache key
//      "+1 Life per 4 Dexterity" caches Life at 1 beside the number 4): skipped,
//      because dividing it out would be a guess.
//   3. A partly parsed entry (PoB left `rest` text over, e.g. "...% to
//      Cold Resistance while affected by Herald of Ice"): skipped.
//   4. Two cache entries that normalise to the same template but disagree on
//      the modifiers: the template is dropped, not resolved by order.
//   5. A line with more than one number ("Adds 13 to 22 Cold damage"): never
//      matches a one-number template, reads as unmodelled/ignored.
//   6. A modifier name we do not report: not turned into a contribution; the line reads as unmodelled so it is
//      named. (Ward, Deflection, movement speed, charges and regeneration ARE reported now - POOLS below.)
//   8. "... per Socket filled" (Morior Invictus): PoB scales the value by the runes in that item
//      (Multiplier:RunesSocketedIn<slot>). Read with perSocket set; collect.ts multiplies by the filled sockets.
//      The cache keeps only a mod's FIRST tag, so the Global-tagged "increased Global Armour, Evasion and Energy
//      Shield per Socket filled" lines lose their Multiplier: the line's own words decide. A per-socket line that
//      also carries a Condition is not read. An item with no runes multiplies by 0 (adds nothing, never a guess).
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
  /** Counts only while this PoB condition is true (or, negated, false). Absent = always. */
  condition?: { name: string; negate: boolean };
  /** "... per Socket filled": the value is per rune in the item's sockets, so the caller multiplies it by that count. */
  perSocket?: boolean;
  /** "... per socketed Grand Spectrum": the value is per item of this kind worn; the caller multiplies it by that count (collect.ts). */
  multiplier?: string;
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
  tagVar?: string;
}
type CacheEntry = { mods: CachedMod[]; rest?: string };

const NUMBER = /-?\d+(?:\.\d+)?/g;

/** PoB modifier name -> the pools it feeds. */
export const POOLS: Record<string, Pool[]> = {
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
  AuraEffect: ['auraEffect'],
  // The derived defence stats (engine.ts). Values stay in PoB's own units: percent points, life regen per second.
  MovementSpeed: ['movementSpeed'],
  LifeRegen: ['lifeRegen'],
  LifeRegenPercent: ['lifeRegenPercent'],
  EnergyShieldRecharge: ['esRecharge'],
  EnergyShieldRechargeFaster: ['esRechargeFaster'],
  EnduranceChargesMax: ['maxEndurance'],
  FrenzyChargesMax: ['maxFrenzy'],
  PowerChargesMax: ['maxPower'],
  DeflectionRating: ['deflection'],
  EvasionGainAsDeflection: ['evasionToDeflection'],
  ArmourGainAsDeflection: ['armourToDeflection'],
  BlindEffect: ['blindEffect'],
  PhysicalDamageReduction: ['physReduction'],
  Ward: ['ward'],
  'EffectOfBonusesFromRing 1': ['effectRing1'],
  'EffectOfBonusesFromRing 2': ['effectRing2'],
  'EffectOfBonusesFromRing 3': ['effectRing3'],
  EffectOfBonusesFromAmulet: ['effectAmulet'],
};

const KINDS: Record<string, LineMod['kind']> = { BASE: 'flat', INC: 'increased', MORE: 'more' };

interface Template {
  /** Per modifier: its pools, kind and the sign it applies to the line's number. */
  mods: { pools: Pool[]; kind: LineMod['kind']; sign: 1 | -1 }[];
  global: boolean;
  condition?: { name: string; negate: boolean };
  perSocket?: boolean;
  multiplier?: string;
}

/**
 * Multipliers PoB counts from the gear itself, so a line scaled by one is a number we can read: the count of equipped
 * Grand Spectrum jewels (Item.lua adds Multiplier:GrandSpectrum 1 for each, ModParser "per Grand Spectrum").
 * Any other Multiplier (a charge count, a stat) stays unmodelled.
 */
export const GEAR_MULTIPLIERS: ReadonlySet<string> = new Set(['GrandSpectrum']);

/** "+7 to all Attributes per Socket filled": PoB scales it by Multiplier:RunesSocketedIn<slot> (the runes in that item). */
const PER_SOCKET = /per Socket filled$/i;
const SOCKET_MULTIPLIER = /^RunesSocketedIn/;

/** "if you haven't been Hit Recently", "while not on Low Life": PoB's neg flag, which modcache.json does not keep. */
const NEGATED = /\b(haven't|have not|havent|hasn't|not|without|aren't|isn't)\b/i;

let templates: Map<string, Template | null> | undefined;

/** What one cache entry says about its template: a flat reading, or null when it cannot be one (conditional, scaled, partly parsed, not ours). */
function derive(entry: CacheEntry, n: number, text: string): Template | null {
  const mods = entry.mods ?? [];
  if (entry.rest !== undefined || mods.length === 0 || n === 0) return null;
  // One shared Condition tag is a gate; any other tag is a scaling we cannot invert.
  const conditions = new Set(mods.filter((m) => m.tagType === 'Condition').map((m) => m.tagVar));
  // "per Socket filled" is a scaling we CAN invert: the count of runes in the item. The cache keeps only a mod's
  // FIRST tag, so a line tagged Global ("12% increased Global Armour, Evasion and Energy Shield per Socket filled")
  // hides its Multiplier behind it; the line's own words say it scales, and the oracle confirms (12 x 5 sockets = 60).
  const perSocket = PER_SOCKET.test(text);
  const gated = conditions.size === 1 && typeof [...conditions][0] === 'string' && !/\bper\b/i.test(text);
  const socketTag = (m: CachedMod) => perSocket && m.tagType === 'Multiplier' && SOCKET_MULTIPLIER.test(m.tagVar ?? '');
  const gearTags = new Set(mods.filter((m) => m.tagType === 'Multiplier' && GEAR_MULTIPLIERS.has(m.tagVar ?? '')).map((m) => m.tagVar as string));
  const multiplier = gearTags.size === 1 && mods.every((m) => m.tagType === 'Multiplier' && m.tagVar === [...gearTags][0]) ? [...gearTags][0] : undefined;
  if (mods.some((m) => m.tagType !== undefined && m.tagType !== 'Global' && !socketTag(m) && !(gated && m.tagType === 'Condition') && !(multiplier && m.tagVar === multiplier))) return null;
  if (multiplier && (gated || perSocket)) return null;
  if (perSocket && gated) return null;
  if (conditions.size > 0 && !gated) return null;
  if (gated && mods.some((m) => m.tagType !== 'Condition')) return null;
  const read: Template['mods'] = [];
  for (const m of mods) {
    const pools = POOLS[m.name];
    const kind = KINDS[m.type];
    // The cached value must be the line's number up to sign; anything else is a scaling we cannot invert.
    if (!pools || !kind || typeof m.value !== 'number' || Math.abs(m.value) !== Math.abs(n)) return null;
    read.push({ pools, kind, sign: Math.sign(m.value) === Math.sign(n) ? 1 : -1 });
  }
  const condition = gated ? { name: [...conditions][0] as string, negate: NEGATED.test(text) } : undefined;
  return { mods: read, global: mods.some((m) => m.tagType === 'Global'), ...(condition ? { condition } : {}), ...(perSocket ? { perSocket } : {}), ...(multiplier ? { multiplier } : {}) };
}

function build(): Map<string, Template | null> {
  const out = new Map<string, Template | null>();
  for (const [text, entry] of Object.entries(modcache as Record<string, CacheEntry>)) {
    const numbers = text.match(NUMBER) ?? [];
    const key = text.replace(NUMBER, '#');
    // A line of "0%" ("0% to Cold Resistance", cached with leftover text) is no real line: letting it share a key
    // with "-15% to Cold Resistance" poisoned that template (failure mode 4) and dropped Sierran Inheritance's -15%.
    if (numbers.length === 1 && Number(numbers[0]) === 0) continue;
    const template = numbers.length === 1 ? derive(entry, Number(numbers[0]), text) : null;
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
  return {
    mods: template.mods.flatMap((m) => m.pools.map((pool) => ({ pool, kind: m.kind, value: m.sign * n, ...(template.condition ? { condition: template.condition } : {}), ...(template.perSocket ? { perSocket: true } : {}), ...(template.multiplier ? { multiplier: template.multiplier } : {}) }))),
    global: template.global,
  };
}
