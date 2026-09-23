'use client';

// Shared build page's passive tree — renders a button until tapped, then
// fetches the 5.1MB tree export and mounts PassiveTree `readOnly`.
//
// The fetch must never be on this page's first paint: pobb.in-style
// static-first is the whole point of the shared view (see the Task 4 plan's
// "Read-only rendering" section, citing the competitor recon), and a third
// of that payoff is a build with a big tree costing nothing until someone
// actually asks to see it.
import { useState } from 'react';
import dynamic from 'next/dynamic';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { fromPassiveState } from '@/lib/build/passiveState';
import { TREE_VERSION } from '@/components/tree/TreeEditor';
import type { PassiveState, PassiveTreeInitialState } from '@/lib/build/types';

// Deferred to its own chunk, same reasoning as TreeEditor.tsx's module-level
// dynamic() call: pixi.js/WebGL is heavy and browser-only, and declaring this
// once at module scope (rather than inside the component body) keeps the
// import from being re-evaluated on every open/close toggle.
const PassiveTree = dynamic(() => import('@/components/tree/PassiveTree'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading passive tree…
    </div>
  ),
});

/** Unique allocated node count across both weapon sets plus ascendancy nodes — a node present in both set1 and set2 (untagged/shared) counts once. Derived straight from passive_state; no tree export needed just to show a count. */
function countAllocated(state: PassiveState): number {
  return new Set([...state.set1, ...state.set2]).size + state.ascendancyNodes.length;
}

export default function SharedTreePanel({
  className,
  ascendancyId,
  passiveState,
}: {
  className: string;
  ascendancyId: string | null;
  passiveState: PassiveState;
}) {
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState<GggTreeJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pointCount = countAllocated(passiveState);

  async function handleOpen() {
    setOpen(true);
    if (raw || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/data/tree/${TREE_VERSION}/data.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setRaw((await res.json()) as GggTreeJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card/40 text-sm font-medium text-foreground"
      >
        View passive tree ({pointCount} points allocated)
      </button>
    );
  }

  const initialState: PassiveTreeInitialState = {
    className,
    ascendancyId: ascendancyId ?? undefined,
    ...fromPassiveState(passiveState),
  };

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-lg border border-border">
      {error ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-destructive">
          Couldn&apos;t load the passive tree ({error}).
        </div>
      ) : !raw ? (
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Loading passive tree…
        </div>
      ) : (
        <PassiveTree raw={raw} initialState={initialState} readOnly />
      )}
    </div>
  );
}
