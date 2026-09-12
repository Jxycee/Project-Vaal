'use client'

// =============================================================================
// /prices — public Price Check (no account required).
// Unified market list: every item across every category in one continuous,
// searchable/filterable list. A single "value everything in <currency>" base
// re-values every row live — replaces the old Exchange/Browse tab split.
// Rows are already sorted by exalted_value descending (from the DB query);
// rescaling to a different base currency is a positive linear transform, so
// that order stays correct for any base without re-sorting client-side.
// The shared app shell provides the page container + nav.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Fuse from 'fuse.js'
import { createClient } from '@/lib/supabase/client'
import { CATEGORY_LABELS } from '@/lib/prices/categories'
import { fmtCount, relativeTime } from '@/lib/prices/format'
import { FUZZY_SEARCH_TUNING } from '@/lib/fuseOptions'
import { Icon } from '@/components/ui/icon'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

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

export default function PricesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [rows, setRows] = useState<PriceRow[]>([])
  const [leagues, setLeagues] = useState<string[]>([])
  const [league, setLeague] = useState<string>('')
  const [loading, setLoading] = useState(true)

  const [baseId, setBaseId] = useState<string>('exalted')
  const [category, setCategory] = useState<string>('currency')
  const [search, setSearch] = useState('')

  // Discover leagues once — price_entry_leagues is a DISTINCT view over
  // price_entries (see the migration), so this returns each league exactly
  // once already sorted, instead of scanning up to 2000 raw rows to dedupe
  // client-side. Also means the league <select> below activates on its own
  // the moment a second league's rows exist (e.g. a new season starting),
  // with no code change needed here.
  useEffect(() => {
    let cancelled = false
    async function discover() {
      const { data, error } = await supabase.from('price_entry_leagues').select('league')
      if (cancelled) return
      if (error) {
        console.error('league discovery failed:', error)
        setLoading(false)
        return
      }
      // price_entry_leagues' Row type marks `league` nullable (Postgres views
      // don't carry the base table's NOT NULL constraint through to the
      // generated types), but price_entries.league itself is NOT NULL.
      const unique = (data ?? []).flatMap((r) => (r.league ? [r.league] : []))
      setLeagues(unique)
      if (unique.length > 0) setLeague((prev) => prev || unique[0])
      if (unique.length === 0) setLoading(false)
    }
    discover()
    return () => {
      cancelled = true
    }
  }, [supabase])

  // Load all rows for the league.
  useEffect(() => {
    if (!league) return
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('price_entries')
        .select('league, category, api_id, name, icon_url, exalted_value, divine_value, fetched_at')
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
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [supabase, league])

  const currencyRows = useMemo(
    () => rows.filter((r) => r.category === 'currency' && (r.exalted_value ?? 0) > 0),
    [rows]
  )
  const baseRow = useMemo(
    () => currencyRows.find((r) => r.api_id === baseId) ?? currencyRows[0],
    [currencyRows, baseId]
  )

  // Search spans ALL categories via Fuse; empty search = active category pill only.
  const fuse = useMemo(() => new Fuse(rows, { keys: ['name'], ...FUZZY_SEARCH_TUNING }), [rows])
  const searching = search.trim().length > 0
  const listRows = useMemo(() => {
    const base = searching ? fuse.search(search.trim()).map((r) => r.item) : rows.filter((r) => r.category === category)
    return base.filter((r) => r.api_id !== baseRow?.api_id)
  }, [rows, category, search, searching, fuse, baseRow])

  const lastSynced = rows[0]?.fetched_at ?? null

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Price Check</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Updated hourly. PoE2 has one shared economy across PC, PS5 and Xbox. These prices
          roughly reflect the in-game Currency Exchange (Ange).
        </p>
      </div>

      {leagues.length > 1 && (
        <Select value={league} onValueChange={setLeague}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {leagues.map((l) => (
              <SelectItem key={l} value={l}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No prices yet. Run the hourly sync, then check back.
        </p>
      ) : (
        <>
          {/* Base currency — every row's value below is priced in this. */}
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              {[
                { id: 'exalted', label: 'Exalted Orb' },
                { id: 'divine', label: 'Divine Orb' },
              ].map((q) => {
                const available = currencyRows.some((r) => r.api_id === q.id)
                const active = (baseRow?.api_id ?? '') === q.id
                return (
                  <button
                    key={q.id}
                    type="button"
                    disabled={!available}
                    onClick={() => setBaseId(q.id)}
                    className={cn(
                      'rounded-lg border px-3.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-40',
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {q.label}
                  </button>
                )
              })}
            </div>

            <label className="text-xs text-muted-foreground" htmlFor="base-currency">
              Value everything in
            </label>
            <Select value={baseRow?.api_id ?? ''} onValueChange={setBaseId}>
              <SelectTrigger id="base-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyRows.map((r) => (
                  <SelectItem key={r.api_id} value={r.api_id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search + category filter */}
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              placeholder="Search all items…"
              className="h-11 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-base placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {searching ? (
            <p className="text-xs text-muted-foreground">Showing matches across all categories.</p>
          ) : (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setCategory(key)}
                  className={cn(
                    'whitespace-nowrap rounded-full px-3 py-1.5 text-sm transition-colors',
                    category === key
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card text-muted-foreground hover:text-foreground'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Market list */}
          {listRows.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <Image
                src="/illustrations/empty-prices.png"
                alt=""
                width={480}
                height={483}
                sizes="112px"
                className="size-28 opacity-80"
              />
              <p className="mt-3 text-sm text-muted-foreground">
                {searching ? 'No items match your search.' : 'No items in this category yet.'}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border bg-card/40">
              {baseRow &&
                listRows.map((r) => {
                  const rate = (r.exalted_value ?? 0) / (baseRow.exalted_value ?? 1)
                  const flipped = rate < 1
                  const valueMain = fmtCount(flipped ? 1 / rate : rate)
                  const valueSub = flipped ? `per ${baseRow.name}` : baseRow.name

                  return (
                    <li key={`${r.category}:${r.api_id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/30">
                      {r.icon_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.icon_url}
                          alt=""
                          className="size-8 shrink-0 rounded-md bg-background/40 object-contain p-0.5"
                          loading="lazy"
                        />
                      ) : (
                        <div className="size-8 shrink-0 rounded-md bg-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{r.name}</div>
                        {searching && (
                          <div className="truncate text-xs text-muted-foreground">
                            {CATEGORY_LABELS[r.category] ?? r.category}
                          </div>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-sm font-semibold tabular-nums">{valueMain}</div>
                        <div className="text-xs font-normal tabular-nums text-muted-foreground">
                          {valueSub}
                        </div>
                      </div>
                    </li>
                  )
                })}
            </ul>
          )}
        </>
      )}

      {lastSynced && (
        <p className="text-center text-xs text-muted-foreground">Last synced {relativeTime(lastSynced)}</p>
      )}

      {/* Rare items deep link */}
      <Card className="mt-2 p-4">
        <h2 className="font-heading font-semibold">Looking for a rare item?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Rare items with specific mods can&apos;t be priced from cached data. Use the official
          trade site — searches open in your browser with your own PoE account.
        </p>
        <a
          href={`https://www.pathofexile.com/trade2/search/poe2/${encodeURIComponent(league || 'Standard')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Open official trade site
          <Icon name="external" className="size-3.5 text-primary-foreground" />
        </a>
      </Card>

      <p className="text-center text-xs text-muted-foreground">Price data courtesy of poe2scout.com</p>
    </div>
  )
}
