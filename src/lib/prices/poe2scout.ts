// =============================================================================
// poe2scout API client — server-side only (used by /api/prices/sync)
//
// Rewritten 2026-06-13 against the LIVE API. Confirmed working URL:
//   /api/poe2/Leagues/{LeagueName}/Currencies/ByCategory
//     ?Category=Currency&ReferenceCurrency=mirror
//     &Page=1&PerPage=25&DataPoints=7&FrequencyHours=24
//
// CRITICAL details that caused earlier 404/422 failures:
//   - Realm + league go in the PATH: /api/poe2/Leagues/{LeagueName}/...
//   - Query params are PascalCase: Category, Page, PerPage (NOT lowercase)
//   - ReferenceCurrency is REQUIRED (we use "mirror") — omitting it → 422
//   - DataPoints + FrequencyHours are REQUIRED — omitting them → 422
//   - Category VALUES are Capitalized: "Currency", "Fragments", etc.
//
// Endpoints:
//   Leagues:    GET /{Realm}/Leagues                         → array
//   Currencies: GET /{Realm}/Leagues/{League}/Currencies/ByCategory?Category=...
//   Uniques:    GET /{Realm}/Leagues/{League}/Uniques/ByCategory?Category=...
//
// Item response is paginated: { CurrentPage, Pages, Total, Items: [...] }
// Item fields: { ApiId, Text, IconUrl, CurrentPrice, CategoryApiId, ItemMetadata }
// League fields: { Value, DivinePrice, IsCurrent }
//
// Courtesy: identify with a contact email in User-Agent; gap 600ms (~under 2 req/s).
// =============================================================================

const REALM = 'poe2'
const BASE_URL = `https://api.poe2scout.com/${REALM}`

// ReferenceCurrency: the currency the API expresses prices against.
// "exalted" makes CurrentPrice come back directly in Exalted Orbs
// (Divine ≈ 131, Exalted = 1.0), which is exactly what we store.
// Verified against /Leagues DivinePrice.
const REFERENCE_CURRENCY = 'exalted'

// History sampling params (required by the endpoint). The sync only reads
// CurrentPrice, not the history, but the API enforces DataPoints ∈ {7, 8}
// and rejects anything else with a 400. Use 7 (the documented minimum).
const DATA_POINTS = 7
const FREQUENCY_HOURS = 24

// Each category maps to one of the two ByCategory endpoints plus its
// Category query value. The API expects the lowercase ApiId (NOT the Label).
// If one 400s/404s, the sync logs it under `errors` and continues — verify
// the exact ApiId against the /Items/Categories endpoint.
export const CATEGORY_PATHS: {
  category: string                       // our internal label / DB category value
  kind: 'Currencies' | 'Uniques'         // which ByCategory endpoint
  value: string                          // the ?Category= ApiId value
}[] = [
  // Currencies/ByCategory — ApiId values from CurrencyCategories
  { category: 'currency',     kind: 'Currencies', value: 'currency' },
  { category: 'fragments',    kind: 'Currencies', value: 'fragments' },
  { category: 'runes',        kind: 'Currencies', value: 'runes' },
  { category: 'essences',     kind: 'Currencies', value: 'essences' },
  { category: 'soulcores',    kind: 'Currencies', value: 'ultimatum' },   // Soul Cores
  { category: 'expedition',   kind: 'Currencies', value: 'expedition' },
  { category: 'omens',        kind: 'Currencies', value: 'ritual' },      // Ritual Omens
  { category: 'reliquary',    kind: 'Currencies', value: 'vaultkeys' },   // Reliquary Keys
  { category: 'breach',       kind: 'Currencies', value: 'breach' },
  { category: 'abyss',        kind: 'Currencies', value: 'abyss' },       // Abyssal Bones
  { category: 'uncutgems',    kind: 'Currencies', value: 'uncutgems' },
  { category: 'lineagegems',  kind: 'Currencies', value: 'lineagesupportgems' },
  { category: 'delirium',     kind: 'Currencies', value: 'delirium' },
  { category: 'incursion',    kind: 'Currencies', value: 'incursion' },
  { category: 'idols',        kind: 'Currencies', value: 'idol' },        // singular ApiId
  { category: 'verisium',     kind: 'Currencies', value: 'verisium' },
  { category: 'vaal',         kind: 'Currencies', value: 'vaal' },
  // Uniques/ByCategory — ApiId values from UniqueCategories
  { category: 'uniques-accessory', kind: 'Uniques', value: 'accessory' },
  { category: 'uniques-armour',    kind: 'Uniques', value: 'armour' },
  { category: 'uniques-flask',     kind: 'Uniques', value: 'flask' },
  { category: 'uniques-jewel',     kind: 'Uniques', value: 'jewel' },
  { category: 'uniques-map',       kind: 'Uniques', value: 'map' },
  { category: 'uniques-weapon',    kind: 'Uniques', value: 'weapon' },
  { category: 'uniques-sanctum',   kind: 'Uniques', value: 'sanctum' },
]
// Source of truth for these values:
//   GET /api/poe2/Leagues/{League}/Items/Categories
// (returns { UniqueCategories:[...], CurrencyCategories:[...] }, each with ApiId)

