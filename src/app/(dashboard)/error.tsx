'use client';

// The dashboard segment's error boundary. Before 2026-09-26 the app had none,
// so any uncaught error below the shell (a Server Component that threw, or a
// client error) replaced the whole page with Next's bare "Application error"
// screen. This keeps the shell — navigation still works — and offers a retry.
// Server Actions called from components go through callAction
// (src/lib/callAction.ts) and should never reach here; this is the backstop.
import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="font-heading text-lg font-semibold text-foreground">Something went wrong</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page hit an error. Unsaved editor changes are kept as a draft and will be offered back when you reopen it.
      </p>
      {error.digest ? <p className="text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => unstable_retry()}
          className="h-11 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Try again
        </button>
        <Link href="/dashboard" className="flex h-11 items-center rounded-md border border-border px-4 text-sm font-medium text-muted-foreground">
          Dashboard
        </Link>
      </div>
    </div>
  );
}
