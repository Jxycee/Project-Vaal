// =============================================================================
// POST /api/prices/sync — hourly cron endpoint
//
// Updated 2026-06-13 for the live api.poe2scout.com client (kind + slug).
//
// Leagues to sync = whatever poe2scout currently flags IsCurrent (the live
// season's leagues, e.g. both SC and HC), unioned with any names listed in
// ACTIVE_LEAGUES (for permanent leagues like Standard that are never
// "current" but an admin still wants priced). Falls back to a hardcoded
// default only if poe2scout returns no IsCurrent leagues AND no env
// override is set, so a season rollover needs zero manual env changes.
//
// Pulls current prices from that resolved league list, for every category
// in CATEGORY_PATHS, then upserts into price_entries.
//
// Security: requires "Authorization: Bearer <CRON_SECRET>" header.
// Triggered by: .github/workflows/price-sync.yml (hourly schedule)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import {
  CATEGORY_PATHS,
  fetchCategory,
  fetchLeagues,
  sleep,
} from '@/lib/prices/poe2scout'

export const maxDuration = 300 // 5 min; sync is deliberately slow/polite

export async function POST(request: NextRequest) {
  // --- Auth: validate cron secret -------------------------------------------
  const auth = request.headers.get('authorization') ?? ''
  const expected = `Bearer ${process.env.CRON_SECRET}`
  const authBuf = Buffer.from(auth)
  const expectedBuf = Buffer.from(expected)
  const authMatches =
    authBuf.length === expectedBuf.length && timingSafeEqual(authBuf, expectedBuf)
  if (!process.env.CRON_SECRET || !authMatches) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const envLeagues = (process.env.ACTIVE_LEAGUES ?? '')
    .split(',')
    .map((l) => l.trim())
    .filter(Boolean)

  const supabase = createServiceClient()
  const results: Record<string, number> = {}
  const errors: string[] = []

  // --- Fetch league exchange rates first (divine → exalted) -----------------
  let leagues
  try {
    leagues = await fetchLeagues()
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to fetch leagues from poe2scout: ${String(err)}` },
      { status: 502 }
    )
  }

  const currentLeagues = leagues.filter((l) => l.IsCurrent).map((l) => l.Value)
  const activeLeagues = Array.from(new Set([...currentLeagues, ...envLeagues]))
  if (activeLeagues.length === 0) activeLeagues.push('Runes of Aldur')

  for (const leagueName of activeLeagues) {
    const leagueInfo = leagues.find((l) => l.Value === leagueName)
    const divinePrice = leagueInfo?.DivinePrice ?? 0

    for (const { category, kind, value } of CATEGORY_PATHS) {
      try {
        const lines = await fetchCategory(
          category,
          kind,
          value,
          leagueName,
          divinePrice
        )

        if (lines.length > 0) {
          for (let i = 0; i < lines.length; i += 500) {
            const chunk = lines.slice(i, i + 500).map((l) => ({
              ...l,
              fetched_at: new Date().toISOString(),
            }))
            // snapshot is typed `unknown` here but the column is jsonb. The
            // generated Supabase types are strict about the row shape, so we
            // cast the payload to the table's Insert type.
            const { error } = await supabase
              .from('price_entries')
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              .upsert(chunk as any, { onConflict: 'league,category,api_id' })
            if (error) throw new Error(error.message)
          }
        }

        results[`${leagueName}/${category}`] = lines.length
      } catch (err) {
        // Soft-fail: one broken category must not kill the whole sync.
        errors.push(`${leagueName}/${category}: ${String(err)}`)
      }

      await sleep(600) // polite gap between categories
    }
  }

  // Every category for every league failed — report it as a failure so the
  // cron workflow's status check (gated on HTTP 200) actually catches an
  // upstream outage instead of reporting a silent no-op success.
  const allFailed = errors.length > 0 && Object.keys(results).length === 0
  return NextResponse.json(
    {
      synced: results,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    },
    { status: allFailed ? 502 : 200 }
  )
}