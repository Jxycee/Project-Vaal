// =============================================================================
// Trade2 deep-link builder
//
// We can NOT call GGG's trade search API from our servers — it requires an
// authenticated session and is not part of the official developer API.
// Instead, we build the search query here and deep-link the user to the
// official trade site with the query pre-filled. The search then executes in
// THEIR browser, with THEIR session. Fully ToS-clean.
//
// NOTE (planning doc §13): verify the URL format with one manual test —
// open the generated URL in a browser and confirm trade2 picks up the query.
// =============================================================================

const TRADE2_BASE = 'https://www.pathofexile.com/trade2/search/poe2'

/** A single stat filter, e.g. minimum fire resistance. */
export interface StatFilter {
  /** Trade stat id, e.g. 'explicit.stat_3372524247' (fire res). */
  id: string
  min?: number
  max?: number
}

export interface TradeSearchOptions {
  league: string          // e.g. 'Standard'
  name?: string           // exact item name (uniques)
  type?: string           // item base type, e.g. 'Heavy Belt'
  category?: string       // trade category option, e.g. 'armour.helmet'
  minLevel?: number       // minimum item level
  onlineOnly?: boolean    // default true
  stats?: StatFilter[]
}

/**
 * Builds a pathofexile.com/trade2 URL with the search query pre-filled.
 * The user taps the link, lands on the official site, and the search runs
 * under their own login.
 */
export function buildTrade2Url(opts: TradeSearchOptions): string {
  const filters: Record<string, unknown> = {}

  if (opts.category) {
    filters.type_filters = {
      filters: { category: { option: opts.category } },
    }
  }
  if (opts.minLevel) {
    filters.misc_filters = {
      filters: { ilvl: { min: opts.minLevel } },
    }
  }

  const query: Record<string, unknown> = {
    query: {
      status: { option: opts.onlineOnly === false ? 'any' : 'online' },
      ...(opts.name ? { name: opts.name } : {}),
      ...(opts.type ? { type: opts.type } : {}),
      stats: [
        {
          type: 'and',
          filters: (opts.stats ?? []).map((s) => ({
            id: s.id,
            value: {
              ...(s.min !== undefined ? { min: s.min } : {}),
              ...(s.max !== undefined ? { max: s.max } : {}),
            },
          })),
        },
      ],
      filters,
    },
    sort: { price: 'asc' },
  }

  const encoded = encodeURIComponent(JSON.stringify(query))
  return `${TRADE2_BASE}/${encodeURIComponent(opts.league)}?q=${encoded}`
}

/**
 * Convenience: price-check a unique item by name.
 * Example: buildUniqueSearchUrl('Standard', 'Headhunter', 'Heavy Belt')
 */
export function buildUniqueSearchUrl(
  league: string,
  name: string,
  type?: string
): string {
  return buildTrade2Url({ league, name, type })
}