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
