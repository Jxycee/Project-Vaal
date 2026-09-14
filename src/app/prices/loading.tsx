// Instant fallback for /prices navigation — page.tsx awaits two Supabase
// queries (league discovery + price rows) server-side with no fallback of
// its own today.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
