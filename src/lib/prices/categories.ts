// Category catalogue shared by the server-side sync (poe2scout.ts) and the
// client-side Browse UI (app/prices/page.tsx). Split out from poe2scout.ts
// so importing the category list into a client component doesn't also pull
// the server-only fetch client into the browser bundle.
//
// Source of truth for the `value` (ApiId) column:
//   GET /api/poe2/Leagues/{League}/Items/Categories
// (returns { UniqueCategories:[...], CurrencyCategories:[...] }, each with ApiId)
export const CATEGORY_PATHS: {
  category: string                       // our internal label / DB category value
  kind: 'Currencies' | 'Uniques'         // which ByCategory endpoint
  value: string                          // the ?Category= ApiId value
  label: string                          // friendly display label (Browse tab, filters)
}[] = [
  // Currencies/ByCategory — ApiId values from CurrencyCategories
  { category: 'currency',     kind: 'Currencies', value: 'currency',   label: 'Currency' },
  { category: 'fragments',    kind: 'Currencies', value: 'fragments',  label: 'Fragments' },
  { category: 'runes',        kind: 'Currencies', value: 'runes',      label: 'Runes' },
  { category: 'essences',     kind: 'Currencies', value: 'essences',   label: 'Essences' },
  { category: 'soulcores',    kind: 'Currencies', value: 'ultimatum',  label: 'Soul Cores' },   // Soul Cores
  { category: 'expedition',   kind: 'Currencies', value: 'expedition', label: 'Expedition' },
  { category: 'omens',        kind: 'Currencies', value: 'ritual',     label: 'Ritual Omens' }, // Ritual Omens
  { category: 'reliquary',    kind: 'Currencies', value: 'vaultkeys',  label: 'Reliquary Keys' }, // Reliquary Keys
  { category: 'breach',       kind: 'Currencies', value: 'breach',     label: 'Breach' },
  { category: 'abyss',        kind: 'Currencies', value: 'abyss',      label: 'Abyssal Bones' }, // Abyssal Bones
  { category: 'uncutgems',    kind: 'Currencies', value: 'uncutgems',  label: 'Uncut Gems' },
  { category: 'lineagegems',  kind: 'Currencies', value: 'lineagesupportgems', label: 'Lineage Gems' },
  { category: 'delirium',     kind: 'Currencies', value: 'delirium',   label: 'Delirium' },
  { category: 'incursion',    kind: 'Currencies', value: 'incursion',  label: 'Incursion' },
  { category: 'idols',        kind: 'Currencies', value: 'idol',       label: 'Idols' },        // singular ApiId
  { category: 'verisium',     kind: 'Currencies', value: 'verisium',   label: 'Verisium' },
  { category: 'vaal',         kind: 'Currencies', value: 'vaal',       label: 'Vaal' },
  // Uniques/ByCategory — ApiId values from UniqueCategories
  { category: 'uniques-accessory', kind: 'Uniques', value: 'accessory', label: 'Unique Accessories' },
  { category: 'uniques-armour',    kind: 'Uniques', value: 'armour',    label: 'Unique Armour' },
  { category: 'uniques-flask',     kind: 'Uniques', value: 'flask',     label: 'Unique Flasks' },
  { category: 'uniques-jewel',     kind: 'Uniques', value: 'jewel',     label: 'Unique Jewels' },
  { category: 'uniques-map',       kind: 'Uniques', value: 'map',       label: 'Unique Maps' },
  { category: 'uniques-weapon',    kind: 'Uniques', value: 'weapon',    label: 'Unique Weapons' },
  { category: 'uniques-sanctum',   kind: 'Uniques', value: 'sanctum',   label: 'Sanctum Research' },
]

/** Category → display label, derived from CATEGORY_PATHS so the Browse UI can't drift from the sync's category list. */
export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_PATHS.map((p) => [p.category, p.label])
)