/** One normalized price line, ready to upsert into price_entries. */
export interface PriceLine {
  league: string
  category: string
  api_id: string
  name: string
  icon_url: string | null
  exalted_value: number | null
  divine_value: number | null
  snapshot: unknown
}

/** League info from /Leagues (only the fields we use). */
export interface ScoutLeague {
  Value: string         // league name, e.g. "Runes of Aldur"
  DivinePrice: number   // 1 Divine Orb = N Exalted Orbs
  IsCurrent: boolean
}

function userAgent(): string {
  const contact = process.env.PRICE_SYNC_CONTACT ?? 'no-contact-set'
  return `ProjectVaal/0.1 ~ https://project-vaal.xyz (contact: ${contact})`
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchJson(pathAndQuery: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/${pathAndQuery}`, {
    headers: { 'User-Agent': userAgent() },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`poe2scout ${pathAndQuery} responded ${res.status}`)
  }
  return res.json()
}

/** Fetch all leagues with their divine→exalted exchange rates. */
export async function fetchLeagues(): Promise<ScoutLeague[]> {
  const data = await fetchJson('Leagues')
  if (!Array.isArray(data)) {
    throw new Error('Unexpected /Leagues response — expected an array')
  }
  return data as ScoutLeague[]
}

interface ScoutItem {
  ApiId?: string
  // Uniques don't have ApiId — they use UniqueItemId / ItemId instead
  UniqueItemId?: number
  ItemId?: number
  Text?: string
  Name?: string
  IconUrl?: string
  CurrentPrice?: number
  CategoryApiId?: string
  ItemMetadata?: { name?: string; icon?: string }
}

interface ScoutPage {
  CurrentPage: number
  Pages: number
  Total: number
  Items: ScoutItem[]
}

/**
 * Fetch one category for a league and normalize to PriceLine[].
 * Walks all pages (PerPage=25) with a polite gap between pages.
 */
export async function fetchCategory(
  category: string,
  kind: 'Currencies' | 'Uniques',
  value: string,
  league: string,
  divinePrice: number
): Promise<PriceLine[]> {
  const lines: PriceLine[] = []
  let page = 1
  const MAX_PAGES = 40

  const leaguePath = encodeURIComponent(league)

  while (page <= MAX_PAGES) {
    // NOTE: PascalCase query params, all required ones present.
    const query =
      `?Category=${encodeURIComponent(value)}` +
      `&ReferenceCurrency=${encodeURIComponent(REFERENCE_CURRENCY)}` +
      `&Page=${page}` +
      `&PerPage=25` +
      `&DataPoints=${DATA_POINTS}` +
      `&FrequencyHours=${FREQUENCY_HOURS}`

    const data = (await fetchJson(
      `Leagues/${leaguePath}/${kind}/ByCategory${query}`
    )) as ScoutPage

    const items = data.Items ?? []
    if (items.length === 0) break

    for (const item of items) {
      const exalted =
        typeof item.CurrentPrice === 'number' && Number.isFinite(item.CurrentPrice)
          ? item.CurrentPrice
          : null

      // Currencies have ApiId; Uniques don't — fall back to their numeric ids.
      // Prefix unique ids to guarantee no collision with currency ApiIds.
      const apiId =
        item.ApiId ??
        (item.UniqueItemId != null
          ? `u${item.UniqueItemId}`
          : item.ItemId != null
            ? `i${item.ItemId}`
            : '')
      const name =
        item.Text ?? item.Name ?? item.ItemMetadata?.name ?? 'Unknown'

      lines.push({
        league,
        category,
        api_id: String(apiId),
        name: String(name),
        icon_url: item.IconUrl ?? item.ItemMetadata?.icon ?? null,
        exalted_value: exalted,
        divine_value:
          exalted !== null && divinePrice > 0 ? exalted / divinePrice : null,
        snapshot: item,
      })
    }

    const totalPages = typeof data.Pages === 'number' ? data.Pages : 1
    if (page >= totalPages) break
    page += 1
    await sleep(600)
  }
    if (
    category === 'currency' &&
    REFERENCE_CURRENCY === 'exalted' &&
    !lines.some((line) => line.api_id === 'exalted')
  ) {
    lines.push({
      league,
      category: 'currency',
      api_id: 'exalted',
      name: 'Exalted Orb',
      icon_url: null,
      exalted_value: 1,
      divine_value: divinePrice > 0 ? 1 / divinePrice : null,
      snapshot: {
        ApiId: 'exalted',
        Text: 'Exalted Orb',
        CurrentPrice: 1,
        synthetic: true,
      },
    })
  }

  return lines.filter((l) => l.api_id !== '' && l.name !== 'Unknown')
}