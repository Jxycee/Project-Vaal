// src/lib/build/gearSlots.ts
// =============================================================================
// Gear slot vocabulary and the slot -> wiki item-category mapping.
//
// The single source of truth for this mapping. Two categories (Talisman,
// Focii) were missing from the original build-planner spec's Appendix B and
// would have shipped as a broken weapon slot for one class and every hidden
// unique focus in the game — see
// docs/superpowers/specs/2026-09-20-gear-data-corrections.md. That doc
// amends 2026-09-16-build-planner-design.md's Appendix B; this file
// implements the corrected table, not the original.
// =============================================================================

/** The 17 gear slots a character has. `weapon1_*`/`weapon2_*` mirror the tree's set1/set2 vocabulary. */
export const GEAR_SLOTS = [
  'head',
  'body',
  'gloves',
  'boots',
  'amulet',
  'ring1',
  'ring2',
  'belt',
  'weapon1_main',
  'weapon1_off',
  'weapon2_main',
  'weapon2_off',
  'flask1',
  'flask2',
  'charm1',
  'charm2',
  'charm3',
] as const;

export type GearSlot = (typeof GEAR_SLOTS)[number];

export function isGearSlot(value: string): value is GearSlot {
  return (GEAR_SLOTS as readonly string[]).includes(value);
}

/** Display label per slot — used by GearSheet's rows and ItemPickerSheet's header. UI vocabulary, not a second source of truth for the category mapping above. */
export const GEAR_SLOT_LABELS: Record<GearSlot, string> = {
  head: 'Helmet',
  body: 'Body Armour',
  gloves: 'Gloves',
  boots: 'Boots',
  amulet: 'Amulet',
  ring1: 'Ring 1',
  ring2: 'Ring 2',
  belt: 'Belt',
  weapon1_main: 'Weapon',
  weapon1_off: 'Off-hand',
  weapon2_main: 'Weapon',
  weapon2_off: 'Off-hand',
  flask1: 'Life Flask',
  flask2: 'Mana Flask',
  charm1: 'Charm 1',
  charm2: 'Charm 2',
  charm3: 'Charm 3',
};

/**
 * Jewels are deliberately NOT one of the 17 gear slots — PoE2 sockets a
 * jewel into the passive tree, not onto the character (see
 * docs/superpowers/specs/2026-09-20-jewels-design.md). But the jewel picker
 * is the same picker component gear uses, filtered to one category, so it
 * needs the same category mapping this file owns rather than hardcoding
 * 'Jewel' a second place — a second source of truth for categories is
 * exactly how the Talisman/Focii mapping drifted in the first place.
 */
export const JEWEL_PSEUDO_SLOT = 'jewels';

export const JEWEL_CATEGORIES = ['Jewel'] as const;

// Druid's weapon class, added in patch 0.4.0 — despite the name this is NOT
// jewellery. Missing from the original spec's Appendix B, which left Druid
// with zero selectable weapons. See corrections doc §3.
const WEAPON_MAIN_CATEGORIES = [
  'One Hand Sword',
  'Two Hand Sword',
  'One Hand Axe',
  'Two Hand Axe',
  'One Hand Mace',
  'Two Hand Mace',
  'Mace',
  'Bow',
  'Crossbow',
  'Claw',
  'Dagger',
  'Flail',
  'Spear',
  'Sceptre',
  'Wand',
  'Staff',
  'Warstaff',
  'Talisman',
] as const;

// 'Focus' (51 entries) is bases only — 0 uniques. 'Focii' (8 entries) holds
// every unique focus in the game. Same base/unique split trap as the flask
// categories below; filtering on 'Focus' alone silently hides every unique
// focus. See corrections doc §2.
const WEAPON_OFF_CATEGORIES = ['Shield', 'Buckler', 'Focus', 'Focii', 'Quiver'] as const;

const LIFE_FLASK_CATEGORIES = ['LifeFlask', 'Life Flask'] as const;
const MANA_FLASK_CATEGORIES = ['ManaFlask', 'Mana Flask'] as const;

// 'UtilityFlask' (13 entries) holds charms, not flasks. 'Charm' (12 entries,
// all unique) is the sibling spelling. Charm slots need both or they offer
// only the 12 uniques and miss every base utility flask/charm.
const CHARM_CATEGORIES = ['Charm', 'UtilityFlask'] as const;

const SLOT_CATEGORIES: Record<GearSlot, readonly string[]> = {
  head: ['Helmet'],
  body: ['Body Armour'],
  gloves: ['Gloves'],
  boots: ['Boots'],
  amulet: ['Amulet'],
  ring1: ['Ring'],
  ring2: ['Ring'],
  belt: ['Belt'],
  weapon1_main: WEAPON_MAIN_CATEGORIES,
  weapon1_off: WEAPON_OFF_CATEGORIES,
  weapon2_main: WEAPON_MAIN_CATEGORIES,
  weapon2_off: WEAPON_OFF_CATEGORIES,
  flask1: LIFE_FLASK_CATEGORIES,
  flask2: MANA_FLASK_CATEGORIES,
  charm1: CHARM_CATEGORIES,
  charm2: CHARM_CATEGORIES,
  charm3: CHARM_CATEGORIES,
};

/** The wiki item categories a gear slot's picker must search. */
export function categoriesForSlot(slot: GearSlot): readonly string[] {
  return SLOT_CATEGORIES[slot];
}

/**
 * A picked, stored item — for a gear slot or a jewel socket alike (the
 * jewels design reuses this shape byte-for-byte rather than inventing its
 * own; see 2026-09-20-jewels-design.md). `iconUrl` is resolved separately at
 * pick time (`WikiSearchEntry` carries no icon field) and is `null` when
 * that lookup fails — a missing icon must never block a pick.
 */
export interface GearItem {
  slug: string;
  name: string;
  category: string;
  isUnique: boolean;
  iconUrl: string | null;
}
