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

/**
 * Shape-check for a `builds.id` value. `?build=` on /tree and the `id`
 * argument to the Server Functions in `builds/actions.ts` are both UUIDs;
 * /builds/[shareToken] is a separate, 21-char nanoid and does not use this.
 * Checking shape before querying turns a junk value into our own
 * "not found" copy instead of a Postgres 22P02 (invalid input syntax for
 * type uuid) round-trip. Shared here so it is declared exactly once.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
