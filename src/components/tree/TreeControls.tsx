'use client';

// Mobile-friendly, collapsible control panel for the passive tree: class +
// ascendancy pickers and the weapon-set paint-mode toggle. Collapses to a
// single small tab so the tree gets full screen space on phones; expands
// over the canvas rather than pushing it (the canvas never resizes/reflows).
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { AllocMode } from '@poe2-toolkit/tree-core';

export interface PickerClass {
  id: number;
  name: string;
  ascendancies: { id: string; name: string }[];
}

interface TreeControlsProps {
  classes: PickerClass[];
  classId: number;
  ascendancyId: string | undefined;
  mode: AllocMode;
  onClass: (id: number) => void;
  onAscendancy: (id: string | undefined) => void;
  onMode: (mode: AllocMode) => void;
}

const MODE_LABEL: Record<AllocMode, string> = { 0: 'Main', 1: 'Set I', 2: 'Set II' };
const MODE_DOT: Record<AllocMode, string> = { 0: 'bg-primary', 1: 'bg-[#e5484d]', 2: 'bg-[#46a758]' };

export default function TreeControls({
  classes,
  classId,
  ascendancyId,
  mode,
  onClass,
  onAscendancy,
  onMode,
}: TreeControlsProps) {
  const [open, setOpen] = useState(true);
  const active = classes.find((c) => c.id === classId);

  return (
    <div className="absolute left-3 top-3 z-10 max-w-[calc(100%-1.5rem)]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mb-1 flex items-center gap-1 rounded bg-card/90 px-2 py-1 text-xs text-muted-foreground backdrop-blur"
      >
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        {active?.name ?? 'Select class'}
      </button>

      {open && (
        <div className="flex flex-col gap-2 rounded-lg bg-card/90 p-2 backdrop-blur">
          <div className="flex flex-wrap gap-1">
            {classes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onClass(c.id)}
                className={
                  c.id === classId
                    ? 'rounded px-2 py-1 text-xs bg-primary text-primary-foreground'
                    : 'rounded px-2 py-1 text-xs bg-background text-muted-foreground'
                }
              >
                {c.name}
              </button>
            ))}
          </div>

          {active && active.ascendancies.length > 0 && (
            <div className="flex flex-wrap gap-1 border-t border-border pt-2">
              {active.ascendancies.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => onAscendancy(ascendancyId === a.id ? undefined : a.id)}
                  className={
                    ascendancyId === a.id
                      ? 'rounded px-2 py-1 text-xs bg-primary text-primary-foreground'
                      : 'rounded px-2 py-1 text-xs bg-background text-muted-foreground'
                  }
                >
                  {a.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-1 border-t border-border pt-2">
            {([0, 1, 2] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onMode(m)}
                className={
                  m === mode
                    ? 'flex items-center gap-1.5 rounded px-2 py-1 text-xs bg-primary text-primary-foreground'
                    : 'flex items-center gap-1.5 rounded px-2 py-1 text-xs bg-background text-muted-foreground'
                }
              >
                <span className={`h-2 w-2 rounded-full ${MODE_DOT[m]}`} />
                {MODE_LABEL[m]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
