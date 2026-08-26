# Wiki Home Page — Universal Search — Design

**Status:** Approved by Jaycee 2026-08-26, via conversational brainstorming (no visual mockup —
layout described in text, explicitly deferred for a follow-up visual pass: "we will do design
modifications after my nap").

## Decision

`/wiki` currently just `redirect()`s to `/wiki/items` — there's no real landing page, and search
is scoped per-kind (each browse page's `WikiSearch` only searches its own kind's index). Replace
the redirect with a real home page: a search bar that spans **all five kinds at once**, the five
category tabs, and a "recently searched" strip.

**Scope, explicitly narrowed during brainstorming:**
- Wiki content only — items/skills/mods/effects/maps. The passive tree has its own in-canvas
  search already; out of scope here, not touched.
- This search lives **only on this one page** — not a global command palette, not present in the
  app shell/nav elsewhere.
- "Popularity" is per-browser, not site-wide analytics — no new Supabase table, no tracking
  endpoint.

## Approach: reuse the existing per-kind indexes, fetched in parallel

The home page fetches all 5 existing index JSONs via `fetchWikiIndex` (`lib/wiki/fetchIndex.ts`
— already used by every browse page, unchanged) with `Promise.all`, concatenates the results into
one `WikiSearchEntry[]`, and searches across that combined array with the same Fuse.js tuning
(`FUZZY_SEARCH_TUNING`) already shared across the app.

Combined payload is ~1.5MB uncompressed (~200-400KB gzipped) — real, but not new: it's the same
data users already fetch today, just consolidated onto one page instead of spread across five.
Two alternatives were considered and rejected: a new leaner combined index built at sync time
(smaller payload, but adds a new build artifact/versioning surface to the sync pipeline for a
marginal saving — YAGNI until this is proven too heavy in practice), and lazy-fetch-on-first-
keystroke (adds a visible delay before the first result, worse than instant-filter once loaded).

## Components

- **`src/app/wiki/page.tsx`** — becomes the real landing page (currently a bare `redirect()`).
  Client-fetches all 5 indexes on mount, renders (top to bottom): search bar, 5 category tabs,
  recently-searched strip.
- **Generalize `WikiSearch`** — every `WikiSearchEntry` already carries its own `kind`, and
  `WIKI_BASE_PATH[kind]` already maps to the right route, so the component resolves each result's
  link internally (`WIKI_BASE_PATH[entry.kind]/${entry.slug}`) instead of taking a single
  `basePath` prop. Every existing call site currently passes `basePath={WIKI_BASE_PATH[kind]}`
  anyway (single-kind pages), so this drops a redundant prop rather than changing behavior. Add
  one new optional prop, `onSelectEntry?: (entry: WikiSearchEntry) => void`, fired when a result
  link is clicked — only the home page wires it up (per-kind browse pages don't need it).
- **New `src/lib/wiki/recentSearches.ts`** — `localStorage`-backed (persists across sessions,
  unlike `WikiBrowse`'s existing `sessionStorage` view-restore, which is deliberately session-
  scoped — different lifetime need, same established "guard `typeof window === 'undefined'`,
  swallow storage errors" pattern otherwise):
  - `recordSearchedEntry(entry: WikiSearchEntry): void` — dedupes by `kind`+`slug`, most-recent
    first, stores up to 4.
  - `getHomeStrip(allEntries: WikiSearchEntry[]): WikiSearchEntry[]` — always returns exactly 4
    entries for display: real recorded entries first, then backfilled with random entries (seeded
    from `allEntries`, excluding anything already in the real list and excluding
    `UNUSED_OR_REMOVED_CATEGORY` — `normalize.ts`'s existing export, already the value every
    index entry's `category` carries when it's an unused/removed one) until 4 total. As real
    history grows from 0 to 4, the random backfill shrinks correspondingly — no separate "empty
    state" branch, `getHomeStrip` always produces a full strip of 4.

## Recently-searched card content

Small cards, not full detail blocks — name, icon where the kind has one, an accent-colored touch
of "flair," and optionally a one-line flavor/description snippet, kept short so 4 cards stay
compact (a row/grid, not 4 stacked tooltip-sized panels).

`WikiSearchEntry` (what the combined index carries) deliberately has no `iconUrl` or flavor text —
the 2026-08-16 wiki design doc kept the *index* icon-free specifically to avoid turning a
100+-row browse list into 100+ image requests. That tradeoff doesn't apply here: the strip is
always exactly 4 entries, a fixed small set regardless of catalog size. So the 4 selected entries
(from `getHomeStrip`) each get one small follow-up client fetch of their own detail JSON (the
same static files `loadDetail` reads server-side, at `/data/wiki/<version>/<kind>s/<slug>.json` —
already gated by `proxy.ts` the same way the index files are, so a plain client `fetch` works
exactly like `fetchWikiIndex` does today) to pull `iconUrl` (items/skills only — mods/effects/maps
have none, per their detail pages' own "No icon for X" comments) and a short description/flavor
line.

The flavor/description snippet field differs by kind's detail type (`lib/wiki/types.ts`): items
carry `flavourText: string[] | null` (join with a space, same as the item detail page already
does), skills and mods carry `description: string | null`, effects and maps carry a required
`description: string`. A small per-kind resolver picks the right field and truncates it for card
display (short — a caption, not the full paragraph).

"Flair" for every card is its kind's existing accent color — `itemAccentColor(rarity)`,
`skillAccentColor(color)`, `MOD_ACCENT_COLOR`, `EFFECT_ACCENT_COLOR`, `MAP_ACCENT_COLOR` (all
already defined in `lib/wiki/accent.ts`, already used on every detail page) — as a tinted
border/background wash. Icon-less kinds (mods/effects/maps) lean on that accent wash plus the name
and flavor line rather than an image slot.

## Data flow

1. Land on `/wiki` → fetch 5 indexes in parallel → combine into one array.
2. Search bar (generalized `WikiSearch`) live-filters the combined array via Fuse as the user
   types, same UX as every existing per-kind search.
3. Click a result → `onSelectEntry` calls `recordSearchedEntry(entry)`, then normal `Link`
   navigation proceeds to that entry's real detail page.
4. Category tabs: static links to `/wiki/{items,skills,mods,effects,maps}` — no data dependency,
   same five routes `wiki/layout.tsx` already defines.
5. Recently-searched strip: computed client-side once the combined array is loaded, via
   `getHomeStrip(allEntries)` — always 4 items, real ones first, random-but-stable-looking fallback
   filling the rest.

## Error handling

Reuses `WikiBrowse`'s existing handling, not a new pattern: a session-expired error
(`WikiSessionExpiredError`) redirects to `/login?redirect=...`, same convention as every other
wiki page; any other fetch failure shows the same full-page error state already used per-kind
today. `Promise.all` means one kind's fetch failing fails the whole batch — no silently-incomplete
cross-kind search results.

## Visual design

Built with the app's existing tokens and components as-is for this first pass (Cinzel headings,
the dark-gold palette, `Card`, `TooltipDivider`, `Icon`) — informed by how wiki-style sites
commonly structure a landing page (search-forward, category grid, a "popular/recent" module), but
**no other site's actual visual assets, layout pixels, or branding are referenced or copied** —
consistent with `AGENTS.md`'s original-assets rule, which applies with at least as much force to
a third party's wiki as it does to GGG's own art. Layout/spacing/visual polish is explicitly a
follow-up pass per Jaycee's own note ("design modifications after my nap") — this spec covers
structure and data flow, not final pixel-level design.

## Testing

- Unit tests for `recentSearches.ts`: record/dedupe/cap-at-4, `getHomeStrip`'s backfill math at
  0/1/2/3/4 real entries, `UNUSED_OR_REMOVED_CATEGORY` exclusion from the random pool, and a
  `localStorage`-unavailable fallback (mirrors `WikiBrowse`'s existing storage-error handling).
- `npm run type-check`, `npm test`, `npm run lint` must stay green.
- Manual browser verification: land on `/wiki`, confirm the 4-random-item strip on a fresh
  browser profile, search across multiple kinds in one query, click into a result, confirm it
  now appears in the strip, confirm category tabs still navigate correctly, confirm existing
  per-kind browse pages (`/wiki/items` etc.) are unaffected by the `WikiSearch` prop change.
