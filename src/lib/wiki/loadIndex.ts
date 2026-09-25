// src/lib/wiki/loadIndex.ts
// =============================================================================
// Server-side wiki search-index reader.
//
// Sibling to fetchIndex.ts (the client-side equivalent that fetches the same
// file over HTTP) and to load.ts's `loadDetail` (the server-side pattern this
// follows for reading wiki JSON from disk with node:fs). Kept as its own
// module rather than folded into load.ts: load.ts's `loadDetail` reads one
// entity at a time with no caching need beyond the filesystem's own page
// cache, while this reads and validates one large file per kind and must
// cache the parsed result at module scope — a different shape and a
// different lifecycle, so a separate file keeps each single-purpose and
// separately testable.
//
// This is the server-side version of the module-level promise cache the
// original spec wanted in the browser (see
// docs/superpowers/specs/2026-09-20-gear-design.md, "the one substantive
// change") — one warm instance here serves every request instead of every
// browser tab holding its own copy.
// =============================================================================

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WIKI_DATA_VERSION, isWikiSearchEntry } from './types';
import type { WikiEntryKind, WikiSearchEntry } from './types';

const ROOT = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);

export class WikiIndexLoadError extends Error {}

async function readIndex(kind: WikiEntryKind): Promise<WikiSearchEntry[]> {
  const raw = await readFile(path.join(ROOT, `${kind}-index.json`), 'utf8');
  const parsed: unknown = JSON.parse(raw);
  // Same boundary check fetchIndex.ts applies client-side: the file's shape
  // is `{ entries: [...] }`, not a bare array.
  const entries = (parsed as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries) || !entries.every(isWikiSearchEntry)) {
    throw new WikiIndexLoadError(`Malformed ${kind} index file`);
  }
  return entries;
}

/**
 * Module-level promise cache keyed by kind, single-flight: concurrent
 * callers (several gear-slot searches landing in the same moment) share one
 * in-flight read instead of each independently hitting the filesystem and
 * re-parsing a multi-thousand-entry JSON file.
 *
 * A failed read is deliberately NOT cached — deleting the entry on rejection
 * means a transient fs error doesn't wedge every future request behind a
 * permanent failure for the lifetime of the process.
 */
const cache = new Map<WikiEntryKind, Promise<WikiSearchEntry[]>>();

export function loadIndex(kind: WikiEntryKind): Promise<WikiSearchEntry[]> {
  const existing = cache.get(kind);
  if (existing) return existing;

  const pending = readIndex(kind).catch((err: unknown) => {
    cache.delete(kind);
    throw err;
  });
  cache.set(kind, pending);
  return pending;
}
