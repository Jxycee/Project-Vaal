# Project Vaal — Build Planner: Current State

**Last verified: 2026-09-23.** Every claim below was checked against the live database or real source on that date; the method is stated next to each. **Nothing here is repeated from another document.**

Read this before any other build-planner doc. The specs, plans and handoffs in `specs/`, `plans/` and `handoffs/` are **dated records of what was believed when they were written**, and several of them are now wrong in ways that matter. Each one that is carries a banner at its top saying so.

---

## Why this file exists

Across one long session, seven separate defects originated in documents rather than in code. Three were in documents written during that same session. The pattern was always the same: a plausible claim was written down, a later reader trusted it, and the error surfaced only when something broke.

Two of them were genuinely dangerous — a slot→category table that would have shipped one of eight classes with no selectable weapon, and a schema file that stated the **inverse** of the privacy model under a "generated from the live database" header.

**So: verify before you write, and verify before you trust.** A live-database query costs seconds. `git log -- <path>` costs seconds. Reading the failing snapshot costs seconds. Guessing costs a round trip and leaves a false claim behind for the next reader.

---

## Where the work lives

Branch `worktree-server-migration`, worktree `C:/Dev/project-vaal-wt/server-migration`. **31 commits ahead of `main`. Not merged, not pushed.**
*Verified: `git rev-parse --abbrev-ref HEAD`, `git rev-list --count main..HEAD`.*

Finish per the repo convention in memory: merge locally into `main` and push; do not open a PR.

---

## Visibility — this app's vocabulary inverts the usual web meaning

**This is the single most misunderstood thing in the codebase.** It is a deliberate product decision (2026-09-23), and the live database was migrated to match it.

| Value | Meaning |
|---|---|
| `public` | every signed-in user can see it; listed in the finder; **view-counted** |
| `private` | the owner, **plus anyone holding the share link** |
| `unlisted` | the owner only, share link or not. **The column default.** |

Do **not** "correct" either side toward the YouTube/Google Docs sense of *unlisted*. Code and database agree with each other as written.

Live database, verified by `pg_get_functiondef` and `information_schema.columns` on 2026-09-23:
- `get_build_by_share_token(p_token)` — `SECURITY DEFINER`, resolves `WHERE share_token = p_token AND visibility IN ('public','private')`
- `increment_build_view_count(p_build_id)` — `SECURITY DEFINER`, updates `WHERE id = p_build_id AND visibility = 'public'`
- `builds.visibility` default — `'unlisted'::text`
- applied migration — `swap_private_unlisted_visibility_semantics`

**A plain `select` still cannot read a `private` build**, even for a signed-in caller: the `builds` SELECT policy exposes `visibility = 'public'` only. The share-token RPC is the only path. Any personal-scope query needs `.eq('user_id', …)` and any public-scope query needs `.eq('visibility','public')`, because the owner policy is permissive and ORs in.

**Known gap, undecided:** `share_token` is minted once and never regenerated. A build that was `public` had its token readable from the finder by every signed-in user, so downgrading `public → private` does **not** revoke those people's access. Only `unlisted` revokes. Flagged to the human 2026-09-23; no decision yet.

---

## What is built

All on the branch above. Verified by reading the routes and running the suites on 2026-09-23.

- **Server-side migration.** `/tree` is a Server Component that fetches and ownership-checks the build, rendering `TreeEditor` (unkeyed, owns only the 5.1MB tree-export fetch) → `TreeBuildSession` (keyed `buildId ?? 'scratch'`, owns every piece of build-scoped state). **The keyed remount is what makes the old stale-state data-loss bugs unreachable — do not "optimise" it away.**
- **Gear (Task 2).** 17 slots, server-side item search at `GET /api/wiki/items?slot=` (authenticated; `/api/` is *not* in `PROTECTED_PREFIXES`), ~7KB per response against a 722KB raw index.
- **Jewels.** The tree's own allocated sockets, stored in `gear_state.jewels` keyed by socket node id. Deallocating a socket keeps its jewel, shown as "unsocketed".
- **Gems (Task 3).** Skill + up to 5 supports per loadout, weapon-set tags, `main_skill`. The same picker and the same route serve gear, jewels and gems via a kind dimension.
- **Sharing (Task 4).** `/builds/[shareToken]`, three-way visibility, tags, a public finder. **All of `/builds` is auth-protected** — a signed-out visitor is redirected to `/login`, never shown a build.
- **Drafts** carry tree + gear + gems, keyed `vaal:tree-draft:<buildId ?? 'scratch'>`, read in a lazy `useState` initialiser.

