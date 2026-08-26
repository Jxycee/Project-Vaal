// Tracks a per-browser "recently searched" list for the wiki home page's
// strip of 4 cards. localStorage (not sessionStorage — this should persist
// across sessions, unlike WikiBrowse's view-restore) under one shared key,
// not per-kind, since the strip spans all 5 kinds at once.
import { UNUSED_OR_REMOVED_CATEGORY } from './normalize';
import { isWikiSearchEntry } from './types';
import type { WikiSearchEntry } from './types';

const STORAGE_KEY = 'wiki:recent-searches';
const MAX_ENTRIES = 4;

function readStored(): WikiSearchEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Same boundary-validation convention as fetchIndex.ts — don't trust
    // localStorage's shape across app versions/data-model changes; drop
    // anything malformed instead of letting a stale/corrupt entry crash or
    // silently misbehave downstream.
    return Array.isArray(parsed) ? parsed.filter(isWikiSearchEntry) : [];
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
  const stored = readStored().slice(0, MAX_ENTRIES);
  // A recorded entry only survives if it still exists in the live index — a
  // wiki sync can remove or rename a slug, and a stale recorded entry would
  // otherwise become a permanently dead card (its detail fetch 404s). Take
  // the live copy, not the stored one, so `name`/`category` reflect
  // whatever the current sync has rather than a possibly-stale cache.
  const recorded = stored
    .map((r) => allEntries.find((e) => sameEntry(e, r)))
    .filter((e): e is WikiSearchEntry => e !== undefined);
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
