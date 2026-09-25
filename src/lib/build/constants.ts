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
 * Cap on `builds.notes` length. The column itself has no CHECK constraint
 * (verified via information_schema.columns, see CURRENT-STATE.md) — this is
 * an application-level sanity bound, not a data-backed one, picked as
 * "several paragraphs of build reasoning" without being large enough to make
 * a build row unreasonably big. Shared between POST /api/builds (server
 * validation) and BuildSavePanel (client-side counter/truncation) so the two
 * never disagree about the limit.
 */
export const MAX_NOTES_LENGTH = 4000;

/**
 * Shape-check for a `builds.id` value. `?build=` on /tree and the `id`
 * argument to the Server Functions in `builds/actions.ts` are both UUIDs;
 * /builds/[shareToken] is a separate, 21-char nanoid and does not use this.
 * Checking shape before querying turns a junk value into our own
 * "not found" copy instead of a Postgres 22P02 (invalid input syntax for
 * type uuid) round-trip. Shared here so it is declared exactly once.
 */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shape-check for a `builds.share_token` value — `/builds/[shareToken]`'s
 * counterpart to `UUID_RE`. `share_token` is minted exactly once, in the
 * insert path of `POST /api/builds`, as `nanoid()` (nanoid@5.1.11): default
 * size 21, alphabet `A-Za-z0-9_-`. Same reasoning as UUID_RE — reject junk
 * before it reaches a query so it becomes our own "not found" copy instead of
 * a pointless round-trip.
 */
export const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{21}$/;
