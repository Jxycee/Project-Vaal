# Project Vaal — Build Planner: Current State

**Last verified: 2026-09-23 (updated same day after the gem-level / notes / level-budget work).** Every claim below was checked against the live database or real source on that date; the method is stated next to each. **Nothing here is repeated from another document.**

Read this before any other build-planner doc. The specs, plans and handoffs in `specs/`, `plans/` and `handoffs/` are **dated records of what was believed when they were written**, and several of them are now wrong in ways that matter. Each one that is carries a banner at its top saying so.

---

## Why this file exists

Across one long session, seven separate defects originated in documents rather than in code. Three were in documents written during that same session. The pattern was always the same: a plausible claim was written down, a later reader trusted it, and the error surfaced only when something broke.

Two of them were genuinely dangerous — a slot→category table that would have shipped one of eight classes with no selectable weapon, and a schema file that stated the **inverse** of the privacy model under a "generated from the live database" header.

**So: verify before you write, and verify before you trust.** A live-database query costs seconds. `git log -- <path>` costs seconds. Reading the failing snapshot costs seconds. Guessing costs a round trip and leaves a false claim behind for the next reader.

---

## Where the work lives

**Everything through Slice 1 is on `main` and in production** (merged 2026-09-24, merge commit `dc0b7bc2e1`). Slice 2, the PoB2 importer, followed on 2026-09-24. Branch `worktree-server-migration` (worktree `C:/Dev/project-vaal-wt/server-migration`) carries on for Slices 3–5.

Finish per the repo convention in memory: merge locally into `main` and push; do not open a PR. Every push to `main` deploys straight to production, so confirm with the user first.

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

**Decided 2026-09-23, accepted as-is:** `share_token` is minted once and never regenerated, so downgrading `public → private` does **not** revoke access for anyone who already read the token off the public finder. Only `unlisted` revokes. The user's reasoning: `private` is not a privacy control, it is "I don't want this publicised" — a work in progress, or a mess-around build to show friends. Someone who wants a build genuinely unseen uses `unlisted`, which revokes immediately and server-side.

Expected usage, per the user: **`unlisted` and `public` will be the two common choices**; `private` is the niche middle. Worth remembering when weighing UI prominence — do not build the visibility control around `private` as the default mental model.

---

## What is built

All on the branch above. Verified by reading the routes and running the suites on 2026-09-23.

