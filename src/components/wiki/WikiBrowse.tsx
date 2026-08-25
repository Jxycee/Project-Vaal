'use client';

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { WikiSearch } from './WikiSearch';
import { groupByCategory } from '@/lib/wiki/categoryGroups';
import { groupByTaxonomy, ITEM_CATEGORY_GROUPS } from '@/lib/wiki/categoryTaxonomy';
import { CategorySidebar } from './CategorySidebar';
import { fetchWikiIndex, WikiSessionExpiredError } from '@/lib/wiki/fetchIndex';
import type { WikiEntryKind, WikiSearchEntry } from '@/lib/wiki/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: WikiSearchEntry[] };

// Plural noun used in the loading/error message. Kept as an internal lookup
// (rather than a prop each call site passes) so it can't drift out of sync
// with `kind` — there's exactly one correct label per kind.
const ENTITY_LABEL: Record<WikiEntryKind, string> = {
  item: 'items',
  skill: 'skill gems',
  mod: 'mods',
  effect: 'effects',
};

interface BrowseViewState {
  category: string | null;
  tag: string | null;
  query: string;
  scrollY: number;
}

/** One quick-filter chip above the search box — see `EffectsPage`'s usage. Filters by `WikiSearchEntry.tags` (e.g. an effect's GGPK-derived "Buff"/"Debuff"/"Charm" tag), not by category, and is additive to whatever category is selected. */
export interface QuickFilter {
  tag: string;
  label: string;
  /** CSS color value (a `var(--...)` token, to stay theme-aware) for the chip's dot and active-state tint. */
  color: string;
}

/**
 * Persists the browse page's own view (selected category, search query,
 * scroll position) across a full remount - visiting a detail page and
 * hitting Back remounts `WikiBrowse` from scratch (it's client-fetched, not
 * part of the routed page's own history entry), which previously reset the
 * list to the very top with every filter cleared, even though the user was
 * just there. `sessionStorage` (not localStorage) deliberately - this is
 * "where was I in this browsing session," not a setting worth carrying
 * across tabs/days. Keyed per kind since each browse route mounts its own
 * `WikiBrowse` instance.
 */
function storageKey(kind: WikiEntryKind): string {
  return `wiki-browse:${kind}`;
}

function readStoredView(kind: WikiEntryKind): BrowseViewState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(storageKey(kind));
    return raw ? (JSON.parse(raw) as BrowseViewState) : null;
  } catch {
    return null;
  }
}

function writeStoredView(kind: WikiEntryKind, view: BrowseViewState): void {
  try {
    sessionStorage.setItem(storageKey(kind), JSON.stringify(view));
  } catch {
    // Storage full/disabled - losing view-restore is harmless, nothing to recover.
  }
}

/**
 * Client-side data loader for the wiki browse pages (items/skills/mods).
 *
 * The index JSON used to be read server-side (readFile + JSON.parse) on
 * every request from these pages' Server Components, which meant re-parsing
 * a multi-hundred-KB-to-megabyte file on every load with no HTTP caching.
 * Now that /data/wiki/** is gated by src/proxy.ts (same as /wiki itself),
 * fetching it client-side is safe — the browser sends the auth cookie
 * automatically on a same-origin fetch — and lets the static file benefit
 * from normal HTTP caching instead.
 */
