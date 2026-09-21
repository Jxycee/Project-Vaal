// src/lib/wiki/filterEntries.ts
// =============================================================================
// The wiki's fuzzy-search filter, factored out of WikiSearch.tsx so server
// code can call it too.
//
// Next's RSC bundler turns every export of a 'use client' module into a
// client reference at build time — even a plain, pure function — and throws
// "Attempted to call filterEntries() from the server but filterEntries is on
// the client" if server code tries to invoke it directly (confirmed against
// a real request to GET /api/wiki/items during verification: `npm run
// build`/`type-check` are silent about this, it only surfaces at request
// time). Moving the function itself to a plain module and having
// WikiSearch.tsx re-export it keeps `import { filterEntries } from
// './WikiSearch'` working for existing callers while giving the route a
// server-safe import — one implementation, two valid import paths, per the
// design doc's "do not write a second search implementation".
// =============================================================================

import Fuse from 'fuse.js';
import { FUZZY_SEARCH_TUNING } from '@/lib/fuseOptions';
import type { WikiSearchEntry } from './types';

export function filterEntries(
  entries: WikiSearchEntry[],
  query: string,
  fuse?: Fuse<WikiSearchEntry>,
): WikiSearchEntry[] {
  if (query.trim() === '') return entries;
  const searchEngine = fuse ?? new Fuse(entries, {
    keys: ['name', 'category', 'tags'],
    ...FUZZY_SEARCH_TUNING,
  });
  return searchEngine.search(query).map((r) => r.item);
}