- **Server-side migration.** `/tree` is a Server Component that fetches and ownership-checks the build, rendering `TreeEditor` (unkeyed, owns only the 5.1MB tree-export fetch) → `TreeBuildSession` (keyed `buildId ?? 'scratch'`, owns every piece of build-scoped state). **The keyed remount is what makes the old stale-state data-loss bugs unreachable — do not "optimise" it away.**
- **Gear (Task 2).** 17 slots, server-side item search at `GET /api/wiki/items?slot=` (authenticated; `/api/` is *not* in `PROTECTED_PREFIXES`), ~7KB per response against a 722KB raw index.
- **Jewels.** The tree's own allocated sockets, stored in `gear_state.jewels` keyed by socket node id. Deallocating a socket keeps its jewel, shown as "unsocketed".
- **Gems (Task 3).** Skill + up to 5 supports per loadout, weapon-set tags, `main_skill`. The same picker and the same route serve gear, jewels and gems via a kind dimension.
- **Sharing (Task 4).** `/builds/[shareToken]`, three-way visibility, tags, a public finder. **All of `/builds` is auth-protected** — a signed-out visitor is redirected to `/login`, never shown a build.
- **Drafts** carry tree + gear + gems, keyed `vaal:tree-draft:<buildId ?? 'scratch'>`, read in a lazy `useState` initialiser.
- **Gem level and quality** (competitor gap #4) — on **skills only**. Supports get neither field, deliberately: every sampled Support Gem caps at level 1 in our data, and nothing in our dataset carries gem quality at all. The level cap is **per gem**, read live from that gem's own `scaling[]` via `src/lib/wiki/fetchGemScaling.ts`, not hardcoded — active skills reach 40, some Spirit gems cap lower. The 0–20 quality bound is an **assumption, not data-backed**, and is marked as such in the code. Old gem states migrate silently to `level: 1, quality: 0`.
- **Build notes** (competitor gap #7) — persisted to the pre-existing `builds.notes` column (no migration was needed), edited in `BuildSavePanel`, shown on the shared build page.
- **Level-derived passive budget** (competitor gap #8) — `derivePassiveBudget(level)` = `(level - 1) + QUEST_PASSIVE_POINTS`, which reconciles with the previously hardcoded 123 at level 100. Over-budget is **signalled, never blocked**: planning a level-90 build while at level 1 is a normal workflow. The shared-page tree defaults `level` to 100 when absent so a reader never sees a spurious "Over" flag.
- **Leveling checkpoints** (competitor gap #5, Slice 1 of `plans/2026-09-23-convergence-integration.md`) — a build is an ordered list of named, leveled stages in `public.build_checkpoints`, each with its own tree, gear and gems. `/tree` edits the one chosen by `?checkpoint=` (default: position 0); switching is a server navigation, never client state, and `TreeBuildSession` is keyed by build **and** checkpoint. Drafts are keyed per checkpoint. A save writes the checkpoint first, then mirrors it onto the `builds` row (which the finder and lists still read). Add (a copy of the editor, unsaved edits included), rename, reorder and delete go through `src/app/(dashboard)/builds/checkpointActions.ts`. The database guarantees every build has at least one checkpoint: an `AFTER INSERT` trigger creates checkpoint 0, and a `BEFORE DELETE` trigger refuses to remove the last. Shared links render each stage through `get_build_checkpoints_by_share_token`. **The UI for all of this is test-grade** — `CheckpointsSheet` and a plain link picker on the shared page — pending the UI session. The mirror is kept by database triggers since `20260923235500_build_checkpoints_mirror_sync` (applied 2026-09-24): a checkpoint save updates the `builds` row in the same statement, deleting the mirrored checkpoint re-points it at the highest-position survivor, and `builds.active_checkpoint_id` names which checkpoint it mirrors. *Verified:* `e2e/checkpoints.spec.ts` drives add, divergent trees across a full reload, reorder, share-link rendering of two different stages, and the last-checkpoint refusal against the live database; each migration was also verified under the `authenticated` role with RLS in force, rolled back.

`PROTECTED_PREFIXES` is `['/dashboard', '/characters', '/settings', '/tree', '/campaign', '/wiki', '/data/wiki/', '/builds']`.
*Verified: `src/proxy.ts:46`.*

## What is not built
- **Path of Building 2 import** (Slice 2, `plans/2026-09-24-slice2-pob-import.md`; merged to `main` 2026-09-24). `/builds` → "Import from PoB" takes a PoB2 code, or a pobb.in / Maxroll / poe.ninja / poe2db.tw link fetched server-side through an exact-host allowlist (`src/lib/pob/source.ts`). It previews a report of what was kept, dropped and inferred, then creates a new owner-only build with one checkpoint per PoB spec, all written in one `import_build` call (`20260925010117`, **already applied to the live database**; unused by `main`'s code). Gems join on GGG id. Items join on base name, and their mods, runes, quality and variants are reported, not kept. Jewels come from the spec PoB was showing. The build row mirrors the last checkpoint. **The UI is test-grade.** *Verified:* `e2e/pob-import.spec.ts` against the live database (35 and 116 nodes seeded for the first and last checkpoints); full suite 69 passed.

Deliberate deferrals, each recorded with its reason in the relevant spec: two-handed weapon occupancy (**not enforced for any weapon — but the data for it exists, see "The data we already hold"**), rune sockets, item mods/affixes/rolls, a stat engine of any kind, import/export, and structured stat priorities.

The campaign resistance penalty is explicitly **not** implemented — it needs formulas we have not confirmed and belongs with the stat-engine work. Bookmarks have no UI: `toggleBuildBookmark` was **deleted** on 2026-09-23 because nothing called it while a Server Function stays reachable by direct POST. The `build_bookmarks` table and its two policies are untouched, so wiring a UI later needs no migration — see the note left at the foot of `src/app/(dashboard)/builds/actions.ts`.

**Signed-out clients cannot read builds from the database** (since `20260923234918_builds_reads_require_sign_in`, applied 2026-09-24 right after the Slice 1 deploy went live). The four "readable" SELECT policies on `builds`, `build_checkpoints`, `build_tags` and `build_likes` are `TO authenticated`, and `anon` holds no EXECUTE on `get_build_by_share_token`, `get_build_author_name` or `increment_build_view_count`. Verified live after applying. The remaining security-advisor warnings are the deliberate signed-in RPCs plus a pre-existing `handle_new_user` anon-EXECUTE warning (a trigger function; untouched here).

**Formulas are not a blocker.** `docs/research/poe2/stat-formula-feasibility.md` establishes that PoB2 is MIT-licensed and implements the defensive calculations in `CalcDefence.lua`, separate from the far larger offence/DPS modules. Crucially, our affix data is **already typed** — 5,267 files under `public/data/wiki/2026-08-25/mods/` carrying `rolls: [{stat, min, max}]` with tiers and spawn weights — so PoB's hardest problem, its 677KB text-parsing `ModParser.lua`, is one we do not have.

The competitor gap analysis — what a build can express here versus elsewhere — is in `specs/2026-09-23-competitor-build-flow-gaps.md`. Recorded, not acted on.

---

## The data we already hold

**Verified on disk 2026-09-23.** This section exists because the controller twice described our own data as thinner than it is, and planned work around that mistake. Check here before concluding we are missing something.

| Dataset | Location | Size | What each record carries |
|---|---|---|---|
| Item details | `public/data/wiki/2026-08-25/items/<slug>.json` | **4,994** | `rarity, itemClass, twoHanded, requirements{str,dex,int}, armour{armour,evasion,energyShield,ward,block}, weapon{damageMin,damageMax,critical,attackTime,rangeMax,reloadTime}, spirit, dropLevel, tags[], implicitMods[], uniqueMods, soulCoreEffects, iconUrl` |
| Mods / affixes | `.../mods/<slug>.json` | **5,267** | `category (Prefix/Suffix), domain, generationType, group, tier, level, stats[] (display), rolls[{stat,min,max}] (TYPED, GGG-style ids), families[], spawnWeights[{tag,weight}]` |
| Skills / gems | `.../skills/<slug>.json` + index | **1,118** | `category, gemType, color, tags[], requirement{str,dex,int,level}, scaling[] per level `{level, cost, castTime, cooldown, reservation, stats[{text,min,max}]}`, iconUrl` |
| Passive tree | `public/data/tree/0.5.2/data.json` | 5.1MB | `classes, groups, nodes, edges, jewelSlots`; nodes carry `stats[], connections[], isJewelSocket, ascendancyName, orbit/x/y` |
| Icons | `.../icons/` | — | item and skill PNGs, served locally under the auth-gated `/data/wiki/` prefix |

### Three consequences that were previously got wrong

1. **Our gear is NOT "base-item-only" as a data limitation.** That is true of what a *build stores* today, not of what we *have*. Base defences, requirements, weapon damage and implicit mods are all present per item. The affix work (competitor gap #3) is therefore a mapping job, and a defensive stat engine already has its item-side inputs.
2. **Two-handed occupancy is implementable today.** Each item detail carries `twoHanded`, spot-checked as **100% accurate**: Two Hand Sword (14/14), Two Hand Mace (40/40), Bow (45/45), Crossbow (39/39), Staff (27/27), Warstaff (43/43) all `true`; One Hand Sword (15/15) and Quiver (19/19) all `false`. It was previously recorded as undeterminable — that was true of the slim search *index*, not of the item detail, and the limitation was mis-stated as a data one.
3. **Gem quality is now on disk.** `normalizeSkill` had dropped the extractor's `qualityStats`; fixed 2026-09-23 and **`npm run sync:wiki` was run the same day**, so all 1,118 skill records now carry it (verified: `ice-nova.json` has 2 entries). Quality is stored on a build for fidelity and import/export; its 0–20 bound remains an assumption, not data-backed.

### PoB2's data is mostly worse than ours — with one real exception

Compared 2026-09-23 (`docs/research/poe2/pob2-data-comparison.md`). The short version: **do not replace our datasets.** PoB2 embeds roll ranges inside display strings (`"+(5-8) to Strength"`) that require its `ModParser.lua` at runtime; ours are already typed as `{stat, min, max}`. Its uniques are raw in-game-paste text, its bases carry no icons or flavour text, and its tree export is the same class of GGG file we already vendor.

**The gem-quality gap turned out not to be a data gap at all — it was our own bug.** PoB2 does carry `qualityStats`/`altQualityStats` in `src/Data/Skills/act_*.lua`. But so does our own extractor: `@poe2-toolkit/gem-extractor` exposes `GemScaling.qualityStats`, *already resolved at quality 20 and text-rendered*, which is a better shape than PoB2's raw `{stat_id, per_point, base}` triples. Our test fixture `src/lib/wiki/__fixtures__/sample-gem.json` has carried two quality entries all along.

`normalizeSkill` in `src/lib/wiki/normalize.ts` simply never read the field, so it was discarded at the last step and no synced skill file has ever contained gem quality. **Fixed 2026-09-23**, with regression tests against that real fixture.

**A systematic audit found three more fields the same normalizer was dropping.** Every extractor type was diffed against its normalizer's output on 2026-09-23:

| Source | Verdict |
|---|---|
| `Item` (13 fields + `ItemReq`/`ItemArmour`/`ItemWeapon`) | **nothing dropped** |
| `Mod` (10 fields + `ModRoll`/`ModSpawnWeight`) | **nothing dropped** |
| `Map` | nothing dropped |
| `Gem` / `GemScaling` / `GemLevelScaling` | **five fields dropped** — `qualityStats`, `spellCritChance`, `attackCritChance`, `hoverImage`, and (found 2026-09-23 by the PoB decode spike) the gem's own GGG id |

All four were fixed the same day. Crit chance is a number a planner displays and a stat engine needs; `hoverImage` is the gem's larger in-game art. Note `hoverImage` is the **raw GGPK `.dds` path**, not a served URL like `iconUrl` — storing it identifies the art but does not make it renderable without the extraction step `buildIcons` performs for icons.

**The sync has now been run (2026-09-23).** All 1,118 skill records carry `gemId`, `qualityStats` and `hoverImage`, and `scaling[]` carries `spellCritChance`/`attackCritChance`. The fields stay declared optional so that records written before the sync — and any future field caught by the same silent-drop pattern — still type-check. Items and mods were untouched apart from `lastSynced`, as the audit predicted.

**Licence, verified by reading the file header — this matters and the first report got it half right.** PoB2's *code* is MIT (`LICENSE.md`, "Copyright (c) 2018 Xavier Wang"). Its *data* is not: every generated data file carries `-- Skill data (c) Grinding Gear Games`. MIT does not cover it.

That is not a blocker, but it changes the right route. **Our own dataset is already GGG-derived** — extracted from official patch data via `@poe2-toolkit`, which `AGENTS.md` explicitly sanctions. So the correct fix is to pull gem quality through **our existing extraction pipeline**, the same way we get everything else, using PoB2's files as a cross-check rather than as the source. Copying their extraction would take the same GGG-owned data by a worse-provenanced route for no benefit.

### Unresolved discrepancy — do not build on either side of it yet

All **37 Talisman items carry `twoHanded: false`**, which contradicts `docs/research/poe2/classes-and-ascendancies.md:121`, where two-handed "Animal Talismans" are described as unlocking Druid shapeshift forms. Either they are absent from this patch's extract, categorised elsewhere, or the research note describes something unreleased. **Unverified either way** — resolve against the game or patch notes before anything depends on it.

---

## Test state

| | |
|---|---|
| Unit (vitest, `node` env, no DOM harness) | **577 tests / 38 files** |
| E2E (Playwright, mobile + desktop) | **67 / 68** on the last full run (2026-09-24, after shared-link checkpoints) — the one failure was the dev server, not the app; see below. The run before it: 68 / 68 |
| type-check, lint, build | clean |

*Verified 2026-09-24, after merging the four code-review commits and trimming the superseded unit tests: `npm test` 577/38, `npm run type-check` and `npm run lint` clean, `npm run build` clean, and `npx playwright test` 68/68 with the database confirmed back to 1 build, 1 checkpoint and zero `E2E-` rows afterwards.*

**A dev-server race, not an app fault (2026-09-24).** The Slice 1 closing run failed one test, `api-contracts` "stores only the known item fields": `POST /api/builds` answered 500 — but with Next's HTML `_error` page, not the route's own JSON error. The error embedded in that page (read from the response the spec attaches to `playwright-report/results.json`) was `SyntaxError: Unexpected end of JSON input` at `next/dist/server/load-manifest.external.js`, inside `AppRouteRouteModule.loadManifests` — Next's dev server reading a build manifest while another on-demand compile was still writing it, before our handler ran. It cannot happen in a production build, whose manifests are prebuilt. The same test passed in both earlier full runs, and the spec re-run alone passed 33/33. If it recurs often enough to matter, the fix belongs in how the suite warms routes, not in the app.

**One intermittent failure, cause not yet proven (2026-09-23).** A full run after the save-into-checkpoint change passed 19/20. The failure was in `sharing.spec.ts`'s `afterAll` cleanup, *after* its test body passed: the cleanup context's `goto('/builds')` rendered the **dashboard** while signed in, so the "ready" locator never appeared. A rerun of that spec alone, with the cleanup page's document responses logged, passed with a direct `200 /builds`.

What is established rather than guessed: the only code path that lands a signed-in GET on `/dashboard` is `src/proxy.ts`'s "authenticated users away from auth pages" rule, so the cleanup must have been bounced `/builds → /login` first — meaning the proxy saw no user on that one request. **Why `getUser()` returned nothing there is unproven.** It is a GET navigation, so it does not involve `POST /api/builds`.

It exposed a real latent bug either way: that proxy rule redirected a signed-in user on `/login` to `/dashboard` and **dropped the `?redirect=` parameter**, so any transient auth miss stranded the user on the dashboard.

**Fixed (2026-09-23, `02dd001e`).** The rule now sends the user to the `redirect` target when it validates, else `/dashboard`, and never back into `/login` or `/signup`. Validation is the one shared `safeRedirect` in `src/lib/safeRedirect.ts`, which replaced three identical copies (login page, signup page, `/auth/callback`) — all three had accepted `/\evil.com`, which the URL parser resolves to `//evil.com`, an open redirect. *Verified:* `src/lib/safeRedirect.test.ts` (hostile inputs, normal paths with query strings) and `src/proxy.test.ts` (the proxy against a mocked `getUser`, including the no-user → `/login` → signed-in round trip landing back on the original page). Both suites failed against the old code before passing against the new. *Also verified since:* `e2e/redirects.spec.ts` (12 tests, including seven hostile targets checked on the raw `Location` header) passes in the 68/68 run of 2026-09-24. **The cause of the one-off `getUser()` miss is still unproven** — the fix removes its consequence, not its cause.

**Three E2E specs added on 2026-09-24 — `api-contracts`, `redirects`, `pwa-and-wiki-search` — now pass.** Written in a session with no test account, they were first run on 2026-09-24: 49 of 50 passed. The one failure, "finds a skill despite a typo", was a broken precondition rather than an app fault. `WikiSearch` renders from `useDeferredValue`, so it paints once with the previous, empty query — the unfiltered list, whose first entry is the Ice Nova skill — and the test's "link is visible" check was satisfied by that list before any search ran. It failed once and passed unchanged on a rerun. Fixed to wait for a result only the typo produces; 3/3 on repeat, then in the 68/68 full run.

The unit tests these specs superseded were then deleted — **but only where the E2E genuinely covers them.** The original list over-claimed, so seven were kept:

| Kept | Why E2E does not replace it |
|---|---|
| `api/builds/route.test.ts` "leaves gear_state, gem_state and main_skill out of the update…" | the E2E keep-rule test asserts gear and notes only, never `gem_state` or `main_skill` — this is the anti-wipe rule |
| `api/builds/route.test.ts` "writes gear_state and gem_state when the body does carry them" | the E2E writes gear on a *create*, never on an update |
| `api/wiki/items/route.test.ts` "serves the jewels pseudo-slot…" and "honors a limit below the default…" | no E2E case for either |
| `proxy.test.ts` "a transient no-user bounce to /login lands back on the original page" | fault injection — E2E cannot make `getUser()` miss once |
| `WikiSearch.test.ts` "returns everything for an empty query" and "matches on name" | pure logic, not asserted by the E2E |

Deleted, each case confirmed present in an E2E spec first: `manifest.test.ts`; `route.test.ts`'s "rejecting a request before it can write" and "malformed ids" groups plus its off-origin-icon and RLS-miss cases; eleven wiki-items route cases; `proxy.test.ts`'s five redirect cases; `WikiSearch.test.ts`'s typo and no-match cases. 46 tests in all, 623 → 577.

Every other unit test stays: it covers something E2E cannot reach (fault injection, the offline wiki sync, pure edge-case logic) — see the audit in the commit that added this note. Each run now writes `playwright-report/results.json`, with every server response the API specs assert on attached.

**One deliberate gap in automated coverage:** the gem level and quality inputs are `<input type="number">`, which puts them outside `mobile-layout.spec.ts`'s `button, a[href]` tap-target selector. They are sized `h-11` by hand. If that selector is ever widened, expect them to be scanned.

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
| `supabase/schema.sql` | **Deleted 2026-09-23.** It claimed to be generated while nothing generated it, so it went stale on every migration and twice misled work — once by three migrations, once by stating the inverse of the privacy model. Replaced by `supabase/migrations/` (the record) plus `npm run db:schema` (a generated, uncommitted view). Older docs still cite it; they mean the deleted file. |

`plans/2026-07-12-pwa-serwist.md` also matches a grep for "unlisted" — that is an unrelated npm dependency, not a visibility claim. Checked, not stale.
