'use client'

// =============================================================================
// /prices — public Price Check & Currency Exchange (no account required)
//
// Reads cached prices from price_entries (synced hourly, stored in Exalted).
// Two views:
//   1. Exchange — pick a "from" currency, see "1 X = Y" for every currency.
//   2. Browse   — searchable price list per category (in exalted/divine).
//
// All stored exalted_value figures share one unit, so the rate from A to B
// is simply A.exalted_value / B.exalted_value.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PriceRow {
  league: string
  category: string
  api_id: string
  name: string
  icon_url: string | null
  exalted_value: number | null
  divine_value: number | null
  fetched_at: string
}

const CATEGORY_LABELS: Record<string, string> = {
  currency: 'Currency',
  fragments: 'Fragments',
  runes: 'Runes',
  essences: 'Essences',
  soulcores: 'Soul Cores',
  expedition: 'Expedition',
  omens: 'Ritual Omens',
  reliquary: 'Reliquary Keys',
  breach: 'Breach',
  abyss: 'Abyssal Bones',
  uncutgems: 'Uncut Gems',
  lineagegems: 'Lineage Gems',
  delirium: 'Delirium',
  incursion: 'Incursion',
  idols: 'Idols',
  verisium: 'Verisium',
  vaal: 'Vaal',
  'uniques-accessory': 'Unique Accessories',
  'uniques-armour': 'Unique Armour',
  'uniques-flask': 'Unique Flasks',
  'uniques-jewel': 'Unique Jewels',
  'uniques-map': 'Unique Maps',
  'uniques-weapon': 'Unique Weapons',
  'uniques-sanctum': 'Sanctum Research',
}

// Format a quantity for at-a-glance reading. No scientific notation ever.
// Large numbers get thousands separators; small numbers show just enough
// decimals to be meaningful, then fall back to a "1 / N" form when they get
// too tiny to read as a decimal.
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'

  if (n >= 1000) return Math.round(n).toLocaleString()
  if (n >= 100) return n.toFixed(0)
  if (n >= 10) return n.toFixed(1)
  if (n >= 1) return n.toFixed(2)
  if (n >= 0.1) return n.toFixed(2)   // 0.62, 0.42
  if (n >= 0.01) return n.toFixed(3)  // 0.070, 0.011

  // Below 0.01 a decimal becomes unreadable — show the inverse instead.
  // e.g. 0.00099 → "1 / 1,010" meaning ~1010 of these per 1 unit.
  const inv = Math.round(1 / n)
  return `1 / ${inv.toLocaleString()}`
}

