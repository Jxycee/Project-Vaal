/**
 * Per-kind accent colors for the wiki's detail-page tooltip cards
 * (RarityIconBox border, the card's own border/background tint). Returns
 * CSS `var(...)` references into the tokens defined in globals.css, not
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

/**
 * Effects (ailments/buffs) have no per-entry color axis either, but reuse
 * MOD_ACCENT_COLOR would make effect cards indistinguishable from mod cards
 * at a glance — a distinct flat violet keeps the two kinds visually apart.
 */
export const EFFECT_ACCENT_COLOR = 'var(--wiki-effect)';

/**
 * Maps have no per-entry color axis either (a flat category, same as
 * effects/mods) - a distinct teal keeps map cards visually apart from both.
 */
export const MAP_ACCENT_COLOR = 'var(--wiki-map)';
