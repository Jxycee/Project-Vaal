// src/lib/build/stats/legacies.ts
// =============================================================================
// Mageblood's Mage's Legacies -> the defence modifiers Path of Building 2 adds
// for them. Ported from PoB2 (MIT, Copyright (c) 2016 David Gowor), `dev` branch,
// read raw on 2026-10-07:
//   table of legacies   src/Modules/CalcPerform.lua:66-143
//   the duplicate loop  src/Modules/CalcPerform.lua:1551-1578
//   line -> modifier    src/Modules/ModParser.lua:5645-5650
//
// Why this exists. A Mageblood worn line is "Legacy of Bismuth", which neither the wiki
// pool (it types each legacy as a long descriptive sentence) nor PoB's ModCache holds as a
// number, so the legacies' effect was never counted: the wearer's resistances came out
// short by the whole legacy. PoB does not read them from the text either; it counts each
// legacy by NAME and builds the modifiers in CalcPerform, scaled by how many DUPLICATE
// legacies the belt has. This module is that calculation, for the pools the sheet reports.
//
// FAILURE MODES (decided before the code; covered end to end by the ordinary-ci-es-disciple
// oracle in multiOracle.test.ts, whose three elemental resistances are exactly this belt):
//   1. The same legacy worn several times (Quicksilver x3). Every copy past the first is a
//      DUPLICATE and adds to the effect of ALL legacies; the legacy's own modifier is added
//      ONCE, not once per copy (PoB keys `legacyCountByName` by name). Counting per copy
//      would triple Quicksilver and, worse, miss that the duplicates strengthen Bismuth.
//   2. The effect line is absent or has no number. PoB then sums no "MagesLegacyEffect", so
//      the multiplier is 1: no duplicate bonus. An unreadable number is never guessed.
//   3. The scaled value is fractional (Bismuth 45 x 1.7 = 76.5). PoB floors it (m_floor), so
//      does this: rounding would give 77 and miss PoB's 76.
//   4. A legacy whose effect is not a defence (crit chance, rarity, movement speed, skill
//      speed, damage): counted as a duplicate for the multiplier, but contributes nothing.
//   5. An unknown legacy name (a later patch adds one): it still counts as a duplicate
//      carrier, contributes nothing, and the caller names it in notCounted instead of
//      pretending it was read.
//   6. "Legacy of Bismuth" is ELEMENTAL resistance: fire, cold and lightning, never chaos.
//   7. Armour and Evasion BASE are global flats (untagged slot), INC are global increases:
//      PoB adds them to the modDB with no slot, so the engine's global branch is the right one.
// =============================================================================

import type { Contribution } from './engine';

type Effect = { pools: Contribution['pool'][]; kind: Contribution['kind']; value: number };

/** CalcPerform.lua:66-143. Entries that move no reported defence are an empty `effects`. */
const LEGACIES: Record<string, Effect[]> = {
  Amethyst: [{ pools: ['chaosRes'], kind: 'flat', value: 45 }],
  Basalt: [{ pools: ['armour'], kind: 'increased', value: 150 }],
  Bismuth: [{ pools: ['fireRes', 'coldRes', 'lightningRes'], kind: 'flat', value: 45 }],
  Diamond: [],
  Gold: [],
  Granite: [{ pools: ['armour'], kind: 'flat', value: 2000 }],
  Jade: [{ pools: ['evasion'], kind: 'flat', value: 2000 }],
  Quicksilver: [],
  Ruby: [
    { pools: ['fireRes'], kind: 'flat', value: 60 },
    { pools: ['fireMax'], kind: 'flat', value: 5 },
  ],
  Sapphire: [
    { pools: ['coldRes'], kind: 'flat', value: 60 },
    { pools: ['coldMax'], kind: 'flat', value: 5 },
  ],
  Silver: [],
  Stibnite: [{ pools: ['evasion'], kind: 'increased', value: 150 }],
  Sulphur: [],
  Topaz: [
    { pools: ['lightningRes'], kind: 'flat', value: 60 },
    { pools: ['lightningMax'], kind: 'flat', value: 5 },
  ],
};

const LEGACY_LINE = /^Legacy of (\w+)$/;
/** The Mageblood line that sets how much each duplicate adds (ModParser.lua:5650). */
export const LEGACY_EFFECT_LINE = /^All Mage's Legacies have (?:\((\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)\)|(\d+(?:\.\d+)?))% increased effect per duplicate Mage's Legacy you have$/;

/** Whether a worn line is one legacy ("Legacy of Bismuth"). Used by the importer to keep it as written. */
export function isLegacyLine(text: string): boolean {
  return LEGACY_LINE.test(text);
}

/**
 * The contributions of the legacies named by `lines` (an item's worn lines; others are ignored), with
 * `effectPerDuplicate` the percent from the effect line (undefined = no number, no duplicate bonus).
 * `unknown` collects the names this table does not know.
 */
export function legacyContributions(lines: readonly string[], effectPerDuplicate: number | undefined, source: string, unknown: string[]): Contribution[] {
  const copies = new Map<string, number>();
  for (const line of lines) {
    const name = LEGACY_LINE.exec(line)?.[1];
    if (name) copies.set(name, (copies.get(name) ?? 0) + 1);
  }
  let duplicates = 0;
  for (const n of copies.values()) if (n > 1) duplicates += n - 1;
  const effect = 1 + duplicates * ((effectPerDuplicate ?? 0) / 100);
  const out: Contribution[] = [];
  for (const name of copies.keys()) {
    const effects = LEGACIES[name];
    if (!effects) {
      unknown.push(name);
      continue;
    }
    for (const e of effects) {
      const value = Math.floor(effect * e.value);
      for (const pool of e.pools) out.push({ pool, kind: e.kind, value, source });
    }
  }
  return out;
}
