// Shared fuzzy-search tuning for every Fuse.js instance in the app (wiki
// search, price browse) — kept in one place so the two search experiences'
// fuzziness can't silently drift apart if one call site is tuned and the
// other forgotten.
export const FUZZY_SEARCH_TUNING = {
  threshold: 0.4,
  ignoreLocation: true,
} as const;
