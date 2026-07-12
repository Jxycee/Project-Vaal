'use client';

// /tree — passive skill tree viewer.
// Adopts @poe2-toolkit: fetches the vendored GGG tree JSON and hands the raw
// export to PassiveTree, which normalises it (tree-core) and renders it
// (tree-react). Account-gated by proxy.ts (PROTECTED_PREFIXES).
import { useEffect, useState } from 'react';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import PassiveTree from '@/components/tree/PassiveTree';

// Vendored tree export version (see public/data/tree/<version>/SOURCE.md).
const TREE_VERSION = '0.5.2';

export default function TreePage() {
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
        <PassiveTree raw={raw} />
      )}
    </div>
  );
}
