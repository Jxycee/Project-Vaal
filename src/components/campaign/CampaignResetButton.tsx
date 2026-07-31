'use client';

// Two-tap destructive confirm, same in-place pattern as the passive tree's
// ResetButton (src/components/tree/ResetButton.tsx) — stays on-brand and
// needs no modal component. First tap arms it and shows the warning copy;
// a second tap within the window actually resets. Auto-disarms if left
// alone so it never sits permanently "armed."
import { useEffect, useRef, useState } from 'react';
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
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleClick = () => {
    if (!armed) {
      setArmed(true);
      timerRef.current = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setArmed(false);
    onReset();
  };

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
