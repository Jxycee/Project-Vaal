'use client';

// The 5.1 MB passive-tree export (544 KB gzipped), fetched once per mount.
// useEffect runs after the first paint, so the page's text is on screen
// before this starts. BuildPage is keyed by checkpoint, so a checkpoint
// switch refetches; the browser's HTTP cache serves that repeat.
import { useEffect, useState } from 'react';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { TREE_VERSION } from '@/lib/tree/version';

export function useTreeExport(): { tree: GggTreeJson | null; error: string | null } {
  const [tree, setTree] = useState<GggTreeJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(`/data/tree/${TREE_VERSION}/data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<GggTreeJson>;
      })
      .then((json) => {
        if (!cancelled) setTree(json);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return { tree, error };
}