`PROTECTED_PREFIXES` is `['/dashboard', '/characters', '/settings', '/tree', '/campaign', '/wiki', '/data/wiki/', '/builds']`.
*Verified: `src/proxy.ts:46`.*

## What is not built

Deliberate deferrals, each recorded with its reason in the relevant spec: two-handed weapon occupancy (enforced for no weapon), rune sockets, item mods/affixes/rolls, gem level and quality, a stat engine of any kind, import/export, leveling stages, and authored guidance. `toggleBuildBookmark` exists as a Server Function with no caller.

The competitor gap analysis — what a build can express here versus elsewhere — is in `specs/2026-09-23-competitor-build-flow-gaps.md`. Recorded, not acted on.

---

## Test state

| | |
|---|---|
| Unit (vitest, `node` env, no DOM harness) | **449 tests / 33 files** |
| E2E (Playwright, mobile + desktop) | **20 / 20** |
| type-check, lint, build | clean |

*Verified: `npm test`, `npx playwright test`, `npm run type-check`, `npm run lint` on 2026-09-23.*

Specs: `build-persistence` (the protected data-loss scenarios), `draft-and-auth`, `loadout-persistence`, `sharing`, `mobile-layout`, `desktop-layout`. The desktop project is scoped to `desktop-layout` alone.

### Three ways a test here has passed while broken

Each of these actually happened on this branch. Check for them when writing a new spec.

1. **`expect(list).toEqual([])` over a `querySelectorAll`** is green whenever the selector matches nothing. Assert how many elements you scanned, not just what failed.
2. **Asserting a slot reads "Empty" after a reload** is equally true of a build that never saved at all. Pair every negative with something that must come back populated.
3. **The state a test runs in is part of the test.** The tap-target scan of `/builds` only ever saw the *empty* page, because cleanup leaves the account with zero builds — so a 24px build-name link, the page's primary action, survived every green run. It surfaced only because a manually created build happened to be sitting in the account.

---

## Environment traps, all of which have cost real time

- **`npm install` silently reverts the `@poe2-toolkit` patches.** npm's allow-scripts gate blocks `patch-package`'s `postinstall`, and type-check then fails in files you never touched (`graphId`, `nodeOverrides`, `worldLabels`). Recover with `npx patch-package`.
- **`prettier` has no config here** and rewrites whole files to double quotes against house style.
- **Check ports 3100-3110 at the START of any browser task, not just the end.** A dev server left by an earlier agent — or by yourself — serves different code with nothing to warn you. This has produced false results three times.
- **`next dev` needs `--webpack` in this worktree** because `node_modules` is a directory junction, which Turbopack rejects.
- **A `goto` to the URL the page is already on** can be elided by Chromium as `net::ERR_ABORTED`. `gotoBuilds` reloads instead.

---

## Documents that are wrong, and what is true instead

None of these have been deleted — they are the record of how the work happened. Each now carries a banner. Listed here so a reader who greps before reading finds the correction.

| Document | What it gets wrong |
|---|---|
| `specs/2026-09-16-build-planner-design.md` | Visibility semantics (pre-swap), `get_build_by_share_token`'s filter, the column default, `Focii` "0 entries", and the claim that `'Spirit Gem'` identifies Spirit-reserving gems |
| `plans/2026-09-22-task4-sharing.md` | Its body is pre-swap throughout; only its top amendment is current |
| `handoffs/2026-09-18-server-side-migration-kickoff.md` | The RPC filter and the column default; its work is complete |
| `plans/2026-09-16-build-planner-task1-persistence.md` | The column default |
| `supabase/schema.sql` | Patched 2026-09-23 for the visibility migration; everything else still dates from the 2026-09-18 generation, so treat it as a convenience copy, never an authority |

`plans/2026-07-12-pwa-serwist.md` also matches a grep for "unlisted" — that is an unrelated npm dependency, not a visibility claim. Checked, not stale.
