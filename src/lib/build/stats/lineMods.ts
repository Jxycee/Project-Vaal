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
//   9. "Has +N to Evasion Rating per player level" (the Fists of Stone base, Way of the Stonefist): PoB adds N x character
//      level to the item's OWN defence, before its increases and quality (oracle: ordinary-martial-artist-*). Read as a local flat
//      with perLevel set; without the character level it would count as N, so the caller must pass the level.
//  10. "N% increased Armour from Equipped Body Armour" (Heart of the Well, 72% printed; Ancient Aegis): PoB tags it SlotName, so
//      it scales that slot's item alone, on top of the global increase. The cache keeps the tag's TYPE but not which slot, so
//      the line's own words name it; the mod carries `slot` (and itemClass Shield for a shield) and the engine scopes it.
//      A SlotName line with no slot we know, or with a "per" scaling, stays unmodelled. Read as global it would add 72% to
//      every item's Armour (a worse error than leaving it out), so a consumer that cannot scope by slot must not use it.
//   7. Fragments of a wrapped line ("enemy affected by Abyssal Wasting") or a
//      pure offence line: no template, so null = "not a defence line", silently
//      ignored by the caller (it is only named when it LOOKS like a defence).
// =============================================================================

import modcache from '@/lib/pob/data/modcache.json';
import type { GearSlot } from '../gearSlots';
import type { Pool } from './statTable';

/**
 * A Time-Lost jewel's "Notable / Small Passive Skills in Radius also grant <line>" (PoB2 ModParser.lua:7170). The
 * inner line is read by readLine; how many passives it reaches is collect.ts's job (the jewel's radius). A Timeless jewel
 * (Undying Hate) words the same thing "Conquered Attribute Passive Skills also grant +3 to all Attributes": once per
 * allocated "+5 to any Attribute" passive in its radius (oracle ordinary-shaman-1: three of them, +3 to each attribute each).
 */
export const RADIUS_GRANT_LINE = /^(Small|Notable|Conquered Attribute) Passive Skills(?: in Radius)? also grant (.+)$/;

/**
 * "28% increased bonuses gained from left Equipped Ring" (Ingenuity), "... from Equipped Rings", "... from Equipped Amulet",
 * "... from Equipped Rings and Amulets": PoB's EffectOfBonusesFrom<slot> INC. modcache.json lacks these lines, so the
 * words decide. The sum per slot becomes a second, scaled copy of that ring or amulet's modifiers (collect.ts
 * bonusEffectFromJewellery). "reduced" is the negative; the collector clamps the scale at 0.
 * Failure mode: a wording this does not match (e.g. "...from Equipped Ring" without left/right) stays unread, so the
 * line is named in notCounted by its caller, never guessed onto a slot.
 */
export const EFFECT_OF_BONUSES_LINE = /^(\d+(?:\.\d+)?)% (increased|reduced) bonuses gained from (left Equipped Ring|right Equipped Ring|Equipped Rings and Amulets|Equipped Rings|Equipped Amulet)$/;
const EFFECT_SLOTS: Record<string, Pool[]> = {
  'left Equipped Ring': ['effectRing1'],
  'right Equipped Ring': ['effectRing2'],
  'Equipped Rings': ['effectRing1', 'effectRing2', 'effectRing3'],
  'Equipped Amulet': ['effectAmulet'],
  'Equipped Rings and Amulets': ['effectRing1', 'effectRing2', 'effectRing3', 'effectAmulet'],
};

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
  /** "Has +3 to Evasion Rating per player level": the value is per character level, so the caller multiplies it by the level. */
  perLevel?: boolean;
  /** "... from Equipped Body Armour": scales only the item worn in this slot (one entry per slot it may sit in). */
  slot?: GearSlot;
  /** With a slot: counts only while the item there is of this class (a shield in an off-hand slot). */
  itemClass?: string;
  /** PoB parsed the line as ElementalResist(Max): the Smith's fire-to-cold/lightning conversion skips it. */
  allElemental?: true;
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
  EnergyShieldTotal: ['energyShieldTotal'],
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
  SurroundedMinimum: ['surroundedMinimum'],
  SurroundedArea: ['surroundedArea'],
  // The derived defence stats (engine.ts). Values stay in PoB's own units: percent points, life regen per second.
  MovementSpeed: ['movementSpeed'],
  LifeRegen: ['lifeRegen'],
  LifeRegenPercent: ['lifeRegenPercent'],
  LifeConvertToEnergyShield: ['lifeToEnergyShield'],
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
  mods: { pools: Pool[]; kind: LineMod['kind']; sign: 1 | -1; allElemental?: true }[];
  global: boolean;
  condition?: { name: string; negate: boolean };
  perSocket?: boolean;
  multiplier?: string;
  slots?: GearSlot[];
  itemClass?: string;
  /** A line with no number in it ("Evasion Rating is doubled if you have not been Hit Recently"): the value is the cache's own (100). */
  fixed?: number;
}

