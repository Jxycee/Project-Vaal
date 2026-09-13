// =============================================================================
// /prices — public Price Check (no account required).
// Server Component: discovers the default league and fetches its price rows
// at request time, so first paint has real data instead of a client-side
// fetch waterfall (league discovery -> price_entries, sequentially, on
// mount). PricesClient owns all interactivity (search, category filters,
// currency-base switching, league switching) and re-fetches client-side
// only when the user actively switches leagues.
//
// No `revalidate` here: createClient() (below) reads cookies() under the
// hood, which is a Request-time API — per
// node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md
// that opts the whole route out of static/ISR rendering regardless of a
// `revalidate` export, so setting one would be a no-op (and misleading).
// The route is already fully dynamic; that's still strictly faster than the
// old client-side waterfall it replaces.
// =============================================================================

import { createClient } from '@/lib/supabase/server'
import PricesClient, { type PriceRow } from './PricesClient'

export default async function PricesPage() {
  const supabase = await createClient()

  // Discover leagues once — price_entry_leagues is a DISTINCT view over
  // price_entries (see the migration), so this returns each league exactly
  // once already sorted, instead of scanning up to 2000 raw rows to dedupe.
  const { data: leagueData, error: leagueError } = await supabase
    .from('price_entry_leagues')
    .select('league')
  if (leagueError) {
    console.error('league discovery failed:', leagueError)
  }
  // price_entry_leagues' Row type marks `league` nullable (Postgres views
  // don't carry the base table's NOT NULL constraint through to the
  // generated types), but price_entries.league itself is NOT NULL.
  const initialLeagues = (leagueData ?? []).flatMap((r) => (r.league ? [r.league] : []))
  const initialLeague = initialLeagues[0] ?? ''

  let initialRows: PriceRow[] = []
  if (initialLeague) {
    const { data: rowsData, error: rowsError } = await supabase
      .from('price_entries')
      .select('league, category, api_id, name, icon_url, exalted_value, divine_value, fetched_at')
      .eq('league', initialLeague)
      .order('exalted_value', { ascending: false, nullsFirst: false })
      .limit(5000)
    if (rowsError) {
      console.error('price_entries query failed:', rowsError)
    } else {
      initialRows = (rowsData as PriceRow[]) ?? []
    }
  }

  return (
    <PricesClient
      initialLeagues={initialLeagues}
      initialLeague={initialLeague}
      initialRows={initialRows}
    />
  )
}
