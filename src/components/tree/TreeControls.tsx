'use client';

// Mobile-friendly, collapsible control panel for the passive tree: class +
// ascendancy pickers and the weapon-set paint-mode toggle. Collapses to a
// single small tab so the tree gets full screen space on phones; expands
// over the canvas rather than pushing it (the canvas never resizes/reflows).
import { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import type { AllocMode } from '@poe2-toolkit/tree-core';
import ResetButton from '@/components/tree/ResetButton';

export interface PickerClass {
  id: number;
  name: string;
  ascendancies: { id: string; name: string }[];
}

export interface PointCounts {
  basic: number;
  setI: number;
  setII: number;
}

interface TreeControlsProps {
  classes: PickerClass[];
  classId: number;
  ascendancyId: string | undefined;
  mode: AllocMode;
  pointCounts: PointCounts;
  searchQuery: string;
  hasAllocations: boolean;
  onClass: (id: number) => void;
  onAscendancy: (id: string | undefined) => void;
  onMode: (mode: AllocMode) => void;
  onSearchChange: (query: string) => void;
  onReset: () => void;
}

const MODE_LABEL: Record<AllocMode, string> = { 0: 'Main', 1: 'Set I', 2: 'Set II' };
const MODE_DOT: Record<AllocMode, string> = { 0: 'bg-primary', 1: 'bg-[#e5484d]', 2: 'bg-[#46a758]' };

// Max points obtainable in one build: 99 from levelling (2-100) + 24 from
// quest rewards = 123 shared/basic points; each weapon set draws from its own,
// separate 24-point pool. Matches the reference tree's budget readout — fixed
// game constants, not derived from any save data we have.
const MAX_BASIC_POINTS = 123;
const MAX_SET_POINTS = 24;

export default function TreeControls({
  classes,
  classId,
  ascendancyId,
  mode,
  pointCounts,
  searchQuery,
  hasAllocations,
  onClass,
  onAscendancy,
  onMode,
  onSearchChange,
  onReset,
}: TreeControlsProps) {
  const [open, setOpen] = useState(true);
  const active = classes.find((c) => c.id === classId);

  return (
    <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-1.5 flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-2.5 py-1.5 text-xs font-medium text-foreground backdrop-blur transition-colors hover:border-primary/35"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {active?.name ?? 'Select class'}
      </button>

      {open && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-card/90 p-2.5 backdrop-blur">
          <div className="flex items-center gap-1.5 rounded-lg border border-input bg-background/60 px-2.5 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
            <Search size={14} className="shrink-0 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search nodes…"
              className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onClass(c.id)}
                className={
                  c.id === classId
                    ? 'rounded-full px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_var(--primary)] transition-colors'
                    : 'rounded-full px-2.5 py-1 text-xs font-medium bg-background/60 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground'
                }
              >
                {c.name}
              </button>
            ))}
          </div>

          {active && active.ascendancies.length > 0 && (
            <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
              {active.ascendancies.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onAscendancy(ascendancyId === a.id ? undefined : a.id)}
                  className={
                    ascendancyId === a.id
                      ? 'rounded-full px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_var(--primary)] transition-colors'
                      : 'rounded-full px-2.5 py-1 text-xs font-medium bg-background/60 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground'
                  }
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1.5 border-t border-border pt-2.5">
            {([0, 1, 2] as const).map((m) => {
              const [spent, max] =
                m === 0
                  ? [pointCounts.basic, MAX_BASIC_POINTS]
                  : m === 1
                    ? [pointCounts.setI, MAX_SET_POINTS]
                    : [pointCounts.setII, MAX_SET_POINTS];
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMode(m)}
                  className={
                    m === mode
                      ? 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_var(--primary)] transition-colors'
                      : 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-background/60 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground'
                  }
                >
                  <span className={`h-2 w-2 rounded-full ${MODE_DOT[m]}`} />
                  {MODE_LABEL[m]}
                  <span className="tabular-nums opacity-80">
                    {spent}/{max}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end border-t border-border pt-2.5">
            <ResetButton disabled={!hasAllocations} onReset={onReset} />
          </div>
        </div>
      )}
    </div>
  );
}
