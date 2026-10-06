// src/lib/build/stats/runes.ts
// =============================================================================
// Rune and soul-core effects on the item they are socketed in (Slice 5). Pure.
//
// PoB2 gathers, for each socketed rune, the effect table for the item's BROAD
// type — "weapon", "armour" or "caster" — and the one for its SPECIFIC type
// (its item class: "helmet", "bow", "quarterstaff"…); both apply, additively
// (src/Classes/Item.lua:2179-2198, MIT, Copyright (c) 2016 David Gowor; the
// types come from ItemClass:GetSocketedAugmentTypes, Item.lua:2378-2391:
// weapon if the base is a weapon, else armour if it has armour data, else
// caster for a wand, staff or sceptre). "Bonded:" lines are built for display
// only and are not part of the text PoB parses into modifiers
// (Item.lua:2146-2147), so they are never counted here either.
//
// Our wiki files a rune's effects as text per equipment-category LABEL
// (`soulCoreEffects`), not as PoB's keyed tables, so this maps a label back to
// the same rule: "Martial Weapon" and "Weapon" are PoB's "weapon", "Armour"
// is "armour", "All Equipment" is every one of those, and anything else names
// item classes ("Helmet", "Crossbow, Bow or Spear", "Shields and Bucklers").
//
// A line becomes a typed stat id the engine already reads (statTable.ts), so
// "increased Armour, Evasion and Energy Shield" is the LOCAL id and scales the
// socketed item's own defences, exactly as PoB's own item header shows
// (momentsZX's body armour: "Evasion: 945" reproduces only with the two Greater
// Iron Runes' 36% added to the 104% already on the item).
// =============================================================================

import { DEFENCE_WORDS } from './implicits';

/** What the rule needs to know about the socketed item. */
export interface RuneHost {
  /** The item file's `itemClass` ("Helmet", "Bow", "Warstaff"…). */
  itemClass: string | null;
  /** The item file carries weapon data. */
  weapon: boolean;
  /** The item file carries armour data (armour, shield, focus, buckler). */
  armour: boolean;
}

const CASTER_CLASSES = new Set(['wand', 'staff', 'sceptre']);

/** Class labels our data uses, singular and lowercase. A label token outside this and the broad words is unknown. */
const CLASS_TOKENS = new Set([
  'helmet',
  'body armour',
  'gloves',
  'boots',
  'bow',
  'crossbow',
  'spear',
  'talisman',
  'quarterstaff',
  'staff',
  'wand',
  'sceptre',
  'focus',
  'shield',
  'buckler',
  'one hand mace',
  'two hand mace',
]);
const BROAD_TOKENS = new Set(['martial weapon', 'weapon', 'armour', 'all equipment', 'caster weapon']);

const singular = (t: string) => (t === 'shields' ? 'shield' : t === 'bucklers' ? 'buckler' : t);

function tokensOf(category: string): string[] {
  return category
    .split(/,\s*|\s+or\s+|\s+and\s+/i)
    .map((t) => singular(t.trim().toLowerCase()))
    .filter(Boolean);
}

/** Whether every token of a category label is one this module knows. */
export function isKnownCategory(category: string): boolean {
  return tokensOf(category).every((t) => CLASS_TOKENS.has(t) || BROAD_TOKENS.has(t));
}

/** Whether a rune's category label applies to the host item (PoB2 Item.lua:2186-2192, 2378-2391). */
export function categoryApplies(category: string, host: RuneHost): boolean {
  const cls = (host.itemClass ?? '').toLowerCase();
  const caster = CASTER_CLASSES.has(cls);
  const martial = host.weapon && !caster;
  return tokensOf(category).some((t) => {
    switch (t) {
      case 'martial weapon':
      case 'weapon':
        return martial;
      case 'armour':
        return host.armour;
      case 'caster weapon':
        return caster;
      case 'all equipment':
        return martial || host.armour || caster;
      case 'quarterstaff':
        return cls === 'quarterstaff' || cls === 'warstaff';
      default:
        return t === cls;
    }
  });
}

