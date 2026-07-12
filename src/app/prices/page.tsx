'use client'

// =============================================================================
// /prices — public Price Check & Currency Exchange (no account required).
// Reads cached prices from price_entries (synced hourly, stored in Exalted).
//   Exchange — pick a "from" currency, see every currency valued in it.
//   Browse   — searchable price list; search spans ALL categories (Fuse.js).
// The shared app shell provides the page container + nav.
// =============================================================================

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Fuse from 'fuse.js'
import { createClient } from '@/lib/supabase/client'
import { Icon } from '@/components/ui/icon'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
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

// No scientific notation ever. Large → separators; tiny → "1 / N".
function fmt(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  if (n >= 1000) return Math.round(n).toLocaleString()
  if (n >= 100) return n.toFixed(0)
  if (n >= 10) return n.toFixed(1)
  if (n >= 1) return n.toFixed(2)
  if (n >= 0.1) return n.toFixed(2)
  if (n >= 0.01) return n.toFixed(3)
  const inv = Math.round(1 / n)
  return `1 / ${inv.toLocaleString()}`
}

// Exchange values are always >= 1 (we flip direction otherwise), so this never
// needs the "1 / N" form — it just keeps big numbers clean and readable.
function fmtCount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n >= 100) return Math.round(n).toLocaleString()
  if (n >= 10) return n.toFixed(1)
  return n.toFixed(2)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.round(hr / 24)
  return `${day} day${day === 1 ? '' : 's'} ago`
}

// One overflow-safe row, shared by both views: icon | name(+sub) | value(+sub).
function PriceRowItem({
  iconUrl,
  name,
  sub,
  valueMain,
  valueSub,
}: {
  iconUrl: string | null
  name: string
  sub?: string
  valueMain: string
  valueSub?: string
}) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={iconUrl} alt="" className="size-7 shrink-0 object-contain" loading="lazy" />
      ) : (
        <div className="size-7 shrink-0 rounded bg-muted" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{name}</div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-semibold tabular-nums">{valueMain}</div>
        {valueSub && (
          <div className="text-xs font-normal tabular-nums text-muted-foreground">{valueSub}</div>
        )}
      </div>
    </li>
  )
}

