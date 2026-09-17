/**
 * Current PoE2 patch, stamped onto every save.
 *
 * Hand-bumped, mirroring TREE_VERSION and WIKI_DATA_VERSION. The
 * builds.game_version column default is '0.2.0' and is years of patches
 * stale — never rely on it, always pass this explicitly.
 */
export const GAME_VERSION = '0.5.5';

/** 8 total: 2 per trial completion, up to 4 completions. */
export const MAX_ASCENDANCY_POINTS = 8;
