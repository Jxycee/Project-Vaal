'use client';

// Two-tap destructive confirm, same in-place pattern as the passive tree's
// ResetButton (src/components/tree/ResetButton.tsx) — stays on-brand and
// needs no modal component.
import { useArmedConfirm } from '@/lib/useArmedConfirm';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const ARM_TIMEOUT_MS = 4000;

export default function CampaignResetButton({
  disabled,
  onReset,
}: {
  disabled: boolean;
  onReset: () => void;
}) {
  const { armed, handleClick } = useArmedConfirm(ARM_TIMEOUT_MS, onReset);

  return (
    <div className="flex items-center gap-2">
      {armed && (
        <p className="hidden items-center gap-1.5 text-xs font-medium text-destructive sm:flex">
          <Icon name="warning" className="size-3.5 shrink-0" />
          This clears every checked box.
        </p>
      )}
      <Button
        type="button"
        variant={armed ? 'destructive' : 'outline'}
        size="sm"
        disabled={disabled}
        onClick={handleClick}
        className={cn('gap-1.5 whitespace-nowrap', armed && 'border-destructive/30')}
      >
        <Icon name={armed ? 'warning' : 'refresh'} className="size-3.5" />
        {armed ? 'Tap to confirm' : 'Reset progress'}
      </Button>
    </div>
  );
}
