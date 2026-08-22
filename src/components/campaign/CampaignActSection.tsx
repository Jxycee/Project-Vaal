'use client';

// One act's collapsible header + its area checklist. Collapsing is the
// primary "make it easy to scroll on mobile" lever — CampaignTracker
// defaults every act closed except whichever one the user hasn't finished.
import type { CSSProperties } from 'react';
import { Icon } from '@/components/ui/icon';
import CampaignAreaRow from './CampaignAreaRow';
import type { CampaignAct } from '@/lib/campaign/data';
import { ACT_THEME } from '@/lib/campaign/actTheme';

export default function CampaignActSection({
  act,
  checked,
  open,
  onToggleOpen,
  onToggleArea,
}: {
  act: CampaignAct;
  checked: Record<string, boolean>;
  open: boolean;
  onToggleOpen: () => void;
  onToggleArea: (id: string) => void;
}) {
  const total = act.areas.length;
  const done = act.areas.filter((a) => checked[a.id]).length;
  const cleared = total > 0 && done === total;
  const theme = ACT_THEME[act.id];

  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-card/40"
      style={{ '--act-base': theme.base, '--act': theme.accent } as CSSProperties}
    >
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-accent/25"
        style={{
          backgroundImage: 'linear-gradient(120deg, color-mix(in oklch, var(--act-base), transparent 90%), transparent 65%)',
        }}
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-lg border"
            style={{
              borderColor: 'color-mix(in oklch, var(--act), transparent 55%)',
              backgroundColor: 'color-mix(in oklch, var(--act-base), var(--card) 78%)',
            }}
          >
            <Icon name="campaign" className="size-4.5 text-[var(--act)]" />
          </span>
          <span className="min-w-0">
            <span className="block font-heading font-semibold tracking-tight">{act.name}</span>
            <span className="block text-xs italic" style={{ color: 'var(--act)' }}>
              {theme.boss}
            </span>
            <span className="text-xs text-muted-foreground">
              {done} / {total} complete
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {cleared && (
            <span
              className="rounded-full px-2 py-0.5 text-[0.65rem] font-medium tracking-wide uppercase"
              style={{
                color: 'var(--act)',
                backgroundColor: 'color-mix(in oklch, var(--act), transparent 82%)',
                border: '1px solid color-mix(in oklch, var(--act), transparent 60%)',
              }}
            >
              Cleared
            </span>
          )}
          <Icon name={open ? 'chevron-down' : 'chevron-right'} className="size-4 text-muted-foreground" />
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-2 border-t border-border p-3 sm:p-4">
          {act.areas.map((area) => (
            <CampaignAreaRow
              key={area.id}
              area={area}
              checked={!!checked[area.id]}
              onToggle={() => onToggleArea(area.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
