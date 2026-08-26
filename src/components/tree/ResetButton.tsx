'use client';

// Two-tap destructive confirm, in place rather than a native browser dialog
// (stays on-brand — Cinzel/aged-gold — and needs no modal component).
import { useArmedConfirm } from '@/lib/useArmedConfirm';

const ARM_TIMEOUT_MS = 3500;

export default function ResetButton({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
  const { armed, handleClick } = useArmedConfirm(ARM_TIMEOUT_MS, onReset);

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handleClick}
      className={
        armed
          ? 'rounded px-2 py-1 text-xs bg-destructive text-destructive-foreground'
          : 'rounded px-2 py-1 text-xs bg-background text-muted-foreground disabled:opacity-40'
      }
    >
      {armed ? 'Tap again to reset' : 'Reset'}
    </button>
  );
}
