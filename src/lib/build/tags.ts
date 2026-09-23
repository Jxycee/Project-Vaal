// src/lib/build/tags.ts
// =============================================================================
// build_tags normalisation — pure, no React, no fetch.
//
// The PK on build_tags is (build_id, tag) and the CHECK constraint is
// length-only (1-32 chars) — Postgres has no opinion on case, so 'Minion' and
// 'minion' are two distinct rows and two distinct finder facets unless we
// normalise before it ever reaches the database.
// =============================================================================

/** Ours, not the database's — there is no row-count constraint on build_tags. */
export const MAX_TAGS_PER_BUILD = 8;

/**
 * Trim, collapse internal whitespace, lowercase, then enforce the live CHECK
 * constraint's length bounds (1-32). Returns null for anything that doesn't
 * survive — empty-after-trim, or over 32 characters.
 */
export function normalizeTag(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  const collapsed = raw.trim().replace(/\s+/g, ' ').toLowerCase();
  if (collapsed.length < 1 || collapsed.length > 32) return null;
  return collapsed;
}

/** Maps, drops nulls, dedupes, caps at MAX_TAGS_PER_BUILD. Order-preserving. */
export function normalizeTagList(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of raw) {
    const tag = normalizeTag(item);
    if (tag === null || seen.has(tag)) continue;
    seen.add(tag);
    result.push(tag);
    if (result.length >= MAX_TAGS_PER_BUILD) break;
  }
  return result;
}
