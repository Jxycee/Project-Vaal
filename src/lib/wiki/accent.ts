/**
 * Per-kind accent colors for the wiki's detail-page tooltip styling
 * (RarityIconBox border, DetailInfoPanel header tint). Returns CSS
 * `var(...)` references into the tokens defined in globals.css, not
 * resolved color values, so they stay theme-aware (dark/light) for free.
 */
export function itemAccentColor(rarity: 'normal' | 'unique'): string {
  return rarity === 'unique' ? 'var(--wiki-unique)' : 'var(--border)';
}

const SKILL_ACCENT: Record<'r' | 'g' | 'b' | 'w', string> = {
  r: 'var(--wiki-gem-r)',
  g: 'var(--wiki-gem-g)',
  b: 'var(--wiki-gem-b)',
  w: 'var(--wiki-gem-w)',
};

export function skillAccentColor(color: 'r' | 'g' | 'b' | 'w'): string {
  return SKILL_ACCENT[color];
}

/**
 * Mods have no per-entry color axis in the data (no rarity, no gem color)
 * — a flat brand-gold accent is the correct choice here, not a compromise.
 */
export const MOD_ACCENT_COLOR = 'var(--primary)';