/**
 * Multipliers PoB counts from the gear itself, so a line scaled by one is a number we can read: the count of equipped
 * Grand Spectrum jewels (Item.lua adds Multiplier:GrandSpectrum 1 for each, ModParser "per Grand Spectrum") and corrupted worn
 * items (CalcSetup.lua adds Multiplier:CorruptedItem 1 for each: Morior Invictus's "1% increased Maximum Life for each Corrupted Item Equipped").
 * Any other Multiplier (a charge count, a stat) stays unmodelled.
 */
export const GEAR_MULTIPLIERS: ReadonlySet<string> = new Set(['GrandSpectrum', 'CorruptedItem']);

/** "+7 to all Attributes per Socket filled": PoB scales it by Multiplier:RunesSocketedIn<slot> (the runes in that item). */
const PER_SOCKET = /per Socket filled$/i;
/** "... from Equipped Body Armour": the slots PoB's SlotName tag names (ModParser.lua:1189-1197); a shield or focus sits in the off hand of either weapon set. */
const FROM_SLOT = /^[^]* from Equipped (Body Armour|Helmet|Gloves|Boots|Shield|Focus)$/i;
const SLOTS_OF: Record<string, { slots: GearSlot[]; itemClass?: string }> = {
  'body armour': { slots: ['body'] },
  helmet: { slots: ['head'] },
  gloves: { slots: ['gloves'] },
  boots: { slots: ['boots'] },
  shield: { slots: ['weapon1_off', 'weapon2_off'], itemClass: 'Shield' },
  focus: { slots: ['weapon1_off', 'weapon2_off'] },
};
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
  const fromSlot = !/\bper\b/i.test(text) ? FROM_SLOT.exec(text) : null;
  const slotted = fromSlot ? SLOTS_OF[fromSlot[1].toLowerCase()] : undefined;
  const slotTag = (m: CachedMod) => slotted !== undefined && m.tagType === 'SlotName' && m.type !== 'BASE';
  if (mods.some((m) => m.tagType !== undefined && m.tagType !== 'Global' && !socketTag(m) && !slotTag(m) && !(gated && m.tagType === 'Condition') && !(multiplier && m.tagVar === multiplier))) return null;
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
    read.push({ pools, kind, sign: Math.sign(m.value) === Math.sign(n) ? 1 : -1, ...(m.name === 'ElementalResist' || m.name === 'ElementalResistMax' ? { allElemental: true as const } : {}) });
  }
  const condition = gated ? { name: [...conditions][0] as string, negate: NEGATED.test(text) } : undefined;
  return { mods: read, global: mods.some((m) => m.tagType === 'Global'), ...(condition ? { condition } : {}), ...(perSocket ? { perSocket } : {}), ...(multiplier ? { multiplier } : {}), ...(slotted ? { slots: slotted.slots, ...(slotted.itemClass ? { itemClass: slotted.itemClass } : {}) } : {}) };
}

