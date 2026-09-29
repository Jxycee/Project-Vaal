'use client';

// The tiny (i) beside "by You" for an owner who has not set a username: their
// build shows as "Anonymous" to everyone else. A button with a tap-to-open
// popover, not a hover-only title, so it works on phones and by keyboard.
import { useEffect, useId, useRef, useState } from 'react';

export const USERNAME_HINT_TEXT = 'Set a username on the Dashboard, or stay Anonymous.';

export default function UsernameHint() {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        data-testid="username-hint"
        aria-label="About your username"
        aria-expanded={open}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen((v) => !v)}
        // 44px target without growing the line: the visible glyph is small,
        // the padding is the hit area, pulled back with negative margins.
        className="-my-3 -mx-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <span aria-hidden="true" className="text-[0.8rem] leading-none">
          ⓘ
        </span>
      </button>
      {open ? (
        <span
          id={popoverId}
          role="tooltip"
          data-testid="username-hint-popover"
          className="absolute left-0 top-full z-20 mt-2 w-56 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-popover p-2.5 text-xs leading-5 text-popover-foreground shadow-md"
        >
          {USERNAME_HINT_TEXT}
        </span>
      ) : null}
    </span>
  );
}
