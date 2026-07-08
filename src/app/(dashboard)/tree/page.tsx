'use client';

// /tree — passive skill tree viewer (Stage 1a: static render + pan/zoom).
// Client-only: fetches the vendored tree JSON, parses it, and hands the model to
// the Pixi renderer. Account-gated by proxy.ts (PROTECTED_PREFIXES).
import { useEffect, useState } from 'react';
import { parseTreeExport } from '@/lib/tree/parse';
import type { TreeModel } from '@/lib/tree/types';
import TreeCanvas from '@/components/tree/TreeCanvas';

// Vendored tree export version (see public/data/tree/<version>/SOURCE.md).
const TREE_VERSION = '0.5.2';

export default function TreePage() {
  const [model, setModel] = useState<TreeModel | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/data/tree/${TREE_VERSION}/data.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((raw: unknown) => {
        if (!cancelled) setModel(parseTreeExport(raw));
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    // Full-bleed: breaks out of the shell's centred max-w-3xl column, filling the
    // area between the mobile top bar / bottom nav (and right of the desktop sidebar).
    <div className="fixed inset-x-0 bottom-16 top-20 touch-none select-none md:bottom-0 md:left-60 md:top-0">
      {error ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
          Couldn&apos;t load the passive tree ({error}).
        </div>
      ) : !model ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading passive tree…
        </div>
      ) : (
        <TreeCanvas model={model} />
      )}
    </div>
  );
}
