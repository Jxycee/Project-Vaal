'use client';

// One act's collapsible header + its area checklist. Collapsing is the
// primary "make it easy to scroll on mobile" lever — CampaignTracker
// defaults every act closed except whichever one the user hasn't finished.
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import CampaignAreaRow from './CampaignAreaRow';
import type { CampaignAct } from '@/lib/campaign/data';

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

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card/40">
      <button
        type="button"
        onClick={onToggleOpen}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-accent/25"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-lg border',
              cleared ? 'border-primary/40 bg-primary/15' : 'border-primary/20 bg-primary/10',
            )}
          >
            <Icon name="campaign" className="size-4.5 text-primary" />
          </span>
          <span className="min-w-0">
            <span className="block font-heading font-semibold tracking-tight">{act.name}</span>
            <span className="text-xs text-muted-foreground">
              {done} / {total} complete
            </span>
          </span>
        </span>

        <span className="flex shrink-0 items-center gap-2">
          {cleared && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[0.65rem] font-medium tracking-wide text-primary uppercase">
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