const RESIST: Record<string, string> = { Fire: 'fire', Cold: 'cold', Lightning: 'lightning', Chaos: 'chaos' };

/** Rune line shapes the engine models -> the stat id each reads as. The number is the line's first. */
const LINE_STATS: [RegExp, (m: RegExpExecArray) => string][] = [
  [/^[+-]?\d+(?:\.\d+)? to Strength$/, () => 'additional_strength'],
  [/^[+-]?\d+(?:\.\d+)? to Dexterity$/, () => 'additional_dexterity'],
  [/^[+-]?\d+(?:\.\d+)? to Intelligence$/, () => 'additional_intelligence'],
  [/^[+-]?\d+(?:\.\d+)? to all Attributes$/, () => 'additional_all_attributes'],
  [/^[+-]?\d+(?:\.\d+)? to maximum Life$/, () => 'base_maximum_life'],
  [/^[+-]?\d+(?:\.\d+)? to maximum Mana$/, () => 'base_maximum_mana'],
  [/^[+-]?\d+(?:\.\d+)? to maximum Energy Shield$/, () => 'base_maximum_energy_shield'],
  [/^[+-]?\d+(?:\.\d+)? to Spirit$/, () => 'base_spirit_from_equipment'],
  [/^[+-]?\d+(?:\.\d+)?% to (Fire|Cold|Lightning|Chaos) Resistance$/, (m) => `base_${RESIST[m[1]]}_damage_resistance_%`],
  [/^[+-]?\d+(?:\.\d+)?% to all Elemental Resistances$/, () => 'base_resist_all_elements_%'],
  [/^[+-]?\d+(?:\.\d+)?% to Maximum (Fire|Cold|Lightning) Resistance$/, (m) => `base_maximum_${RESIST[m[1]]}_damage_resistance_%`],
  [/^[+-]?\d+(?:\.\d+)?% to all Maximum Elemental Resistances$/, () => 'additional_maximum_all_elemental_resistances_%'],
  [/^\d+(?:\.\d+)?% increased maximum Life$/, () => 'maximum_life_+%'],
  [/^\d+(?:\.\d+)?% increased maximum Mana$/, () => 'maximum_mana_+%'],
  [/^\d+(?:\.\d+)?% reduced maximum Mana$/, () => 'maximum_mana_+%'],
  [/^\d+(?:\.\d+)?% increased Spirit$/, () => 'spirit_+%'],
  [/^\d+(?:\.\d+)?% reduced Spirit$/, () => 'spirit_+%'],
  // Local: the socketed item's own Armour, Evasion and Energy Shield.
  [/^\d+(?:\.\d+)?% increased Armour, Evasion and Energy Shield$/, () => 'local_armour_and_evasion_and_energy_shield_+%'],
];

/** Lines that touch a sheet word but are recovery, cost or requirement text — not a number the sheet reports. */
const NOT_A_SHEET_NUMBER = /Recovery|Regenerat|Leech|Cost|Recoup|Recover |Gain \d|Requirement|Convert|bypass|Deflection|Guard|Minions?|Companion|Allies|Enemies|Banner|Offering|Totem|Warcr|Flask|Ward|Recharge|Speed|Damage|Accuracy|Rage/i;

export type RuneLine = { stat: string; value: number } | { unmodelled: string } | null;

/**
 * One rune line -> a typed stat and its value, `{unmodelled}` when it names a
 * defence the sheet reports but this table cannot read, or null when it is
 * something else (offence, recovery, a Bonded display line).
 */
export function readRuneLine(line: string): RuneLine {
  const text = line.trim();
  if (/^Bonded:/i.test(text)) return null;
  for (const [re, statOf] of LINE_STATS) {
    const m = re.exec(text);
    if (!m) continue;
    const number = Number(/-?\d+(?:\.\d+)?/.exec(text)![0]);
    const value = /\breduced\b/.test(text) ? -Math.abs(number) : number;
    return { stat: statOf(m), value };
  }
  if (DEFENCE_WORDS.test(text) && !NOT_A_SHEET_NUMBER.test(text) && /^[+-]?\d|^\d/.test(text)) return { unmodelled: text };
  return null;
}
