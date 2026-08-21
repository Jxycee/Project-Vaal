'use client';

import { useEffect, useState } from 'react';
import { WikiSearch } from './WikiSearch';
import { fetchWikiIndex, WikiIndexFetchError } from '@/lib/wiki/fetchIndex';
import type { WikiEntryKind, WikiSearchEntry } from '@/lib/wiki/types';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; entries: WikiSearchEntry[] };

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
  entityLabel,
}: {
  kind: WikiEntryKind;
  basePath: string;
  /** Plural noun used in the loading message, e.g. "items", "skill gems". */
  entityLabel: string;
}) {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    fetchWikiIndex(kind)
      .then((entries) => {
        if (cancelled) return;
        setState({ status: 'ready', entries });
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const message = e instanceof WikiIndexFetchError || e instanceof Error
          ? e.message
          : 'Failed to load data.';
        setState({ status: 'error', message });
      });

    return () => {
      cancelled = true;
    };
  }, [kind]);

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

  return <WikiSearch entries={state.entries} basePath={basePath} />;
}
