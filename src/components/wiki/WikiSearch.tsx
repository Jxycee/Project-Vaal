'use client';

import { useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { humanizeCategory } from '@/lib/wiki/humanizeCategory';
import { attributeTagColor } from '@/lib/wiki/attributeTagColor';
import type { WikiSearchEntry } from '@/lib/wiki/types';
import type { CSSProperties } from 'react';

/** Str/Dex/Int tint for a tag chip (see attributeTagColor.ts) - `null` (default chip styling) for anything not attribute-shaped. */
function attributeTagStyle(tag: string): CSSProperties | null {
  const color = attributeTagColor(tag);
  return color ? { color, borderColor: color } : null;
}

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
  initialQuery,
  onQueryChange,
}: {
  entries: WikiSearchEntry[];
  basePath: string;
  /** Prefills the search box — set from `?q=` by a mention link that couldn't resolve to one exact entry (see MentionLinks.tsx). */
  initialQuery?: string;
  /** Called with the query on every change — lets a parent (WikiBrowse) persist it for view-state restoration without lifting the whole input into a controlled component. */
  onQueryChange?: (query: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery ?? '');

  function handleChange(value: string) {
    setQuery(value);
    onQueryChange?.(value);
  }

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
      <div className="flex items-center gap-2.5 rounded-md border border-border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-primary">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-muted-foreground">
          <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Search…"
          aria-label="Search the wiki"
          className="w-full bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        {results.length} of {entries.length}
      </p>
      {results.length === 0 && (
        <p className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          No matches — try a different search or category.
        </p>
      )}
      {results.length > 0 && (
        <ul className="rounded-lg border border-border">
          {results.slice(0, 100).map((entry, i) => (
            <li key={entry.slug}>
              <Link
                href={`${basePath}/${entry.slug}`}
                className={cn(
                  'flex items-center justify-between gap-3 border-b border-border px-4 py-2.5 transition-colors last:border-b-0 hover:bg-accent/50',
                  i % 2 === 1 && 'bg-card/40'
                )}
              >
                <div className="min-w-0">
                  <p className="truncate font-heading text-sm text-primary">{entry.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{humanizeCategory(entry.category)}</p>
                </div>
                {entry.tags.length > 0 && (
                  <div className="hidden shrink-0 gap-1.5 sm:flex">
                    {entry.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        title={humanizeCategory(tag)}
                        style={attributeTagStyle(tag) ?? undefined}
                        className="inline-block max-w-[6rem] truncate rounded border border-border px-1.5 py-0.5 text-[0.65rem] text-muted-foreground"
                      >
                        {humanizeCategory(tag)}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {results.length > 100 && (
        <p className="text-sm text-muted-foreground">
          Showing the first 100 results — refine your search to narrow them.
        </p>
      )}
    </div>
  );
}