export function WikiBrowse({
  kind,
  basePath,
  quickFilters,
}: {
  kind: WikiEntryKind;
  basePath: string;
  /** Optional quick-filter chip row above the search box (see `QuickFilter`) — omit for kinds with no curated set. */
  quickFilters?: QuickFilter[];
}) {
  const router = useRouter();
  // Set only by a mention link's `?q=` (see MentionLinks.tsx) — a generic
  // tiered-item mention (e.g. "Jeweller's Orb") with no single bare entry to
  // point at instead prefills the search box here. Takes priority over a
  // stored view: arriving via an explicit mention link is a fresh intent,
  // not a "continue where I left off" - restoring an unrelated stored
  // category could hide the very entry the link was pointing at.
  const urlQuery = useSearchParams().get('q');
  const storedView = urlQuery ? null : readStoredView(kind);

  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [selectedCategory, setSelectedCategory] = useState<string | null>(storedView?.category ?? null);
  const [selectedTag, setSelectedTag] = useState<string | null>(storedView?.tag ?? null);
  const initialQuery = urlQuery ?? storedView?.query ?? undefined;
  const currentQueryRef = useRef(initialQuery ?? '');
  const restoredScrollRef = useRef(false);

  const groups = useMemo(
    () => groupByCategory(state.status === 'ready' ? state.entries : []),
    [state]
  );
  // Only items has enough real categories (~92) to be worth grouping into
  // top-level sections — skills (3) and mods (13) stay flat.
  const sections = useMemo(
    () => (kind === 'item' ? groupByTaxonomy(groups, ITEM_CATEGORY_GROUPS) : null),
    [kind, groups]
  );
  const entityLabel = ENTITY_LABEL[kind];

  useEffect(() => {
    let cancelled = false;

    fetchWikiIndex(kind)
      .then((entries) => {
        if (cancelled) return;
        setState({ status: 'ready', entries });
      })
      .catch((e: unknown) => {
        if (cancelled) return;

        if (e instanceof WikiSessionExpiredError) {
          // Don't dead-end on a banner the user can't act on — this should
          // only happen if the session lapsed after /wiki itself already
          // loaded (the user got past middleware once to be here at all).
          // Same ?redirect= convention as src/proxy.ts and the /login page
          // (src/app/(auth)/login/page.tsx's `safeRedirect`).
          router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname)}`);
          return;
        }

        const message = e instanceof Error ? e.message : 'Failed to load data.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [kind, router]);

  // Restores scroll position once, after the real (non-loading) content has
  // painted - restoring while the "Loading …" placeholder is still up would
  // scroll into empty space, since the page is far shorter at that point.
  // `useLayoutEffect` (not `useEffect`) so it applies before the browser
  // paints the newly-tall list, avoiding a visible jump.
  useLayoutEffect(() => {
    if (state.status !== 'ready' || restoredScrollRef.current) return;
    restoredScrollRef.current = true;
    if (storedView && storedView.scrollY > 0) {
      window.scrollTo(0, storedView.scrollY);
    }
    // storedView is intentionally read once on mount (see the component-level
    // `readStoredView` call above), not tracked as a reactive dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status]);

  // Persists the current view on every scroll (throttled to one write per
  // animation frame) so it's always fresh by the time the user navigates
  // away - there's no reliable "about to leave" hook for this in the App
  // Router, so continuous saving is the robust option.
  useEffect(() => {
    let frame: number | null = null;
    function onScroll() {
      if (frame != null) return;
      frame = requestAnimationFrame(() => {
        frame = null;
        writeStoredView(kind, { category: selectedCategory, tag: selectedTag, query: currentQueryRef.current, scrollY: window.scrollY });
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame != null) cancelAnimationFrame(frame);
    };
  }, [kind, selectedCategory, selectedTag]);

  function handleSelectCategory(category: string | null) {
    setSelectedCategory(category);
    // A fresh filter choice reads as "start over" for scroll, same as a
    // normal category-link click would - restoring the old scroll position
    // under a newly-filtered (and likely much shorter) list would land
    // nowhere meaningful.
    writeStoredView(kind, { category, tag: selectedTag, query: currentQueryRef.current, scrollY: 0 });
  }

  function handleSelectTag(tag: string | null) {
    const next = tag === selectedTag ? null : tag; // click an active chip again to clear it
    setSelectedTag(next);
    writeStoredView(kind, { category: selectedCategory, tag: next, query: currentQueryRef.current, scrollY: 0 });
  }

  function handleQueryChange(query: string) {
    currentQueryRef.current = query;
    writeStoredView(kind, { category: selectedCategory, tag: selectedTag, query, scrollY: window.scrollY });
  }

  if (state.status === 'loading') {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        Loading {entityLabel}…
      </div>
    );
  }

  if (state.status === 'error') {
    return (
      <div className="rounded-md border border-destructive/50 bg-card px-3 py-2 text-sm text-destructive">
        Failed to load {entityLabel}: {state.message}
      </div>
    );
  }

  // If entries reload and the previously-selected category no longer
  // exists in the new set, fall back to showing all entries instead of
  // silently filtering to zero.
  const categoryStillExists = groups.some((g) => g.category === selectedCategory);
  const categoryFiltered = selectedCategory && categoryStillExists
    ? state.entries.filter((e) => e.category === selectedCategory)
    : state.entries;
  const visibleEntries = selectedTag
    ? categoryFiltered.filter((e) => e.tags.includes(selectedTag))
    : categoryFiltered;

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <CategorySidebar
        groups={groups}
        sections={sections}
        total={state.entries.length}
        selected={selectedCategory}
        onSelect={handleSelectCategory}
        kindLabel={entityLabel}
      />
      <div className="min-w-0 flex-1">
        {quickFilters && quickFilters.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5 border-b border-dashed border-border pb-3">
            <span className="mr-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">Quick filter</span>
            {quickFilters.map((f) => {
              const active = selectedTag === f.tag;
              return (
                <button
                  key={f.tag}
                  type="button"
                  onClick={() => handleSelectTag(f.tag)}
                  aria-pressed={active}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] transition-colors"
                  style={active
                    ? { borderColor: f.color, color: f.color, backgroundColor: 'color-mix(in oklab, ' + f.color + ' 14%, transparent)' }
                    : { borderColor: 'var(--border)', color: 'var(--foreground)' }}
                >
                  <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: f.color }} />
                  {f.label}
                </button>
              );
            })}
          </div>
        )}
        <WikiSearch entries={visibleEntries} basePath={basePath} initialQuery={initialQuery} onQueryChange={handleQueryChange} />
      </div>
    </div>
  );
}
