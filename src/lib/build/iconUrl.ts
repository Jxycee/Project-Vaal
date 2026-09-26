// src/lib/build/iconUrl.ts
// =============================================================================
// The two item fields that leave our own code as a URL: `iconUrl` becomes an
// <img src> for every viewer of a shared build, and `slug` becomes part of a
// fetch path (/data/wiki/<v>/items/<slug>.json) in every viewer's browser.
//
// Shared by the write gate (stateInput.ts, which REFUSES a bad value) and the
// readers (gearState.ts, gemState.ts, which DEFUSE one). The readers need it
// too: a row can reach the database without passing the gate — a direct
// PostgREST write, or a row written before the gate existed — and the
// database's own guard (supabase/migrations/20260926141500_build_write_guard)
// is a second copy of these same two patterns. Keep the three in step.
// =============================================================================

/**
 * The only icon URLs our client stores: same-origin wiki icons, as written by
 * scripts/sync-wiki.ts (`/data/wiki/<version>/icons/<kind>s/<slug>.png`), plus
 * the older flat `/data/wiki/<version>/icons/<slug>.png` layout that saved
 * builds may still carry. A literal pattern, not a prefix check, so `..`,
 * `//host` and query strings cannot ride along.
 */
const ICON_URL_RE = /^\/data\/wiki\/\d{4}-\d{2}-\d{2}\/icons\/(?:[a-z]+\/)?[a-z0-9-]+\.png$/;

/** Item and skill slugs as the sync writes them (all 6,112 on disk match, checked 2026-09-26). */
export const ITEM_SLUG_RE = /^[a-z0-9-]{1,120}$/;

export function isAllowedIconUrl(value: string): boolean {
  return ICON_URL_RE.test(value);
}

export function isSafeItemSlug(value: string): boolean {
  return ITEM_SLUG_RE.test(value);
}
