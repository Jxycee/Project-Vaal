# Pending migrations — NOT APPLIED

These two files are **not** in the live database. They live here, outside
`supabase/migrations/`, precisely so nobody mistakes them for applied ones:
that directory's rule is that a file there has been applied in the same
commit (see `supabase/migrations/README.md`).

They are held back on purpose, to go live **together with the merge of
`worktree-server-migration` into `main`**. The live database is also
production's, and `main` still serves `/builds` to signed-out visitors, so
applying the first one early would change production before its code does.

| File | Fixes |
|---|---|
| `20260923234918_builds_reads_require_sign_in.sql` | Signed-out users (the `anon` key, which ships in the client bundle) can read every public build, its checkpoints, tags and likes straight from PostgREST. `get_build_author_name` leaks the owner of an `unlisted` build. `anon` can call `increment_build_view_count` and inflate any public build's views. |
| `20260923235500_build_checkpoints_mirror_sync.sql` | The `builds` row's mirror of its checkpoint drifts: deleting the mirrored checkpoint leaves stale state, and the save route's two writes are not atomic. Adds `builds.active_checkpoint_id` and triggers that keep the mirror in step. |

Both were dry-run against the live database on 2026-09-23 inside a block that
always rolls back, and every check passed (backfill, insert/save/rename/delete
behaviour, last-checkpoint guard, cascade, anon sees 0 rows and is refused the
share RPC). Nothing persisted. One thing the dry run could not show: the live
database held no public builds, so "a signed-in user still sees public builds"
was not exercised with data; the policy's USING expression is unchanged.

## At merge time, in order

1. Move both files into `supabase/migrations/` (keep their names; if other
   migrations have landed since, rename to a newer UTC timestamp so they sort
   last).
2. Apply each with the Supabase MCP `apply_migration` tool, in filename order.
3. `npm run db:types` and commit `src/types/database.ts` (adds
   `builds.active_checkpoint_id`).
4. Run the Supabase security advisors and confirm nothing new.
5. Commit the moved files and the types in the same commit, then delete this
   directory.

The app code already on this branch works with or without them:
`/builds/[shareToken]` checks sign-in before calling any RPC, and nothing
reads `active_checkpoint_id` yet.
