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
      <WikiSearch entries={state.entries} onSelectEntry={recordSearchedEntry} hideResultsWhenEmpty />

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
