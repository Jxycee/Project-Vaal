// Instant fallback for /dashboard navigation. Without this, App Router shows
// nothing at all until the page's data (campaign progress, builds, last
// price sync — all fetched via Promise.all in page.tsx) resolves, so on a
// slow/flaky connection a tap looks like it did nothing. See loading.md:
// "The Fallback UI is prefetched, making navigation immediate... Shared
// layouts remain interactive while new route segments load."
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
