'use client';

// TEST-GRADE (Slice 5, plans/2026-09-25-slice5-defence-engine.md): the shared
// build's defence sheet for the checkpoint being viewed. Behind a tap, like
// SharedTreePanel, because the engine needs the 5.1MB tree export (node names,
// attribute flags, class base attributes) and this page must not fetch it on
// first paint. The browser caches that file, so opening the tree afterwards
// costs nothing extra. Plain markup until the UI pass.

import { useState } from 'react';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import StatsSheet from '@/components/build/StatsSheet';
import { useDefenceSheets } from '@/components/build/useDefenceSheets';
import { useReservedSpirit } from '@/components/build/useReservedSpirit';
import type { GearState } from '@/lib/build/gearState';
import type { GemState } from '@/lib/build/gemState';
import type { PassiveState } from '@/lib/build/types';
import { TREE_VERSION } from '@/lib/tree/version';

export default function SharedStatsPanel({
  className,
  level,
  passiveState,
  gear,
  gemState,
}: {
  className: string;
  level: number;
  passiveState: PassiveState;
  gear: GearState;
  gemState: GemState;
}) {
  const [open, setOpen] = useState(false);
  const [tree, setTree] = useState<GggTreeJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheets = useDefenceSheets({ tree, className, level, passive: passiveState, gear });
  const reserved = useReservedSpirit(gemState);

  async function handleOpen() {
    setOpen(true);
    if (tree) return;
    try {
      const res = await fetch(`/data/tree/${TREE_VERSION}/data.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setTree((await res.json()) as GggTreeJson);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-11 w-full items-center justify-center rounded-lg border border-border bg-card/40 text-sm font-medium text-foreground"
      >
        View stats
      </button>
      <StatsSheet open={open} sheets={error ? { error } : sheets} reserved={reserved} onClose={() => setOpen(false)} />
    </>
  );
}
