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
// and two-handed uniques under `Mace` — so a unique mace's handedness is
// unknown to us, and saying so beats guessing.
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

export function handednessOf(category: string): Handedness {
  if (TWO_HANDED_CATEGORIES.has(category)) return 'two';
  if (ONE_HANDED_CATEGORIES.has(category)) return 'one';
  return 'unknown';
}
