'use client';

// Two-tap destructive confirm, in place rather than a native browser dialog
// (stays on-brand — Cinzel/aged-gold — and needs no modal component). First
// tap arms it and re-labels to a confirm state; a second tap within the
// window actually resets. Auto-disarms after a few seconds so it never sits
// permanently "armed" if the user taps away without an explicit cancel.
import { useEffect, useRef, useState } from 'react';

const ARM_TIMEOUT_MS = 3500;

export default function ResetButton({ disabled, onReset }: { disabled: boolean; onReset: () => void }) {
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
