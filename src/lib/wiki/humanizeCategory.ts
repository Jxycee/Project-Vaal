/**
 * Known acronym-shaped identifiers the general PascalCase splitter below
 * would otherwise wrongly break apart - "AoE" (Area of Effect) has a
 * lowercase "o" for pronounceability, not a real word boundary, so the
 * general `[a-z][A-Z]` heuristic misreads it as two words ("Ao E").
 * Checked against every category/tag in a live decode (2026-08-24): this
 * is the only one in the whole dataset shaped like this, so a short
 * explicit exception list is simpler and safer than a smarter heuristic.
 */
const KNOWN_ACRONYMS: Record<string, string> = {
  AoE: 'AoE',
};

/**
 * Turns a raw GGPK category/item-class identifier ("StackableCurrency",
 * "uncut_reservation_gem") into wiki-readable text ("Stackable Currency",
 * "Uncut Reservation Gem"). Used anywhere a `WikiSearchEntry`/detail
 * record's `category` reaches the page - the browse sidebar, each row's
 * category subtitle, and an item detail page's own subtitle fallback (see
 * `subtitleClass` in items/[slug]/page.tsx).
 *
 * A no-op on anything already human-readable ("Active Skill Gem", "Effect",
 * "Unused / Removed") - snake_case and PascalCase are the only shapes this
 * rewrites, so a category that already reads fine passes through unchanged.
 */
export function humanizeCategory(raw: string): string {
  if (raw in KNOWN_ACRONYMS) return KNOWN_ACRONYMS[raw];
  return raw
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
}
