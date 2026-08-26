# Wiki Home Page + Universal Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/wiki`'s bare redirect-to-`/wiki/items` with a real landing page: a search bar spanning all 5 wiki kinds at once, the 5 category destinations as visual tiles, and a "recently searched" strip of 4 small cards.

**Architecture:** Reuse existing per-kind infrastructure end to end — `fetchWikiIndex` (unchanged) fetches all 5 kind indexes in parallel on page mount; a generalized `WikiSearch` (drops its single-kind `basePath` prop, resolves each result's link from the entry's own `kind`) searches the combined array with the same Fuse tuning already used everywhere. A new `recentSearches` module tracks up to 4 recently-clicked entries in `localStorage`, backfilling with random picks (never fake-empty) up to a full strip of 4. A new small per-entry detail fetch pulls just the icon/flavor-text/accent needed for those 4 cards — the search index itself deliberately excludes that data.

**Tech Stack:** Next.js 16 App Router (client component page), React 19, Fuse.js (already a dependency), `localStorage`, Vitest (existing `node`-environment config, no jsdom).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-26-wiki-home-universal-search-design.md` — read it before starting; this plan implements it exactly.
- Scope is wiki content only (items/skills/mods/effects/maps). Do not touch the passive tree, do not add any global/cross-page search UI — this search lives only on `/wiki`.
- No new backend/Supabase work — "recently searched" is `localStorage`-only, per-browser.
- `WikiSearchEntry` (`src/lib/wiki/types.ts`) stays slim — do not add `iconUrl`/description fields to it. Icon/flavor text for the 4 strip cards comes from a separate small per-entry fetch (Task 3), not from bloating the index.
- Follow existing patterns exactly: `typeof window === 'undefined'` guards and swallowed storage errors (see `WikiBrowse.tsx`'s `readStoredView`/`writeStoredView`), the `WikiSessionExpiredError` → redirect-to-login convention (see `fetchIndex.ts` / `WikiBrowse.tsx`).
- Run `npm run type-check`, `npm test`, `npm run lint` after every task — all three must stay green before moving to the next task.

---

### Task 1: Generalize `WikiSearch` — drop `basePath`, resolve links per-entry, add `onSelectEntry`

**Files:**
- Modify: `src/components/wiki/WikiSearch.tsx`
- Modify: `src/components/wiki/WikiBrowse.tsx:87-96,273` (drop the now-dead `basePath` prop)
- Modify: `src/app/wiki/items/page.tsx:9`, `src/app/wiki/skills/page.tsx:9`, `src/app/wiki/mods/page.tsx:9`, `src/app/wiki/effects/page.tsx:31`, `src/app/wiki/maps/page.tsx:9` (drop the `basePath="..."` argument)

**Interfaces:**
- Consumes: `WIKI_BASE_PATH: Record<WikiEntryKind, string>` (already exported from `src/lib/wiki/types.ts`).
- Produces: `WikiSearch({ entries, initialQuery?, onQueryChange?, onSelectEntry? })` — `onSelectEntry?: (entry: WikiSearchEntry) => void`, called when a result `Link` is clicked, before navigation proceeds. `basePath` prop removed entirely. `filterEntries` (already exported) is unchanged — do not touch its signature or logic.

Every `WikiSearchEntry` already carries its own `kind` (`src/lib/wiki/types.ts:27-33`), and `WIKI_BASE_PATH[kind]` already gives the right route — the `basePath` prop was always redundant with that (every existing call site passes `basePath={WIKI_BASE_PATH[kind]}` for a single, already-known kind). `WikiBrowse`'s own `basePath` prop only ever forwards to `WikiSearch` (`WikiBrowse.tsx:273`) — once `WikiSearch` doesn't need it, `WikiBrowse`'s copy becomes dead and should be removed too, along with the argument at all 5 call sites.

- [ ] **Step 1: Update `WikiSearch.tsx`**

Replace the component's props and the result `Link`:

```tsx
import Link from 'next/link';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { FUZZY_SEARCH_TUNING } from '@/lib/fuseOptions';
import { humanizeCategory } from '@/lib/wiki/humanizeCategory';
import { attributeTagColor } from '@/lib/wiki/attributeTagColor';
import { WIKI_BASE_PATH } from '@/lib/wiki/types';
import type { WikiSearchEntry } from '@/lib/wiki/types';
```

(add the `WIKI_BASE_PATH` import to the existing import block)

```tsx
export function WikiSearch({
  entries,
  initialQuery,
  onQueryChange,
  onSelectEntry,
}: {
  entries: WikiSearchEntry[];
  /** Prefills the search box — set from `?q=` by a mention link that couldn't resolve to one exact entry (see MentionLinks.tsx). */
  initialQuery?: string;
  /** Called with the query on every change — lets a parent (WikiBrowse) persist it for view-state restoration without lifting the whole input into a controlled component. */
  onQueryChange?: (query: string) => void;
  /** Called when a result is clicked, before navigation — lets a parent (the wiki home page) record it without WikiSearch needing to know why. */
  onSelectEntry?: (entry: WikiSearchEntry) => void;
}) {
```

(remove `basePath` from both the destructured params and the type)

Change the result `Link`:

```tsx
              <Link
                href={`${WIKI_BASE_PATH[entry.kind]}/${entry.slug}`}
                onClick={() => onSelectEntry?.(entry)}
                className={cn(
```

(replace the `href={`${basePath}/${entry.slug}`}` line and add the `onClick`; everything else in the `Link` — `className`, children — is unchanged)

- [ ] **Step 2: Update `WikiBrowse.tsx`**

Remove `basePath` from the props destructure and type (`WikiBrowse.tsx:87-96`):

```tsx
export function WikiBrowse({
  kind,
  quickFilters,
}: {
  kind: WikiEntryKind;
  /** Optional quick-filter chip row above the search box (see `QuickFilter`) — omit for kinds with no curated set. */
  quickFilters?: QuickFilter[];
}) {
```

Remove the now-invalid `basePath` argument from the `WikiSearch` call (`WikiBrowse.tsx:273`):

```tsx
        <WikiSearch entries={visibleEntries} initialQuery={initialQuery} onQueryChange={handleQueryChange} />
```

- [ ] **Step 3: Drop `basePath="..."` from all 5 page call sites**

In each file, remove just the `basePath="..."` argument, keeping everything else on the line identical:

`src/app/wiki/items/page.tsx:9`: `<WikiBrowse kind="item" />`
`src/app/wiki/skills/page.tsx:9`: `<WikiBrowse kind="skill" />`
`src/app/wiki/mods/page.tsx:9`: `<WikiBrowse kind="mod" />`
`src/app/wiki/maps/page.tsx:9`: `<WikiBrowse kind="map" />`
`src/app/wiki/effects/page.tsx:31`: `<WikiBrowse kind="effect" quickFilters={EFFECT_QUICK_FILTERS} />`

- [ ] **Step 4: Run existing tests and type-check**

Run: `npm run type-check && npm test -- WikiSearch`
Expected: type-check passes with no errors about `basePath`; `WikiSearch.test.ts`'s existing `filterEntries` tests still pass unchanged (that function isn't touched by this task).

There is no existing component-render test for `WikiSearch` to update — this repo's Vitest config runs in the `node` environment with no jsdom (see `fetchIndex.ts`'s own comment on this), so `WikiSearch.test.ts` only ever covered the pure `filterEntries` function. Verify the link/onSelectEntry change with a manual browser check instead, in Step 5.

- [ ] **Step 5: Manual browser verification**

Run `npm run dev`, sign in, visit `/wiki/items`, `/wiki/skills`, `/wiki/mods`, `/wiki/effects`, `/wiki/maps` — confirm each still searches and each result still links to the correct detail page (identical behavior to before this task; only the internal mechanism for building the href changed).

- [ ] **Step 6: Commit**

```bash
git add src/components/wiki/WikiSearch.tsx src/components/wiki/WikiBrowse.tsx src/app/wiki/items/page.tsx src/app/wiki/skills/page.tsx src/app/wiki/mods/page.tsx src/app/wiki/effects/page.tsx src/app/wiki/maps/page.tsx
git commit -m "refactor(wiki): resolve WikiSearch result links from each entry's own kind

Drops the basePath prop (always redundant with WIKI_BASE_PATH[entry.kind],
which every existing call site already passed) and adds an onSelectEntry
callback, needed by the upcoming cross-kind wiki home page search where
results span multiple kinds at once."
```

---

### Task 2: `recentSearches` module — record + compute the 4-card home strip

**Files:**
- Modify: `src/lib/wiki/types.ts` (add two small exports)
- Create: `src/lib/wiki/recentSearches.ts`
- Create: `src/lib/wiki/recentSearches.test.ts`

**Interfaces:**
- Consumes: `WikiSearchEntry`, `WikiEntryKind` (`src/lib/wiki/types.ts`); `UNUSED_OR_REMOVED_CATEGORY` (already exported from `src/lib/wiki/normalize.ts:612`).
- Produces: `ALL_WIKI_KINDS: readonly WikiEntryKind[]`, `WIKI_KIND_LABEL: Record<WikiEntryKind, string>` (both from `types.ts`, consumed by Task 5's page). `recordSearchedEntry(entry: WikiSearchEntry): void` and `getHomeStrip(allEntries: WikiSearchEntry[]): WikiSearchEntry[]` (always returns exactly 4, or fewer only if `allEntries` itself has fewer than 4 eligible entries) from `recentSearches.ts`, consumed by Task 5's page and Task 4's strip component.

- [ ] **Step 1: Add the two small exports to `types.ts`**

Add after `WIKI_BASE_PATH` (`types.ts:24`):

```ts
/** Every wiki kind, in the order they should be presented (search fetch order, home-page tile order). */
export const ALL_WIKI_KINDS: readonly WikiEntryKind[] = ['item', 'skill', 'mod', 'effect', 'map'];

/** Plural display label per kind — used by the wiki home page's category tiles. */
export const WIKI_KIND_LABEL: Record<WikiEntryKind, string> = {
  item: 'Items',
  skill: 'Skills',
  mod: 'Mods',
  effect: 'Effects',
  map: 'Maps',
};
```

- [ ] **Step 2: Write the failing test for `recentSearches.ts`**

This repo's Vitest config runs in the plain `node` environment (`vitest.config.ts`: `environment: 'node'`, no jsdom) — Node has no global `window`/`localStorage` outside an experimental opt-in flag (confirmed: a bare `node -e "localStorage.setItem(...)"` throws `Cannot read properties of undefined`). `recentSearches.ts`'s `typeof window === 'undefined'` guard (Step 4 below) is still correct and necessary — it's what keeps the module SSR-safe in this Next.js app, matching `WikiBrowse.tsx`'s existing `readStoredView` convention exactly — but it means the test file must stub `window`/`localStorage` itself before each test, or every test would either no-op silently (module thinks it's on the server) or throw immediately on a raw `localStorage.clear()` call. Stub with `vi.stubGlobal`, not a raw assignment, so `vi.unstubAllGlobals()` cleanly resets it between tests.

Create `src/lib/wiki/recentSearches.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordSearchedEntry, getHomeStrip } from './recentSearches';
import { UNUSED_OR_REMOVED_CATEGORY } from './normalize';
import type { WikiSearchEntry } from './types';

function entry(kind: WikiSearchEntry['kind'], slug: string, category = 'Test'): WikiSearchEntry {
  return { slug, name: slug, kind, category, tags: [] };
}

const pool: WikiSearchEntry[] = [
  entry('item', 'a-item'),
  entry('item', 'b-item'),
  entry('skill', 'c-skill'),
  entry('mod', 'd-mod'),
  entry('effect', 'e-effect'),
  entry('map', 'f-map', UNUSED_OR_REMOVED_CATEGORY),
];

/** Minimal in-memory Storage — Node has no real localStorage to stub onto. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('recordSearchedEntry + getHomeStrip', () => {
  it('backfills all 4 slots with random picks when nothing has been searched yet', () => {
    const strip = getHomeStrip(pool);
    expect(strip).toHaveLength(4);
  });

  it('never includes an Unused / Removed entry in the random backfill', () => {
    for (let i = 0; i < 20; i++) {
      const strip = getHomeStrip(pool);
      expect(strip.some((e) => e.category === UNUSED_OR_REMOVED_CATEGORY)).toBe(false);
    }
  });

  it('puts real recorded entries first, then backfills the rest', () => {
    recordSearchedEntry(entry('item', 'a-item'));
    const strip = getHomeStrip(pool);
    expect(strip).toHaveLength(4);
    expect(strip[0]).toEqual(entry('item', 'a-item'));
  });

  it('dedupes by kind+slug — recording the same entry twice keeps one, moved to the front', () => {
    recordSearchedEntry(entry('item', 'a-item'));
    recordSearchedEntry(entry('skill', 'c-skill'));
    recordSearchedEntry(entry('item', 'a-item'));
    const strip = getHomeStrip(pool);
    expect(strip[0]).toEqual(entry('item', 'a-item'));
    expect(strip[1]).toEqual(entry('skill', 'c-skill'));
    expect(strip.filter((e) => e.slug === 'a-item')).toHaveLength(1);
  });

  it('caps recorded history at 4 — a 5th recording drops the oldest', () => {
    recordSearchedEntry(entry('item', 'a-item'));
    recordSearchedEntry(entry('item', 'b-item'));
    recordSearchedEntry(entry('skill', 'c-skill'));
    recordSearchedEntry(entry('mod', 'd-mod'));
    recordSearchedEntry(entry('effect', 'e-effect'));
    const strip = getHomeStrip(pool);
    expect(strip).toHaveLength(4);
    expect(strip.map((e) => e.slug)).toEqual(['e-effect', 'd-mod', 'c-skill', 'b-item']);
  });

  it('does not throw when localStorage throws (private browsing, quota, etc.)', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('unavailable'); },
      setItem() { throw new Error('unavailable'); },
    });
    expect(() => recordSearchedEntry(entry('item', 'a-item'))).not.toThrow();
    expect(() => getHomeStrip(pool)).not.toThrow();
  });

  it('treats a server-rendered environment (no window) as empty, not an error', () => {
    vi.stubGlobal('window', undefined);
    expect(() => recordSearchedEntry(entry('item', 'a-item'))).not.toThrow();
    expect(getHomeStrip(pool)).toHaveLength(4);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- recentSearches`
Expected: FAIL with "Cannot find module './recentSearches'" (the module doesn't exist yet).

- [ ] **Step 4: Implement `recentSearches.ts`**

Create `src/lib/wiki/recentSearches.ts`:

```ts
// Tracks a per-browser "recently searched" list for the wiki home page's
// strip of 4 cards. localStorage (not sessionStorage — this should persist
// across sessions, unlike WikiBrowse's view-restore) under one shared key,
// not per-kind, since the strip spans all 5 kinds at once.
import { UNUSED_OR_REMOVED_CATEGORY } from './normalize';
import type { WikiSearchEntry } from './types';

const STORAGE_KEY = 'wiki:recent-searches';
const MAX_ENTRIES = 4;

function readStored(): WikiSearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as WikiSearchEntry[]) : [];
  } catch {
    return [];
  }
}

function writeStored(entries: WikiSearchEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full/disabled/unavailable - losing recent-search history is harmless.
  }
}

function sameEntry(a: WikiSearchEntry, b: WikiSearchEntry): boolean {
  return a.kind === b.kind && a.slug === b.slug;
}

/** Records `entry` as most-recently-searched, deduped by kind+slug, capped at 4. */
export function recordSearchedEntry(entry: WikiSearchEntry): void {
  const existing = readStored().filter((e) => !sameEntry(e, entry));
  writeStored([entry, ...existing].slice(0, MAX_ENTRIES));
}

/**
 * Always returns exactly 4 entries for the home page's strip (fewer only if
 * `allEntries` itself doesn't have 4 eligible entries to offer): real
 * recorded searches first, then random picks from `allEntries` backfill the
 * rest — excluding anything already shown and excluding
 * `UNUSED_OR_REMOVED_CATEGORY` entries, which shouldn't be presented as
 * "popular." Re-randomizes on every call (call once per page load, not per
 * render — see the wiki home page's use of `useMemo`).
 */
export function getHomeStrip(allEntries: WikiSearchEntry[]): WikiSearchEntry[] {
  const recorded = readStored().slice(0, MAX_ENTRIES);
  const needed = MAX_ENTRIES - recorded.length;
  if (needed === 0) return recorded;

  const candidates = allEntries.filter(
    (e) => e.category !== UNUSED_OR_REMOVED_CATEGORY && !recorded.some((r) => sameEntry(r, e))
  );
  // Fisher-Yates partial shuffle — only need the first `needed` picks, not a
  // fully shuffled array.
  const pool = [...candidates];
  const picks: WikiSearchEntry[] = [];
  for (let i = 0; i < needed && pool.length > 0; i++) {
    const j = Math.floor(Math.random() * pool.length);
    picks.push(pool[j]);
    pool[j] = pool[pool.length - 1];
    pool.pop();
  }
  return [...recorded, ...picks];
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- recentSearches`
Expected: PASS, all 7 cases.

- [ ] **Step 6: Run full verification**

Run: `npm run type-check && npm test && npm run lint`
Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/wiki/types.ts src/lib/wiki/recentSearches.ts src/lib/wiki/recentSearches.test.ts
git commit -m "feat(wiki): add per-browser recent-searches tracking for the wiki home page

recordSearchedEntry/getHomeStrip back the home page's 4-card strip —
localStorage-only, no backend. getHomeStrip always returns a full strip
of 4: real recorded searches first, random (never Unused/Removed) picks
backfill the rest, shrinking as real history grows."
```

---

### Task 3: Per-entry card-detail fetch (icon, flavor snippet, accent color)

**Files:**
- Create: `src/lib/wiki/fetchDetail.ts`
- Create: `src/lib/wiki/fetchDetail.test.ts`

**Interfaces:**
- Consumes: `WikiEntryKind` (`types.ts`); `itemAccentColor`, `skillAccentColor`, `MOD_ACCENT_COLOR`, `EFFECT_ACCENT_COLOR`, `MAP_ACCENT_COLOR` (`src/lib/wiki/accent.ts`, all already exported, unchanged); `WikiIndexFetchError`, `WikiSessionExpiredError` (already exported from `src/lib/wiki/fetchIndex.ts`).
- Produces: `WikiCardSnippet { iconUrl: string | null; iconWidth: number | null; iconHeight: number | null; snippet: string; accent: string }`, `extractCardSnippet(kind: WikiEntryKind, raw: unknown): WikiCardSnippet` (exported for testing), `fetchWikiCardSnippet(kind: WikiEntryKind, slug: string): Promise<WikiCardSnippet>` — consumed by Task 4's strip component.

`WikiSearchEntry` (the index) has no icon/description/rarity/color fields by design (`2026-08-16-wiki-design.md` — kept the index icon-free to avoid a 100+-row browse list turning into 100+ image requests). The home strip is always exactly 4 entries, a fixed small set regardless of catalog size, so each of those 4 gets its own follow-up fetch of its full detail JSON (the same static file `loadDetail` reads server-side, at `/data/wiki/<version>/<kind>s/<slug>.json`, already gated by `proxy.ts` the same way the index files are).

- [ ] **Step 1: Write the failing test**

Create `src/lib/wiki/fetchDetail.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { extractCardSnippet } from './fetchDetail';

describe('extractCardSnippet', () => {
  it('joins an item\'s flavourText array and reads its icon', () => {
    const result = extractCardSnippet('item', {
      iconUrl: '/icon.png',
      iconWidth: 64,
      iconHeight: 64,
      flavourText: ['Line one.', 'Line two.'],
      rarity: 'normal',
    });
    expect(result.iconUrl).toBe('/icon.png');
    expect(result.snippet).toBe('Line one. Line two.');
  });

  it('gives a unique item the unique accent color', () => {
    const result = extractCardSnippet('item', { rarity: 'unique' });
    expect(result.accent).toBe('var(--wiki-unique)');
  });

  it('gives a normal item the neutral border accent color', () => {
    const result = extractCardSnippet('item', { rarity: 'normal' });
    expect(result.accent).toBe('var(--border)');
  });

  it('reads a skill\'s description and gem-color accent, with no icon fallback needed', () => {
    const result = extractCardSnippet('skill', {
      iconUrl: '/gem.png',
      description: 'Conjures a wave of ice.',
      color: 'b',
    });
    expect(result.iconUrl).toBe('/gem.png');
    expect(result.snippet).toBe('Conjures a wave of ice.');
    expect(result.accent).toBe('var(--wiki-gem-b)');
  });

  it('falls back to white gem accent for an unrecognized skill color', () => {
    const result = extractCardSnippet('skill', { color: 'not-a-color' });
    expect(result.accent).toBe('var(--wiki-gem-w)');
  });

  it('has no icon for mods, effects, or maps, and uses their flat accent colors', () => {
    expect(extractCardSnippet('mod', { description: 'x' })).toMatchObject({ iconUrl: null, accent: 'var(--primary)' });
    expect(extractCardSnippet('effect', { description: 'x' })).toMatchObject({ iconUrl: null, accent: 'var(--wiki-effect)' });
    expect(extractCardSnippet('map', { description: 'x' })).toMatchObject({ iconUrl: null, accent: 'var(--wiki-map)' });
  });

  it('defaults to an empty snippet and null icon fields for malformed input', () => {
    const result = extractCardSnippet('item', null);
    expect(result).toEqual({ iconUrl: null, iconWidth: null, iconHeight: null, snippet: '', accent: 'var(--border)' });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- fetchDetail`
Expected: FAIL with "Cannot find module './fetchDetail'".

- [ ] **Step 3: Implement `fetchDetail.ts`**

Create `src/lib/wiki/fetchDetail.ts`:

```ts
// Fetches just enough of one wiki entry's detail JSON to render it as a
// small card (icon, a short flavor/description snippet, an accent color) —
// used only by the wiki home page's 4-card "recently searched" strip. Not a
// full detail-shape validator like load.ts's server-side isDetailFor; this
// defensively reads a handful of fields and falls back to safe defaults for
// anything malformed rather than rejecting the whole response, since a
// slightly-wrong card is a much smaller problem here than a hard error.
import { itemAccentColor, skillAccentColor, MOD_ACCENT_COLOR, EFFECT_ACCENT_COLOR, MAP_ACCENT_COLOR } from './accent';
import { WikiIndexFetchError, WikiSessionExpiredError } from './fetchIndex';
import { WIKI_DATA_VERSION } from './types';
import type { WikiEntryKind } from './types';

export interface WikiCardSnippet {
  iconUrl: string | null;
  iconWidth: number | null;
  iconHeight: number | null;
  /** Short flavor/description text, already picked from the right field for this entry's kind. Empty string, never null, when the source has none. */
  snippet: string;
  accent: string;
}

const KIND_PLURAL: Record<WikiEntryKind, string> = {
  item: 'items',
  skill: 'skills',
  mod: 'mods',
  effect: 'effects',
  map: 'maps',
};

const SKILL_COLORS = ['r', 'g', 'b', 'w'] as const;

function accentFor(kind: WikiEntryKind, v: Record<string, unknown>): string {
  if (kind === 'item') return itemAccentColor(v.rarity === 'unique' ? 'unique' : 'normal');
  if (kind === 'skill') {
    const color = SKILL_COLORS.includes(v.color as (typeof SKILL_COLORS)[number])
      ? (v.color as (typeof SKILL_COLORS)[number])
      : 'w';
    return skillAccentColor(color);
  }
  if (kind === 'mod') return MOD_ACCENT_COLOR;
  if (kind === 'effect') return EFFECT_ACCENT_COLOR;
  return MAP_ACCENT_COLOR;
}

/** Exported for testing — pure extraction, no I/O. */
export function extractCardSnippet(kind: WikiEntryKind, raw: unknown): WikiCardSnippet {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const iconUrl = typeof v.iconUrl === 'string' ? v.iconUrl : null;
  const iconWidth = typeof v.iconWidth === 'number' ? v.iconWidth : null;
  const iconHeight = typeof v.iconHeight === 'number' ? v.iconHeight : null;

  let snippet = '';
  if (kind === 'item') {
    snippet = Array.isArray(v.flavourText)
      ? v.flavourText.filter((s): s is string => typeof s === 'string').join(' ')
      : '';
  } else if (typeof v.description === 'string') {
    snippet = v.description;
  }

  return { iconUrl, iconWidth, iconHeight, snippet, accent: accentFor(kind, v) };
}

/**
 * Fetches one entry's detail JSON client-side and extracts just the card
 * fields. Same static file `loadDetail` reads server-side
 * (`/data/wiki/<version>/<kind>s/<slug>.json`), same auth gating
 * (`proxy.ts`) as the index files `fetchWikiIndex` already reads.
 */
export async function fetchWikiCardSnippet(kind: WikiEntryKind, slug: string): Promise<WikiCardSnippet> {
  const res = await fetch(`/data/wiki/${WIKI_DATA_VERSION}/${KIND_PLURAL[kind]}/${slug}.json`);

  if (res.redirected && new URL(res.url).pathname === '/login') {
    throw new WikiSessionExpiredError('Session expired — please sign in again.');
  }
  if (!res.ok) {
    throw new WikiIndexFetchError(`Failed to load ${kind} detail (HTTP ${res.status})`);
  }

  const data: unknown = await res.json();
  return extractCardSnippet(kind, data);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- fetchDetail`
Expected: PASS, all 7 cases.

- [ ] **Step 5: Run full verification**

Run: `npm run type-check && npm test && npm run lint`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/wiki/fetchDetail.ts src/lib/wiki/fetchDetail.test.ts
git commit -m "feat(wiki): add per-entry card-detail fetch for the recent-searches strip

Fetches just icon/flavor-text/accent for one entry's detail JSON —
kept out of the search index by design (index stays icon-free to avoid
a 100+-row browse list becoming 100+ image requests); the home strip
is always exactly 4 entries, so a small per-entry fetch is the right
tradeoff here."
```

---

### Task 4: `RecentSearchesStrip` component

**Files:**
- Create: `src/components/wiki/RecentSearchesStrip.tsx`

**Interfaces:**
- Consumes: `WikiSearchEntry`, `WIKI_BASE_PATH` (`types.ts`); `fetchWikiCardSnippet`, `WikiCardSnippet` (Task 3); `Card` (`src/components/ui/card.tsx`, unchanged).
- Produces: `RecentSearchesStrip({ entries: WikiSearchEntry[] })` — consumed by Task 5's page.

No unit test for this component (same reasoning as Task 1 — this repo's Vitest config has no jsdom; component rendering is verified manually in Task 5's browser check, once it's wired into the real page).

- [ ] **Step 1: Implement `RecentSearchesStrip.tsx`**

Create `src/components/wiki/RecentSearchesStrip.tsx`:

```tsx
'use client';

// The wiki home page's 4-card "recently searched" strip. `entries` (exactly
// 4, from recentSearches.ts's getHomeStrip) only carry the slim search-index
// fields — this component fetches each one's own small card-detail snippet
// (icon, flavor text, accent color) independently, via Promise.allSettled
// rather than Promise.all: this strip is supplementary, not critical page
// content, so one entry's detail fetch failing shouldn't blank the whole
// strip — it just renders with fewer cards.
import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { fetchWikiCardSnippet } from '@/lib/wiki/fetchDetail';
import type { WikiCardSnippet } from '@/lib/wiki/fetchDetail';
import { WIKI_BASE_PATH } from '@/lib/wiki/types';
import type { WikiSearchEntry } from '@/lib/wiki/types';
import { Card } from '@/components/ui/card';

interface CardData {
  entry: WikiSearchEntry;
  snippet: WikiCardSnippet;
}

export function RecentSearchesStrip({ entries }: { entries: WikiSearchEntry[] }) {
  const [cards, setCards] = useState<CardData[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled(entries.map((entry) => fetchWikiCardSnippet(entry.kind, entry.slug))).then(
      (results) => {
        if (cancelled) return;
        const loaded: CardData[] = [];
        results.forEach((result, i) => {
          if (result.status === 'fulfilled') loaded.push({ entry: entries[i], snippet: result.value });
        });
        setCards(loaded);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [entries]);

  if (!cards || cards.length === 0) return null;

  return (
    <div>
      <h2 className="mb-3 font-heading text-lg text-primary">Recently searched</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map(({ entry, snippet }) => (
          <Link key={`${entry.kind}-${entry.slug}`} href={`${WIKI_BASE_PATH[entry.kind]}/${entry.slug}`}>
            <Card
              className="h-full p-3 transition-colors hover:bg-accent/40"
              style={{ borderColor: snippet.accent }}
            >
              {snippet.iconUrl && (
                <Image
                  src={snippet.iconUrl}
                  alt=""
                  width={snippet.iconWidth ?? 40}
                  height={snippet.iconHeight ?? 40}
                  unoptimized
                  className="mx-auto mb-2 h-10 w-auto object-contain"
                />
              )}
              <p className="truncate text-center font-heading text-sm" style={{ color: snippet.accent }}>
                {entry.name}
              </p>
              {snippet.snippet && (
                <p className="mt-1 line-clamp-2 text-center text-xs text-muted-foreground">{snippet.snippet}</p>
              )}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type-check and lint**

Run: `npm run type-check && npm run lint`
Expected: both pass. (This component has no unit test — verified visually as part of Task 5's manual check.)

- [ ] **Step 3: Commit**

```bash
git add src/components/wiki/RecentSearchesStrip.tsx
git commit -m "feat(wiki): add RecentSearchesStrip component for the wiki home page

Renders the 4-card strip from recentSearches.ts's getHomeStrip output,
fetching each card's own icon/flavor/accent via fetchWikiCardSnippet.
Uses Promise.allSettled — this is supplementary content, so one card's
fetch failing shouldn't blank the whole strip."
```

---

### Task 5: The wiki home page itself

**Files:**
- Modify: `src/app/wiki/page.tsx` (replace the bare `redirect()` entirely)

**Interfaces:**
- Consumes: `fetchWikiIndex`, `WikiSessionExpiredError` (`src/lib/wiki/fetchIndex.ts`); `ALL_WIKI_KINDS`, `WIKI_KIND_LABEL`, `WIKI_BASE_PATH`, `WikiSearchEntry` (`src/lib/wiki/types.ts`); `recordSearchedEntry`, `getHomeStrip` (Task 2); `WikiSearch` (Task 1's generalized version); `RecentSearchesStrip` (Task 4); `useRouter` (`next/navigation`, same pattern as `WikiBrowse.tsx`).
- Produces: the `/wiki` route's default export — nothing else consumes this page.

This mirrors `WikiBrowse.tsx`'s existing `LoadState` union and session-expired redirect exactly (same shape, same behavior) rather than inventing a new loading pattern — the only difference is fetching 5 indexes via `Promise.all` instead of 1.

- [ ] **Step 1: Replace `src/app/wiki/page.tsx`**

```tsx
'use client';

// /wiki — the wiki's own landing page. Searches all 5 kinds at once (unlike
// each /wiki/{items,skills,mods,effects,maps} browse page, which only
// searches its own kind), links out to each kind's browse page, and shows a
// small "recently searched" strip. See
// docs/superpowers/specs/2026-08-26-wiki-home-universal-search-design.md.
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { fetchWikiIndex, WikiSessionExpiredError } from '@/lib/wiki/fetchIndex';
import { getHomeStrip, recordSearchedEntry } from '@/lib/wiki/recentSearches';
import { ALL_WIKI_KINDS, WIKI_BASE_PATH, WIKI_KIND_LABEL } from '@/lib/wiki/types';
import type { WikiSearchEntry } from '@/lib/wiki/types';
import { WikiSearch } from '@/components/wiki/WikiSearch';
import { RecentSearchesStrip } from '@/components/wiki/RecentSearchesStrip';
import { Card } from '@/components/ui/card';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: WikiSearchEntry[] };

export default function WikiHome() {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;
    Promise.all(ALL_WIKI_KINDS.map((kind) => fetchWikiIndex(kind)))
      .then((results) => {
        if (cancelled) return;
        setState({ status: 'ready', entries: results.flat() });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof WikiSessionExpiredError) {
          router.replace(`/login?redirect=${encodeURIComponent('/wiki')}`);
          return;
        }
        const message = e instanceof Error ? e.message : 'Failed to load data.';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  // Computed once per successful load, not per render — getHomeStrip
  // re-randomizes its backfill on every call, and we don't want the strip
  // reshuffling on every unrelated re-render (e.g. every keystroke in the
  // search box below).
  const homeStrip = useMemo(
    () => (state.status === 'ready' ? getHomeStrip(state.entries) : []),
    [state],
  );

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading the wiki…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-md border border-destructive/50 bg-card px-3 py-2 text-sm text-destructive">
        Failed to load the wiki: {state.message}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <WikiSearch entries={state.entries} onSelectEntry={recordSearchedEntry} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {ALL_WIKI_KINDS.map((kind) => {
          const count = state.entries.filter((e) => e.kind === kind).length;
          return (
            <Link key={kind} href={WIKI_BASE_PATH[kind]}>
              <Card className="p-4 text-center transition-colors hover:bg-accent/40">
                <p className="font-heading text-base text-primary">{WIKI_KIND_LABEL[kind]}</p>
                <p className="mt-1 text-xs text-muted-foreground">{count.toLocaleString()}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <RecentSearchesStrip entries={homeStrip} />
    </div>
  );
}
```

- [ ] **Step 2: Run full verification**

Run: `npm run type-check && npm test && npm run lint`
Expected: all green.

- [ ] **Step 3: Manual browser verification**

Start the dev server (`npm run dev`), sign in, then:
1. Navigate to `/wiki` — confirm it no longer redirects, and instead shows the search bar, 5 category tiles (with entry counts), and a 4-card "Recently searched" strip.
2. On a fresh browser profile (or after clearing `localStorage`), confirm the strip still shows exactly 4 cards (random picks).
3. Search for something that exists in a kind other than items (e.g. a skill name) — confirm it appears in results and its link goes to the right kind's detail page.
4. Click a result — confirm it navigates to the correct detail page, then navigate back to `/wiki` and confirm that entry now appears in the "Recently searched" strip.
5. Click each of the 5 category tiles — confirm each navigates to its browse page and that page still works exactly as before (Task 1's `WikiSearch`/`WikiBrowse` change didn't regress the per-kind browse pages).
6. Resize to mobile width — confirm the tiles and strip reflow to 2 columns sensibly.

- [ ] **Step 4: Commit**

```bash
git add src/app/wiki/page.tsx
git commit -m "feat(wiki): build the real /wiki home page

Replaces the bare redirect-to-/wiki/items with a real landing page:
cross-kind search, 5 category tiles with live entry counts, and the
recently-searched strip. See
docs/superpowers/specs/2026-08-26-wiki-home-universal-search-design.md."
```

---

### Task 6: Final verification and push

**Files:** none (verification only)

- [ ] **Step 1: Full check suite**

Run: `npm run type-check && npm test && npm run lint`
Expected: all green.

- [ ] **Step 2: Full manual regression pass**

Repeat Task 5 Step 3's checklist once more end to end, plus: visit an item detail page via a mention link's `?q=` fallback (any wiki detail page's body text with a cross-reference) to confirm `MentionLinks`/`linkMentions` still work — they're untouched by this plan, but the `WIKI_BASE_PATH` import pattern in `WikiSearch.tsx` changed, so a final smoke check is worthwhile.

- [ ] **Step 3: Push**

```bash
git push origin main
```
