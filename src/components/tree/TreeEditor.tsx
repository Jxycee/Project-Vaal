'use client';

// /tree — build-AGNOSTIC shell.
//
// Owns only the 5.1MB tree-export fetch (public/data/tree/<version>/data.json)
// and the deferred PassiveTree chunk. Deliberately NOT keyed: keying this on
// buildId would re-run that fetch and its JSON.parse on every build switch.
// Nothing rendered here is build-derived, which is exactly what makes it safe
// to leave unkeyed — the class of stale-state bug this migration exists to
// delete cannot live in a component that holds no build state.
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type { SavedBuild } from '@/lib/build/types';
import TreeBuildSession from '@/components/tree/TreeBuildSession';

// Vendored tree export version (see public/data/tree/<version>/SOURCE.md).
const TREE_VERSION = '0.5.2';

// PassiveTree wraps @poe2-toolkit/tree-react (a pixi.js/WebGL renderer for a
// 1500+ node graph) — genuinely heavy and browser-only, so it's deferred to
// a separate chunk (ssr: false) fetched in parallel with the data fetch
// below rather than parsed as part of this page's initial bundle. The
// loading fallback matches the !raw branch below exactly so component-JS
// loading and data loading look identical to the user.
//
// Declared here, at module scope, and passed down as a prop rather than
// re-declared inside TreeBuildSession: dynamic() is memoised either way (it
// never re-downloads the chunk on remount), but keeping the module-level
// call in this unkeyed component — instead of the one that remounts per
// build — keeps it in exactly one place.
const PassiveTree = dynamic(() => import('@/components/tree/PassiveTree'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading passive tree…
    </div>
  ),
});

export default function TreeEditor({
  buildId,
  build,
  loadError,
}: {
  buildId?: string;
  build: SavedBuild | null;
  loadError: string | null;
}) {
  const [raw, setRaw] = useState<GggTreeJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/tree/${TREE_VERSION}/data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: GggTreeJson) => {
        if (!cancelled) setRaw(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // Full-bleed: breaks out of the shell's centred column, filling the area
    // between the mobile top bar / bottom nav (and right of the desktop sidebar).
    // touch-none lets tree-react own touch gestures (pinch/pan) without the
    // browser hijacking them for scroll/zoom.
    <div className="fixed inset-x-0 bottom-16 top-20 touch-none select-none md:bottom-0 md:left-60 md:top-0">
      {error ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
          Couldn&apos;t load the passive tree ({error}).
        </div>
      ) : !raw ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading passive tree…
        </div>
      ) : (
        <TreeBuildSession
          key={buildId ?? 'scratch'}
          raw={raw}
          build={build}
          loadError={loadError}
          PassiveTree={PassiveTree}
        />
      )}
    </div>
  );
}