export default function PricesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [view, setView] = useState<'exchange' | 'browse'>('exchange')
  const [rows, setRows] = useState<PriceRow[]>([])
  const [leagues, setLeagues] = useState<string[]>([])
  const [league, setLeague] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Exchange-view state: which currency we convert FROM (Exalted = base unit)
  const [fromId, setFromId] = useState<string>('exalted')
  // Browse-view state
  const [category, setCategory] = useState<string>('currency')
  const [search, setSearch] = useState('')

  // Discover available leagues once
  useEffect(() => {
    let cancelled = false
    async function discover() {
      const { data, error } = await supabase
        .from('price_entries')
        .select('league')
        .limit(2000)
      if (cancelled) return
      if (error) {
        console.error('league discovery failed:', error)
        setLoading(false)
        return
      }
      const unique = Array.from(new Set((data ?? []).map((r) => r.league)))
      setLeagues(unique)
      if (unique.length > 0) setLeague((prev) => prev || unique[0])
      if (unique.length === 0) setLoading(false)
    }
    discover()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Load all rows for the league (exchange view needs the full set;
  // browse view filters this further by category in-memory).
  useEffect(() => {
    if (!league) return
    let cancelled = false
    async function load() {
      // Yield once so this isn't a synchronous setState in the effect body,
      // then show the loading state while the query runs.
      await Promise.resolve()
      if (cancelled) return
      setLoading(true)
      const { data, error } = await supabase
        .from('price_entries')
        .select(
          'league, category, api_id, name, icon_url, exalted_value, divine_value, fetched_at'
        )
        .eq('league', league)
        .order('exalted_value', { ascending: false, nullsFirst: false })
        .limit(5000)
      if (cancelled) return
      if (error) {
        console.error('price_entries query failed:', error)
        setRows([])
      } else {
        setRows((data as PriceRow[]) ?? [])
      }
      setLoading(false) // always clears the spinner, success or fail
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase, league])

  // Currencies only, for the exchange dropdown + conversion table
  const currencyRows = useMemo(
    () =>
      rows.filter(
        (r) => r.category === 'currency' && (r.exalted_value ?? 0) > 0
      ),
    [rows]
  )

  const fromRow = useMemo(
    () => currencyRows.find((r) => r.api_id === fromId) ?? currencyRows[0],
    [currencyRows, fromId]
  )

  // Browse-view filtered rows
  const browseRows = useMemo(() => {
    let r = rows.filter((x) => x.category === category)
    if (search.trim()) {
      const q = search.toLowerCase()
      r = r.filter((x) => x.name.toLowerCase().includes(q))
    }
    return r
  }, [rows, category, search])

  const lastSynced = rows[0]?.fetched_at ?? null

  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold">Price Check</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Updated hourly. PoE2 has one shared economy across PC, PS5 and Xbox —
        these prices are your prices.
      </p>

      {leagues.length > 1 && (
        <select
          className="mt-4 w-full rounded-md border bg-background p-2 text-sm"
          value={league}
          onChange={(e) => setLeague(e.target.value)}
        >
          {leagues.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
      )}

      {/* View toggle */}
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => setView('exchange')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            view === 'exchange'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          Currency Exchange
        </button>
        <button
          onClick={() => setView('browse')}
          className={`rounded-md px-4 py-2 text-sm font-medium ${
            view === 'browse'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}
        >
          Browse Prices
        </button>
      </div>

      {loading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No prices yet. Run the hourly sync, then refresh.
        </p>
      ) : view === 'exchange' ? (
        // ---- EXCHANGE VIEW -------------------------------------------------
        <div className="mt-4">
          <label className="text-sm text-muted-foreground">Convert from</label>
          <select
            className="mt-1 w-full rounded-md border bg-background p-3 text-base"
            value={fromRow?.api_id ?? ''}
            onChange={(e) => setFromId(e.target.value)}
          >
            {currencyRows.map((r) => (
              <option key={r.api_id} value={r.api_id}>{r.name}</option>
            ))}
          </select>

          {fromRow && (
            <ul className="mt-4 divide-y">
              {currencyRows
                .filter((r) => r.api_id !== fromRow.api_id)
                .map((r) => {
                  // rate = how many of the SELECTED currency equal 1 of this item.
                  const rate =
                    (r.exalted_value ?? 0) / (fromRow.exalted_value ?? 1)

                  // Choose the readable direction:
                  //  - rate >= 1: "1 [item]  =  rate [selected]"
                  //  - rate < 1:  "N [item]  =  1 [selected]" (flip it)
                  const label =
                    rate >= 1
                      ? {
                          left: `1 ${r.name}`,
                          right: `${fmt(rate)} ${fromRow.name}`,
                        }
                      : {
                          left: `${fmt(1 / rate)} ${r.name}`,
                          right: `1 ${fromRow.name}`,
                        }

                  return (
                    <li key={r.api_id} className="flex items-center gap-2 py-2.5">
                      {r.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.icon_url} alt="" className="h-7 w-7 shrink-0 object-contain" loading="lazy" />
                      ) : (
                        <div className="h-7 w-7 shrink-0 rounded bg-muted" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {label.left}
                      </span>
                      <span className="shrink-0 text-sm text-muted-foreground">=</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {label.right}
                      </span>
                    </li>
                  )
                })}
            </ul>
          )}
          <p className="mt-3 text-center text-xs text-muted-foreground">
            Each row shows its value in {fromRow?.name}.
          </p>
        </div>
      ) : (
        // ---- BROWSE VIEW ---------------------------------------------------
        <div className="mt-4">
          <input
            type="search"
            placeholder="Search items…"
            className="w-full rounded-md border bg-background p-3 text-base"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm ${
                  category === key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {browseRows.length === 0 ? (
            <p className="mt-8 text-center text-sm text-muted-foreground">
              No items in this category yet.
            </p>
          ) : (
            <ul className="mt-2 divide-y">
              {browseRows.map((r) => (
                <li key={r.api_id} className="flex items-center gap-3 py-2.5">
                  {r.icon_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.icon_url} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
                  ) : (
                    <div className="h-8 w-8 shrink-0 rounded bg-muted" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">{r.name}</span>
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums">
                    {fmt(r.exalted_value ?? NaN)} ex
                    {r.divine_value !== null && r.divine_value >= 0.1 && (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {fmt(r.divine_value)} div
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {lastSynced && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Last synced: {new Date(lastSynced).toLocaleString()}
        </p>
      )}

      {/* Rare items deep link */}
      <div className="mt-8 rounded-lg border p-4">
        <h2 className="font-semibold">Looking for a rare item?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rare items with specific mods can&apos;t be priced from cached data.
          Use the official trade site — searches open in your browser with your
          own PoE account.
        </p>
        <a
          href={`https://www.pathofexile.com/trade2/search/poe2/${encodeURIComponent(league || 'Standard')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Open official trade site →
        </a>
      </div>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Price data courtesy of poe2scout.com
      </p>
    </main>
  )
}