function build(): Map<string, Template | null> {
  const out = new Map<string, Template | null>();
  for (const [text, entry] of Object.entries(modcache as Record<string, CacheEntry>)) {
    const numbers = text.match(NUMBER) ?? [];
    const key = text.replace(NUMBER, '#');
    // A line of "0%" ("0% to Cold Resistance", cached with leftover text) is no real line: letting it share a key
    // with "-15% to Cold Resistance" poisoned that template (failure mode 4) and dropped Sierran Inheritance's -15%.
    if (numbers.length === 1 && Number(numbers[0]) === 0) continue;
    // A line with no number is a fixed-value modifier ("doubled" = MORE 100); read only when the cache gives one plain value.
    const cached = entry.mods?.[0]?.value;
    const fixed = numbers.length === 0 && typeof cached === 'number' && cached !== 0 ? derive(entry, cached, text) : null;
    const template = numbers.length === 1 ? derive(entry, Number(numbers[0]), text) : fixed ? { ...fixed, fixed: cached } : null;
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
  const effect = EFFECT_OF_BONUSES_LINE.exec(line.trim());
  if (effect) {
    const value = (effect[2] === 'reduced' ? -1 : 1) * Number(effect[1]);
    return { mods: EFFECT_SLOTS[effect[3]].map((pool) => ({ pool, kind: 'increased' as const, value })), global: true };
  }
  templates ??= build();
  const numbers = line.match(NUMBER) ?? [];
  if (numbers.length > 1) return null;
  const template = templates.get(line.replace(NUMBER, '#'));
  if (template === undefined) return null;
  if (numbers.length === 0 && template?.fixed === undefined) return null;
  if (template === null) return { unmodelled: line };
  const n = numbers.length === 0 ? template.fixed! : Number(numbers[0]);
  return {
    mods: template.mods.flatMap((m) => m.pools.flatMap((pool) => (template.slots ?? [undefined]).map((slot) => ({ pool, kind: m.kind, value: m.sign * n, ...(m.allElemental ? { allElemental: true as const } : {}), ...(slot ? { slot } : {}), ...(slot && template.itemClass ? { itemClass: template.itemClass } : {}), ...(template.condition ? { condition: template.condition } : {}), ...(template.perSocket ? { perSocket: true } : {}), ...(template.multiplier ? { multiplier: template.multiplier } : {}) })))),
    global: template.global,
  };
}

/**
 * A defence line that only exists on an item: the modcache above holds the text PoB parsed for passives and the gear
 * lines it has seen, and an item-local wording ("22% increased Evasion and Energy Shield", a corrupted implicit on The
 * Vertex) is often not in it. On an item with armour data these are LOCAL: they add to / scale the item's own
 * Armour, Evasion and Energy Shield before quality (PoB Item.lua armourData). Percent forms only name the three
 * defences; anything else (a "per", a condition, an extra word) is not read, never guessed.
 */
const LOCAL_WORD: Record<string, Pool> = { Armour: 'armour', 'Evasion Rating': 'evasion', Evasion: 'evasion', 'Energy Shield': 'energyShield' };
const LOCAL_INC = /^(\d+(?:\.\d+)?)% increased (Armour|Evasion Rating|Evasion|Energy Shield)(?:(?:, | and )(Armour|Evasion Rating|Evasion|Energy Shield))?(?:(?:, | and )(Armour|Evasion Rating|Evasion|Energy Shield))?$/;
const LOCAL_FLAT = /^\+(\d+(?:\.\d+)?) to (Armour|Evasion Rating|maximum Energy Shield)$/;

const LOCAL_PER_LEVEL = /^Has \+(\d+(?:\.\d+)?) to (Armour|Evasion Rating|maximum Energy Shield) per player level$/;

export function readLocalDefenceLine(line: string): LineMod[] | null {
  const text = line.trim();
  const perLevel = LOCAL_PER_LEVEL.exec(text);
  if (perLevel) return [{ pool: LOCAL_WORD[perLevel[2].replace('maximum ', '')], kind: 'flat', value: Number(perLevel[1]), perLevel: true }];
  const inc = LOCAL_INC.exec(text);
  if (inc) {
    const pools = new Set<Pool>();
    for (const word of inc.slice(2)) if (word !== undefined) pools.add(LOCAL_WORD[word]);
    return [...pools].map((pool) => ({ pool, kind: 'increased' as const, value: Number(inc[1]) }));
  }
  const flat = LOCAL_FLAT.exec(text);
  if (flat) return [{ pool: LOCAL_WORD[flat[2].replace('maximum ', '')], kind: 'flat', value: Number(flat[1]) }];
  return null;
}
