# Migrations

## What this directory is, and what it is not

Every `.sql` file dated before 2026-09-23 is a **record of a migration that is
already applied**, not something to run. They were recovered verbatim from
`supabase_migrations.schema_migrations` on 2026-09-23 and each one's body was
verified byte-for-byte against the md5 the live database reports for it. Their
headers say RECORD ONLY. Do not replay them.

## There are no database branches

`list_branches` on project `mjxadehorflhncendqiy` returns `[]`. There is one
database, and it is the production one. **A git branch has never gated a
schema change on this project** — every migration here went live the moment it
was applied, regardless of which branch the application code sat on.

That is worth saying plainly because it is easy to assume otherwise: working on
a feature branch protects the deployed *app*, not the *database*.

## The rule, from 2026-09-23 onward

Every schema change is **both**:

1. a file in this directory, named `<UTC timestamp>_<snake_case_name>.sql`, and
2. an `apply_migration` call through the Supabase MCP tools,

in the **same commit** as the application code that needs it.

After applying, regenerate the types and commit them alongside:

```bash
npm run db:types
```

## There is no `../schema.sql` any more

It was deleted on 2026-09-23. It had been hand-maintained under a "GENERATED
FROM THE LIVE DATABASE" header while nothing generated it, so it went stale
the instant any migration ran — twice with consequences, the second time
stating the **inverse** of the privacy model.

If you want a single-file view of the live schema, generate one:

```bash
npm run db:schema
```

That writes `supabase/schema.generated.sql`, which is **gitignored on
purpose**. Committing a snapshot is a promise to keep it current, and that
promise is exactly what failed. It needs `SUPABASE_DB_URL` in `.env.local`;
the script explains how if it is missing.

To verify a database fact, use this directory, query the live project with the
Supabase MCP tools, or read `src/types/database.ts` (generated, correct).

## Visibility, because it is the thing most often got wrong

`20260828024123` introduced the three-value column with one set of meanings.
`20260923051313` **inverted two of them**. What is true now:

| Value | Meaning |
|---|---|
| `public` | every signed-in user can see it; listed in the finder; view-counted |
| `private` | the owner, **plus anyone holding the share link** |
| `unlisted` | the owner only, share link or not. **The column default.** |

Do not "correct" either side toward the YouTube/Google Docs sense of
*unlisted*. Code and database agree with each other as written. See
`docs/superpowers/CURRENT-STATE.md`.
