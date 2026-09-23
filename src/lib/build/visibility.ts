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
export const BUILD_VISIBILITIES: readonly BuildVisibility[] = ['private', 'unlisted', 'public'];

export function isBuildVisibility(value: string): value is BuildVisibility {
  return (BUILD_VISIBILITIES as readonly string[]).includes(value);
}

/** Short label for a three-state control (select or pills). */
export const VISIBILITY_LABEL: Record<BuildVisibility, string> = {
  private: 'Private',
  unlisted: 'Unlisted',
  public: 'Public',
};

/** One-line explanation shown under/beside the control. */
export const VISIBILITY_HINT: Record<BuildVisibility, string> = {
  private: 'Only you',
  unlisted: 'Anyone with the link',
  public: 'Listed in the finder',
};
