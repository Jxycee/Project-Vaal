'use client';

// Mobile-friendly, collapsible control panel for the passive tree: class +
// ascendancy pickers and the weapon-set paint-mode toggle. Collapses to a
// single small tab so the tree gets full screen space on phones; expands
// over the canvas rather than pushing it (the canvas never resizes/reflows).
import { useState } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import type { AllocMode } from '@poe2-toolkit/tree-core';
import { MAX_ASCENDANCY_POINTS, MAX_WEAPON_SET_POINTS } from '@/lib/build/constants';
import { WEAPON_SET_DOT } from '@/lib/build/weaponSetColors';
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
  ascendancy: number;
}

interface TreeControlsProps {
  classes: PickerClass[];
  classId: number;
  ascendancyId: string | undefined;
  mode: AllocMode;
  pointCounts: PointCounts;
  /**
   * The basic/shared-pool budget, derived from the build's level (see
   * `derivePassiveBudget`, `src/lib/build/passiveBudget.ts`) — replaces the
   * old hardcoded MAX_BASIC_POINTS=123. Passed in rather than computed here
   * so this component stays free of the level itself.
   */
  maxBasicPoints: number;
  /** Each weapon set's point cap: MAX_WEAPON_SET_POINTS, raised by Weapon Master (see pointCaps.ts). */
  maxWeaponSetPoints?: number;
  searchQuery: string;
  hasAllocations: boolean;
  onClass: (id: number) => void;
  onAscendancy: (id: string | undefined) => void;
  onMode: (mode: AllocMode) => void;
  onSearchChange: (query: string) => void;
  onReset: () => void;
  /**
   * Shared build page: hides the class picker, ascendancy picker, paint-mode
   * toggle and ResetButton — all editing affordances. The point counters and
   * search field stay: they're read affordances (see PassiveTree's readOnly
   * doc comment), and the collapsed-chip behaviour is a mobile space
   * decision, not an editing one, so it's unaffected.
   */
  readOnly?: boolean;
}

const MODE_LABEL: Record<AllocMode, string> = { 0: 'Main', 1: 'Set I', 2: 'Set II' };
// Mode 0 (shared/basic) has no weapon set — it keeps the primary colour
// rather than one of the two set colours from weaponSetColors.ts.
const MODE_DOT: Record<AllocMode, string> = { 0: 'bg-primary', 1: WEAPON_SET_DOT[1], 2: WEAPON_SET_DOT[2] };

// Each weapon set draws from its own, separate MAX_WEAPON_SET_POINTS pool — a
// fixed game constant, not derived from level the way the basic/shared pool
// now is (see `maxBasicPoints` prop / `derivePassiveBudget`).

export default function TreeControls({
  classes,
  classId,
  ascendancyId,
  mode,
  pointCounts,
  maxBasicPoints,
  maxWeaponSetPoints = MAX_WEAPON_SET_POINTS,
  searchQuery,
  hasAllocations,
  onClass,
  onAscendancy,
  onMode,
  onSearchChange,
  onReset,
  readOnly,
}: TreeControlsProps) {
  // Collapsed by default. On a phone the canvas IS the interface and drag
  // surface is scarce: expanded, this panel covers roughly half a 375px screen
  // and extends underneath BuildSavePanel's chip in the opposite corner (caught
  // by e2e/mobile-layout.spec.ts, which asserts the resting overlays never
  // intersect). The chip still shows the active class, so nothing is hidden —
  // only folded away until asked for.
  const [open, setOpen] = useState(false);
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

          {!readOnly && (
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
          )}

          {!readOnly && active && active.ascendancies.length > 0 && (
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

          {/* Point counters — a read affordance, kept in readOnly mode. Only
              the paint-mode SWITCH is an editing action; the counts
              themselves are informational, so readOnly renders them as
              plain (non-interactive) chips rather than buttons. */}
          <div className="flex flex-wrap gap-1.5 border-t border-border pt-2.5">
            {([0, 1, 2] as const).map((m) => {
              const [spent, max] =
                m === 0
                  ? [pointCounts.basic, maxBasicPoints]
                  : m === 1
                    ? [pointCounts.setI, maxWeaponSetPoints]
                    : [pointCounts.setII, maxWeaponSetPoints];
              // Only the basic/shared pool is level-derived, so only it can
              // be "over budget" in the sense this feature means. (A weapon
              // set's pool is fixed by the game; tree-core does NOT refuse a
              // point past it, contrary to what this comment used to say —
              // checked 2026-09-26 — and the structural validator warns
              // instead.) SIGNAL only, per
              // brief: this never disables the button or blocks a click —
              // planning a level-90 build while the build row still says
              // level 1 is a normal workflow, not an error state.
              const overBudget = m === 0 && spent > max;
              const content = (
                <>
                  <span className={`h-2 w-2 rounded-full ${MODE_DOT[m]}`} />
                  {MODE_LABEL[m]}
                  <span className="tabular-nums opacity-80">
                    {spent}/{max}
                  </span>
                  {overBudget ? (
                    <span
                      className="rounded-full bg-destructive px-1.5 py-0.5 text-[10px] font-semibold text-destructive-foreground"
                      title={`${spent} points allocated, but this build's level only grants ${max}.`}
                    >
                      Over
                    </span>
                  ) : null}
                </>
              );
              if (readOnly) {
                return (
                  <div
                    key={m}
                    className={
                      overBudget
                        ? 'flex items-center gap-1.5 rounded-full border border-destructive/60 px-2.5 py-1 text-xs font-medium bg-background/60 text-muted-foreground'
                        : m === mode
                          ? 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground'
                          : 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-background/60 text-muted-foreground'
                    }
                  >
                    {content}
                  </div>
                );
              }
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onMode(m)}
                  className={
                    overBudget
                      ? 'flex items-center gap-1.5 rounded-full border border-destructive/60 px-2.5 py-1 text-xs font-medium bg-background/60 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground'
                      : m === mode
                        ? 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_var(--primary)] transition-colors'
                        : 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-background/60 text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground'
                  }
                >
                  {content}
                </button>
              );
            })}
            <div
              className={
                pointCounts.ascendancy >= MAX_ASCENDANCY_POINTS
                  ? 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground shadow-[0_6px_16px_-8px_var(--primary)]'
                  : 'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-background/60 text-muted-foreground'
              }
            >
              <span>Asc</span>
              <span className="tabular-nums opacity-80">
                {pointCounts.ascendancy}/{MAX_ASCENDANCY_POINTS}
              </span>
            </div>
          </div>

          {!readOnly && (
            <div className="flex justify-end border-t border-border pt-2.5">
              <ResetButton disabled={!hasAllocations} onReset={onReset} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
