'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WikiSearch } from './WikiSearch';
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
};

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
}: {
  kind: WikiEntryKind;
  basePath: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>({ status: 'loading' });
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
