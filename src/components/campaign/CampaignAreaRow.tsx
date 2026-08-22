'use client';

// One checkpoint: area, boss/reward source, and its reward chips, all as a
// single checkbox-role button (a <label>+<input> pair doesn't buy anything
// here and <button> can't legally contain <div>s, so every child stays a
// <span> to keep this valid phrasing content).
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import type { CampaignArea, RewardKind } from '@/lib/campaign/data';

const REWARD_STYLE: Record<RewardKind, string> = {
  'passive-point': 'border-primary/30 bg-primary/10 text-primary',
  stat: 'border-border bg-background/60 text-muted-foreground',
  utility: 'border-border bg-accent/50 text-foreground/80',
  choice: 'border-dashed border-secondary-foreground/30 bg-secondary/60 text-secondary-foreground',
  unknown: 'border-dashed border-muted-foreground/40 text-muted-foreground italic',
};

export default function CampaignAreaRow({
  area,
  checked,
  onToggle,
}: {
  area: CampaignArea;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border p-3 text-left transition-colors sm:p-3.5',
        checked
          ? 'border-primary/25 bg-primary/[0.06]'
          : 'border-border/70 bg-card/40 hover:border-primary/25 hover:bg-accent/25',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 transition-colors',
          checked ? 'border-primary bg-primary' : 'border-border bg-background',
        )}
      >
        {checked && <Icon name="check" className="size-3.5 text-primary-foreground" />}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={cn(
            'block text-sm font-medium',
            checked ? 'text-muted-foreground line-through decoration-primary/50' : 'text-foreground',
          )}
        >
          {area.area}
        </span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon name="characters" className="size-3 shrink-0" />
          <span className="truncate">{area.boss}</span>
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          {area.rewards.map((r, i) => (
            <span
              key={i}
              className={cn(
                'rounded-lg border px-2 py-1 text-[0.7rem] leading-snug font-medium',
                REWARD_STYLE[r.kind],
              )}
            >
              {r.text}
            </span>
          ))}
        </span>
      </span>
    </button>
  );
}
