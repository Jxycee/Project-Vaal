# Build discovery foundations (board item 21)

Decision (user): wait on true filters, but lay the foundations so filters are easy to add. **No new page, route or migration ships with this.** Nothing calls `listPublicBuilds` yet.

## What exists

- `src/lib/builds/discovery.ts` — pure. `BuildFilter`, `BuildPage` (sort + offset page), `normalizeDiscoveryRequest(unknown, unknown)`, `applyDiscoverySpec(query, spec, tagBuildIds?)`, `toDiscoveryPage`. Failure modes are the header comment; each is pinned by `discovery.test.ts`.
- `src/lib/builds/listPublicBuilds.ts` — the server function: `listPublicBuilds(filter, page)` -> `{ cards, hasMore, page, error }`. Uses the caller's cookie client (RLS applies), never the service client.

## Who can see what (unchanged vocabulary)

`public` = every signed-in user, listed. `private` = link-shareable, **not** listed. `unlisted` = owner only. Discovery returns `visibility = 'public'` only, hard-coded as the first clause and not a field of the spec, so no input can widen it. A signed-out caller gets an empty result.

## Facets (what a reader can filter and sort by)

| Facet | Column | Match | Index today |
|---|---|---|---|
| class | `builds.class` | exact | prefix of `builds_visibility_idx (visibility, class, league) WHERE visibility='public'` |
| league | `builds.league` | exact | only with class; **league alone is not index-backed** |
| ascendancy | `builds.ascendancy` | exact | none |
| main skill | `builds.main_skill` | exact | `builds_main_skill_idx (main_skill) WHERE visibility='public'` |
| level range | `builds.level` | `>=` / `<=` | none |
| tags (all-of) | `build_tags.tag` | exact, normalised | `build_tags_tag_idx (tag)`; PK `(build_id, tag)` |
| text | `builds.name` | `ilike '%q%'` | none; a leading wildcard cannot use a btree |
| sort | `updated_at`, `created_at`, `view_count`, `level`, `name`, then `id` | | none |

Deliberately **not** filterable: `visibility`, `user_id`, `share_token`, `notes`, `description`, the three jsonb state columns. Owner is a card field (via `get_public_build_authors`), not a filter.

## Indexes a later migration should add (not written, not applied)

All partial `WHERE visibility = 'public'`, matching the existing ones, because discovery only ever reads that set.

1. `(updated_at DESC, id DESC)` — the default sort and its tiebreak; today every page sorts the whole public set.
2. `(view_count DESC, id DESC)` — "popular".
3. `(created_at DESC, id DESC)` — "new".
4. `(league, class)` or a standalone `league` index — only if league-alone filtering becomes common.
5. `(ascendancy)` and `(level)` — add when measured; the public set is small now and the class/skill indexes narrow most queries first.
6. `pg_trgm` GIN on `lower(name)` — makes `%q%` search index-backed. Needs `CREATE EXTENSION pg_trgm`; skip until the public set is large.

Check with `EXPLAIN` on the live database before adding any; do not trust `supabase/schema.sql` (stale copy).

## Columns a later migration would add

- `builds.tags text[]` (denormalised from `build_tags`, GIN-indexed, public partial) — lets tag filtering be one query. Today it is two: `build_tags` -> ids -> `builds.in('id', ids)`, capped at 2000 tag rows (`TAG_ROW_LIMIT`), so a very popular tag can truncate. An RPC joining the two tables is the alternative with no new column.
- `builds.search tsvector` (generated from name, main skill, ascendancy) — proper multi-field text search; today text is name-only because multi-column search needs `.or()` string-splicing, which the module refuses to do.
- `builds.published_at timestamptz` — "newest public" should sort by when a build was published, not last edit; `updated_at` moves on every autosave.
- `builds.main_skill_id` / normalised ids — only if skill renames start breaking exact matching.
- A `pg` view or RPC returning card columns plus `display_name` — folds the separate owner-name call into the main query.

## Pagination

Offset: `page` (0-based, max 200) x `pageSize` (default 24, max 50), fetching `pageSize + 1` rows for `hasMore` with no count query. The unique `id` tiebreak keeps pages stable while data is unchanged; rows inserted between page loads can still shift offsets. Move to keyset (cursor on `(sort value, id)`) if the finder gets infinite scroll or a very deep list.

## Adding a filter later

Add the optional field to `BuildFilter` and `DiscoverySpec`, clean it in `normalizeDiscoveryRequest`, apply it in `applyDiscoverySpec` as a single-column parameterised operator (never `.or()` with interpolation), add the failure mode to the header and a test. Then wire a page to `listPublicBuilds`; `parseFinderFilters` in `build/finderFilters.ts` is the URL layer for the existing four chips and can feed it.

## Testing and why there is no E2E

`discovery.test.ts` (vitest, pure, uses a recording fake of the query builder). No `e2e/discovery-api.spec.ts`: `listPublicBuilds` is a server-only function and no existing route or page calls it; reaching it from Playwright needs either a new page or a new API route, both ruled out. The wired-up behaviour (RLS, the real PostgREST query, owner names) is therefore untested against the database until a page uses it; the first page that does should carry the E2E.
