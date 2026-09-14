// Instant fallback for /campaign navigation — page.tsx awaits a Supabase
// query (campaign_progress) with no fallback of its own today, so a slow
// connection previously showed nothing at all mid-navigation.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
