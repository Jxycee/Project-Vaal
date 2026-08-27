/**
 * Str/Dex/Int color tint for a mod family or item tag - reuses the same
 * red/green/blue tokens the skill-gem color coding already uses
 * (`skillAccentColor` in accent.ts), so the convention reads the same way
 * across the wiki: red = Strength, green = Dexterity, blue = Intelligence.
 * A tag naming two or three attributes (e.g. `str_dex_armour`) gets a
 * fixed blended color per combination (amber/purple/teal, all-three reuses
 * the existing "universal" white/gold gem token) rather than a live
 * gradient - tried a gradient first, but on a short, often-truncated tag
 * chip it mostly just reads as its first color, so a fixed solid per
 * combination is both simpler and more legible.
 *
 * Also covers the one non-attribute tag that needs the same chip
 * treatment: `Unique`, unshifted onto a unique item's `tags` in
 * `toSearchEntry` (normalize.ts) so it renders exactly like an attribute
 * chip, tinted with the same accent `itemAccentColor('unique')` already
 * uses on unique items' detail pages.
 *
 * `null` for anything not attribute-shaped (or Unique) - most tags.
 */
const STR = 'var(--wiki-gem-r)';
const DEX = 'var(--wiki-gem-g)';
const INT = 'var(--wiki-gem-b)';
const STR_DEX = 'var(--wiki-attr-str-dex)';
const STR_INT = 'var(--wiki-attr-str-int)';
const DEX_INT = 'var(--wiki-attr-dex-int)';
const STR_DEX_INT = 'var(--wiki-gem-w)';

const ATTRIBUTE_TAG_COLORS: Record<string, string> = {
  Unique: 'var(--wiki-unique)',
  // Mod families (full words)
  Strength: STR,
  Dexterity: DEX,
  Intelligence: INT,
  // Item tags (armour/shield/jewel, snake_case)
  str_armour: STR,
  dex_armour: DEX,
  int_armour: INT,
  str_dex_armour: STR_DEX,
  str_int_armour: STR_INT,
  dex_int_armour: DEX_INT,
  str_dex_int_armour: STR_DEX_INT,
  str_shield: STR,
  dex_shield: DEX,
  str_int_shield: STR_INT,
  str_dex_shield: STR_DEX,
  strjewel: STR,
  dexjewel: DEX,
  intjewel: INT,
  str_radius_jewel: STR,
  dex_radius_jewel: DEX,
  int_radius_jewel: INT,
};

export function attributeTagColor(tag: string): string | null {
  return ATTRIBUTE_TAG_COLORS[tag] ?? null;
}
