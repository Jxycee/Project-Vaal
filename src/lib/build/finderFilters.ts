// src/lib/build/finderFilters.ts
// =============================================================================
// Parse/serialise the Public tab's filter object against `searchParams`.
//
// Server-rendered and URL-driven by design (see /builds/page.tsx): the finder
// keeps no client state of its own, so a filtered view is a shareable link
// and the Back button works. Pure module — no React, no fetch — so the
// parse/serialise round trip is unit-testable without a page.
// =============================================================================

/** The only filter keys the finder understands. Anything else in the URL is dropped. */
export interface BuildFinderFilters {
  class: string | null;
  league: string | null;
  skill: string | null;
  tag: string | null;
}

export const EMPTY_FINDER_FILTERS: BuildFinderFilters = {
  class: null,
  league: null,
  skill: null,
  tag: null,
};

// Next hands page searchParams as `string | string[] | undefined` (a repeated
// query key produces an array) — /tree's page already has to deal with the
// same shape. The finder only ever wants one value per key, so an array
// collapses to its first entry rather than being treated as "no value".
function firstString(value: string | string[] | undefined): string | null {
  const v = Array.isArray(value) ? value[0] : value;
  return typeof v === 'string' && v.length > 0 ? v : null;
}

/** `searchParams` (as Next's Server Component API hands it) -> the finder's filter object. Unknown keys are dropped. */
export function parseFinderFilters(
  searchParams: Record<string, string | string[] | undefined>,
): BuildFinderFilters {
  return {
    class: firstString(searchParams.class),
    league: firstString(searchParams.league),
    skill: firstString(searchParams.skill),
    tag: firstString(searchParams.tag),
  };
}

/** Filter object -> query string, e.g. `?class=Witch&league=Standard`. An empty filter serialises to `''` — no leading `?`. */
export function serializeFinderFilters(filters: BuildFinderFilters): string {
  const params = new URLSearchParams();
  if (filters.class) params.set('class', filters.class);
  if (filters.league) params.set('league', filters.league);
  if (filters.skill) params.set('skill', filters.skill);
  if (filters.tag) params.set('tag', filters.tag);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
