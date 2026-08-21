'use client';

import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import Link from 'next/link';
import type { WikiSearchEntry } from '@/lib/wiki/types';

export function filterEntries(
  entries: WikiSearchEntry[],
  query: string,
  fuse?: Fuse<WikiSearchEntry>,
): WikiSearchEntry[] {
  if (query.trim() === '') return entries;
  const searchEngine = fuse ?? new Fuse(entries, {
    keys: ['name', 'category', 'tags'],
    threshold: 0.4,
    ignoreLocation: true,
  });
  return searchEngine.search(query).map((r) => r.item);
}

export function WikiSearch({
  entries,
  basePath,
}: {
  entries: WikiSearchEntry[];
  basePath: string;
}) {
  const [query, setQuery] = useState('');

  // Memoize the Fuse instance — only rebuild when entries change
  const fuse = useMemo(() =>
    new Fuse(entries, {
      keys: ['name', 'category', 'tags'],
      threshold: 0.4,
      ignoreLocation: true,
    }),
    [entries]
  );

  // Compute results using the memoized Fuse instance
  const results = useMemo(() => filterEntries(entries, query, fuse), [entries, query, fuse]);

  return (
    <div className="space-y-4">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search…"
        aria-label="Search the wiki"
        className="w-full rounded-md border bg-card px-3 py-2 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
      />
      <p className="text-sm text-muted-foreground">
        {results.length} of {entries.length}
      </p>
      <ul className="divide-y divide-border">
        {results.slice(0, 100).map((entry) => (
          <li key={entry.slug}>
            <Link
              href={`${basePath}/${entry.slug}`}
              className="flex flex-col gap-0.5 py-3 hover:bg-card"
            >
              <span className="font-heading text-primary">{entry.name}</span>
              <span className="text-sm text-muted-foreground">{entry.category}</span>
            </Link>
          </li>
        ))}
      </ul>
      {results.length > 100 && (
        <p className="text-sm text-muted-foreground">
          Showing the first 100 results — refine your search to narrow them.
        </p>
      )}
    </div>
  );
}
