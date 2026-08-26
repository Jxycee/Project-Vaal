'use client';

// Two-tap destructive confirm: first tap arms it, a second tap within the
// timeout window fires `onConfirm`, and it auto-disarms if left alone so it
// never sits permanently "armed." Shared by ResetButton and
// CampaignResetButton, which only differ in markup/copy.
import { useEffect, useRef, useState } from 'react';

export function useArmedConfirm(timeoutMs: number, onConfirm: () => void) {
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
      timerRef.current = setTimeout(() => setArmed(false), timeoutMs);
      return;
    }
    if (timerRef.current) clearTimeout(timerRef.current);
    setArmed(false);
    onConfirm();
  };

  return { armed, handleClick };
}
