'use client';

// Two passive-tree files, fetched separately:
//   lite  ~190 KB (~30 KB gz)  names/flags/jewel slots/class bases — everything
//                              the tabs read (stats rail, warnings, jewels).
//                              Fetched on mount, after first paint.
//   full  5.1 MB (544 KB gz)   the whole export the WebGL canvas needs. Fetched
//                              only when the Tree tab asks (requestFull).
// Each is a module-level promise: BuildPage is keyed by checkpoint, so a
// checkpoint switch remounts it, and without this every switch would re-parse
// the JSON even when the HTTP cache serves the bytes. A failed fetch clears its
// cache entry so a later mount retries; a lite failure never blocks the canvas
// and a full failure never blanks the stats rail.
import { useCallback, useEffect, useState } from 'react';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { TREE_VERSION } from '@/lib/tree/version';
import type { TreeLite } from '@/lib/tree/treeLite';

const cache = new Map<string, Promise<unknown>>();

function load<T>(file: string): Promise<T> {
  let p = cache.get(file) as Promise<T> | undefined;
  if (!p) {
    p = fetch(`/data/tree/${TREE_VERSION}/${file}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<T>;
      })
      .catch((e: unknown) => {
        cache.delete(file);
        throw e;
      });
    cache.set(file, p);
  }
  return p;
}

function useFile<T>(file: string, enabled: boolean): { data: T | null; error: string | null } {
  const [state, setState] = useState<{ data: T | null; error: string | null }>({ data: null, error: null });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    load<T>(file).then(
      (data) => {
        if (!cancelled) setState({ data, error: null });
      },
      (e: unknown) => {
        if (!cancelled) setState({ data: null, error: e instanceof Error ? e.message : String(e) });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [file, enabled]);
  return state;
}

export function useTreeData(): {
  lite: TreeLite | null;
  liteError: string | null;
  full: GggTreeJson | null;
  fullError: string | null;
  requestFull: () => void;
} {
  const lite = useFile<TreeLite>('lite.json', true);
  const [wantFull, setWantFull] = useState(false);
  const full = useFile<GggTreeJson>('data.json', wantFull);
  const requestFull = useCallback(() => setWantFull(true), []);
  return { lite: lite.data, liteError: lite.error, full: full.data, fullError: full.error, requestFull };
}
