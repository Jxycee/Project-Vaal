// Instant fallback for /tree navigation, covering the gap between tapping
// the nav link and the page itself mounting (at which point it shows its
// own "Loading passive tree…" state while fetching the tree data client-side —
// text matched here so the two loading states read as one continuous state,
// not a flash of different copy).
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading passive tree…
    </div>
  );
}