export default function PricesPage() {
  const supabase = useMemo(() => createClient(), [])

  const [view, setView] = useState<'exchange' | 'browse'>('exchange')
  const [rows, setRows] = useState<PriceRow[]>([])
  const [leagues, setLeagues] = useState<string[]>([])
  const [league, setLeague] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [reload, setReload] = useState(0)

  const [fromId, setFromId] = useState<string>('exalted')
  const [category, setCategory] = useState<string>('currency')
  const [search, setSearch] = useState('')

  // Discover leagues once
  useEffect(() => {
    let cancelled = false
    async function discover() {
      const { data, error } = await supabase.from('price_entries').select('league').limit(2000)
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

  // Load all rows for the league (re-runs when Refresh bumps `reload`).
  useEffect(() => {
    if (!league) return
    let cancelled = false
    async function load() {
      await Promise.resolve()
      if (cancelled) return
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
  }, [supabase, league, reload])

  const currencyRows = useMemo(
    () => rows.filter((r) => r.category === 'currency' && (r.exalted_value ?? 0) > 0),
    [rows]
  )
  const fromRow = useMemo(
    () => currencyRows.find((r) => r.api_id === fromId) ?? currencyRows[0],
    [currencyRows, fromId]
  )

  // Browse: search spans ALL categories via Fuse; empty search = active tab only.
  const fuse = useMemo(
    () => new Fuse(rows, { keys: ['name'], threshold: 0.4, ignoreLocation: true }),
    [rows]
  )
  const searching = search.trim().length > 0
  const browseRows = useMemo(() => {
    if (searching) return fuse.search(search.trim()).map((r) => r.item)
    return rows.filter((x) => x.category === category)
  }, [rows, category, search, searching, fuse])

  const lastSynced = rows[0]?.fetched_at ?? null

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">Price Check</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Updated hourly. PoE2 has one shared economy across PC, PS5 and Xbox — these prices are
            your prices.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setReload((n) => n + 1)}
          disabled={loading}
          className="shrink-0 gap-1.5"
        >
          <Icon name="refresh" className="size-3.5" />
          Refresh
        </Button>
      </div>

      {leagues.length > 1 && (
        <select
          className="h-11 w-full rounded-lg border border-input bg-card px-3 text-sm"
          value={league}
          onChange={(e) => setLeague(e.target.value)}
        >
          {leagues.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
      )}

      {/* View toggle */}
      <div className="inline-flex w-fit rounded-lg border border-border bg-card p-1 text-sm">
        {(['exchange', 'browse'] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              'rounded-md px-4 py-1.5 font-medium transition-colors',
              view === v
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {v === 'exchange' ? 'Exchange' : 'Browse'}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No prices yet. Run the hourly sync, then Refresh.
        </p>
      ) : view === 'exchange' ? (
        // ---- EXCHANGE ------------------------------------------------------
        <div>
          {/* Quick picks for the two currencies people convert against most */}
          <div className="flex gap-2">
            {[
              { id: 'exalted', label: 'Exalted' },
              { id: 'divine', label: 'Divine' },
            ].map((q) => {
              const available = currencyRows.some((r) => r.api_id === q.id)
              const active = (fromRow?.api_id ?? '') === q.id
              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={!available}
                  onClick={() => setFromId(q.id)}
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

          <label
            className="mt-3 block text-sm text-muted-foreground"
            htmlFor="from-currency"
          >
            Convert from
          </label>
          <select
            id="from-currency"
            className="mt-1 h-11 w-full rounded-lg border border-input bg-card px-3 text-base"
            value={fromRow?.api_id ?? ''}
            onChange={(e) => setFromId(e.target.value)}
          >
            {currencyRows.map((r) => (
              <option key={r.api_id} value={r.api_id}>
                {r.name}
              </option>
            ))}
          </select>

          {fromRow && (
            <>
              <p className="mt-4 text-xs text-muted-foreground">
                Each item below, valued in{' '}
                <span className="font-medium text-foreground">{fromRow.name}</span>.
              </p>
              <ul className="mt-1 divide-y divide-border">
                {currencyRows
                  .filter((r) => r.api_id !== fromRow.api_id)
                  .map((r) => {
                    // 1 of this item = `rate` of the chosen currency. If that's
                    // less than 1, flip it ("N per 1 currency") so the number on
                    // screen is always readable instead of a 0.0x / "1 / N".
                    const rate =
                      (r.exalted_value ?? 0) / (fromRow.exalted_value ?? 1)
                    const flipped = rate < 1
                    return (
                      <PriceRowItem
                        key={r.api_id}
                        iconUrl={r.icon_url}
                        name={r.name}
                        valueMain={fmtCount(flipped ? 1 / rate : rate)}
                        valueSub={flipped ? `per ${fromRow.name}` : fromRow.name}
                      />
                    )
                  })}
              </ul>
            </>
          )}
        </div>
      ) : (
        // ---- BROWSE --------------------------------------------------------
        <div>
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
            <p className="mt-3 text-xs text-muted-foreground">
              Showing matches across all categories.
            </p>
          ) : (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
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

          {browseRows.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              {/* Same next/image treatment as the other static illustrations
                  — real intrinsic size (480x483) instead of a bare <img>. */}
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
            <ul className="mt-2 divide-y divide-border">
              {browseRows.map((r) => (
                <PriceRowItem
                  key={`${r.category}:${r.api_id}`}
                  iconUrl={r.icon_url}
                  name={r.name}
                  sub={searching ? CATEGORY_LABELS[r.category] ?? r.category : undefined}
                  valueMain={`${fmt(r.exalted_value ?? NaN)} ex`}
                  valueSub={
                    r.divine_value !== null && r.divine_value >= 0.1
                      ? `${fmt(r.divine_value)} div`
                      : undefined
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {lastSynced && (
        <p className="text-center text-xs text-muted-foreground">
          Last synced {relativeTime(lastSynced)}
        </p>
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

      <p className="text-center text-xs text-muted-foreground">
        Price data courtesy of poe2scout.com
      </p>
    </div>
  )
}
