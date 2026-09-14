// Instant fallback for /wiki and every nested route below it (items, skills,
// mods, effects, maps, and their [slug] detail pages) — per loading.md,
// this boundary wraps page.js "and any children below" in the same segment
// subtree, so one file here covers the whole section. The [slug] detail
// pages in particular do real async work (loadDetail + loadMentionIndex)
// with no fallback of their own today.
export default function Loading() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center text-sm text-muted-foreground">
      Loading…
    </div>
  );
}
