// src/lib/build/validate/handedness.ts
// =============================================================================
// Weapon handedness from a stored item's `category` alone — no detail fetch.
//
// Why category and not the item detail's `twoHanded` flag: that flag comes
// from @poe2-toolkit/item-extractor's hardcoded TWO_HANDED_CLASSES, which
// omits Talisman (added in 0.4.0). GGG's own class tags give every Talisman
// base `two_hand_weapon`, and PoB2's `data.weaponTypeInfo` has Talisman
// `oneHand = false`. See plans/2026-09-24-slice3-structural-validation.md,
// "Verified facts".
//
// Unique items carry the unique-stash category, which for maces merges one-
// and two-handed uniques under `Mace`. Each unique's base IS known, though
// (`uniqueMods.baseType` on its item detail), so the 24 unique maces are
// resolved into UNIQUE_MACE_HANDEDNESS below, keyed by slug. A Mace slug not
// in that table stays 'unknown', which beats guessing.
// =============================================================================

export type Handedness = 'one' | 'two' | 'unknown';

export const TWO_HANDED_CATEGORIES: ReadonlySet<string> = new Set([
  'Two Hand Sword',
  'Two Hand Axe',
  'Two Hand Mace',
  'Bow',
  'Crossbow',
  'Staff',
  'Warstaff',
  'Talisman',
]);

export const ONE_HANDED_CATEGORIES: ReadonlySet<string> = new Set([
  'One Hand Sword',
  'One Hand Axe',
  'One Hand Mace',
  'Claw',
  'Dagger',
  'Flail',
  'Spear',
  'Sceptre',
  'Wand',
]);

/**
 * Every unique in category `Mace`, by slug, resolved through its item
 * detail's `uniqueMods.baseType` (a `{variant:…}` prefix stripped) to that
 * base's category. Generated from public/data/wiki/2026-08-25 on 2026-09-25
 * and pinned by __tests__/handedness.test.ts, which re-derives it from disk —
 * a resync that changes any base fails that test rather than drifting.
 */
export const UNIQUE_MACE_HANDEDNESS: Readonly<Record<string, 'one' | 'two'>> = {
  'brain-rattler': 'two',
  'brutus-lead-sprinkler': 'one',
  'brynhands-mark': 'one',
  'chober-chaber': 'two',
  frostbreath: 'one',
  hoghunt: 'two',
  'hrimnors-hymn': 'two',
  'marohi-erqi': 'two',
  'mj-lner': 'one',
  nebuloch: 'one',
  olrovasara: 'one',
  quecholli: 'two',
  'sadists-mercy': 'one',
  'sculpted-suffering': 'one',
  'seeing-stars': 'one',
  'serles-grit': 'one',
  shyaba: 'two',
  'the-empty-roar': 'two',
  'the-hammer-of-faith': 'two',
  tidebreaker: 'two',
  trenchtimbre: 'one',
  trephina: 'two',
  'twisted-empyrean': 'two',
  'wylunds-stake': 'one',
};

/** Handedness from a stored item's category, and — only for the merged unique `Mace` category — its slug. */
export function handednessOf(category: string, slug?: string): Handedness {
  if (TWO_HANDED_CATEGORIES.has(category)) return 'two';
  if (ONE_HANDED_CATEGORIES.has(category)) return 'one';
  if (category === 'Mace' && slug !== undefined && Object.hasOwn(UNIQUE_MACE_HANDEDNESS, slug)) {
    return UNIQUE_MACE_HANDEDNESS[slug];
  }
  return 'unknown';
}
