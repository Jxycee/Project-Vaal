'use client';

// The checkpoint chip: "Lvl 94 · Endgame ▾". Choosing one is a server
// navigation (<Link>), so the page re-reads that checkpoint's rows and
// BuildPage remounts (it is keyed by checkpoint). The current tab is kept.
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { patchQuery } from '@/lib/build/buildPage';

export default function CheckpointSwitcher({
  shareToken,
  checkpoints,
  activeCheckpointId,
  fallbackLevel,
}: {
  shareToken: string;
  checkpoints: { id: string; name: string; level: number }[];
  activeCheckpointId: string | undefined;
  /** Shown when checkpoints failed to load. */
  fallbackLevel: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const active = checkpoints.find((c) => c.id === activeCheckpointId) ?? checkpoints[0];
  const label = active ? `Lvl ${active.level} · ${active.name}` : `Lvl ${fallbackLevel}`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        data-testid="checkpoint-switcher"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-11 min-w-11 max-w-full items-center gap-1.5 rounded-full border border-border bg-card/60 px-3 text-sm font-medium text-foreground"
      >
        <span className="truncate">{label}</span>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground" />
      </button>
      {open ? (
        <div
          role="menu"
          data-testid="checkpoint-menu"
          className="absolute left-0 top-12 z-30 flex max-h-[60dvh] w-[min(18rem,calc(100vw-2rem))] flex-col overflow-y-auto rounded-lg border border-border bg-card p-1 shadow-lg"
        >
          {checkpoints.map((c) => (
            <Link
              key={c.id}
              role="menuitem"
              data-testid="checkpoint-option"
              data-checkpoint-id={c.id}
              aria-current={c.id === active?.id ? 'true' : undefined}
              href={`/builds/${shareToken}${patchQuery(searchParams.toString(), { checkpoint: c.id })}`}
              onClick={() => setOpen(false)}
              className={`flex h-11 min-w-11 items-center justify-between gap-3 rounded-md px-3 text-sm ${
                c.id === active?.id ? 'bg-accent text-foreground' : 'text-muted-foreground'
              }`}
            >
              <span className="truncate">{c.name}</span>
              <span className="shrink-0 tabular-nums">Lvl {c.level}</span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
