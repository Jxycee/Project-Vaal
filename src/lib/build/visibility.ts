// src/lib/build/visibility.ts
// =============================================================================
// Build visibility vocabulary — the three values `public.builds.visibility`'s
// live CHECK constraint accepts, and nothing else. The database will reject
// any other string outright (see builds/actions.ts's setBuildVisibility,
// which validates before writing rather than letting a constraint violation
// surface as a raw 500).
//
// `BuildVisibility` itself is declared in `./types` (it's used by SavedBuild)
// — this module owns the runtime vocabulary and UI copy, not the type.
// =============================================================================

import type { BuildVisibility } from './types';

/** Same three values, same order, as the live CHECK constraint on builds.visibility. */
// Ordered most restrictive first, which is also the column's default
// (`'unlisted'`) — not the CHECK constraint's declaration order, which carries
// no meaning.
export const BUILD_VISIBILITIES: readonly BuildVisibility[] = ['unlisted', 'private', 'public'];

export function isBuildVisibility(value: string): value is BuildVisibility {
  return (BUILD_VISIBILITIES as readonly string[]).includes(value);
}

/** Short label for a three-state control (select or pills). */
export const VISIBILITY_LABEL: Record<BuildVisibility, string> = {
  private: 'Private',
  unlisted: 'Unlisted',
  public: 'Public',
};

/**
 * One-line explanation shown under/beside the control.
 *
 * NOTE on the vocabulary, because it inverts the usual web convention: here
 * `unlisted` is the MOST restrictive state (owner only, share link or not) and
 * `private` is the link-shareable one. That is a deliberate product decision
 * (2026-09-23), and the database was migrated to match it — the share-token
 * RPC resolves `IN ('public','private')`, and the column defaults to
 * `'unlisted'`. Do not "correct" either side towards the YouTube/Google Docs
 * meaning of unlisted; they agree with each other as written.
 */
export const VISIBILITY_HINT: Record<BuildVisibility, string> = {
  private: 'Anyone with the link',
  unlisted: 'Only you',
  public: 'Every signed-in player, and listed in the finder',
};
