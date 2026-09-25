# Competitor Convergence — Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the competitor build-flow gaps in dependency order, starting with the two that are cheapest now and most expensive later — migration discipline, and a multi-checkpoint build shape adopted while `builds` still holds one row.

**Architecture:** Vertical slices. Each slice ships migration → server → UI → tests → `CURRENT-STATE.md` update in one reviewable unit. Pure logic lives in `src/lib/**` as fetch-free, React-free modules (the existing `gearState.ts` / `gemState.ts` / `passiveState.ts` pattern) so it is unit-testable without a DOM harness; wiring lives in route handlers and components.

**Tech Stack:** Next.js 16.2.9 (App Router, Server Components), Supabase Postgres + RLS, TypeScript, vitest (node env), Playwright.

**Spec:** `docs/superpowers/specs/2026-09-23-competitor-build-flow-gaps.md`
**Anchor:** `docs/superpowers/CURRENT-STATE.md` — wins over every other document, including this one.
**Handoff:** `docs/superpowers/handoffs/2026-09-23-competitor-convergence-handoff.md`

---

## Global Constraints

- **This is Next.js 16.2.9 with breaking changes.** Read the relevant guide in `node_modules/next/dist/docs/` before writing App Router code. Heed deprecation notices.
- **GGG art depicts real in-game content only** — never a template for our own chrome. Tree sprites, wiki icons, price icons. Nothing else.
- **`VaalOrb` (`src/components/dashboard/vaal-orb.tsx`) is never altered, replaced, or behaviourally changed.**
- **Visibility vocabulary inverts the web norm and is correct as written:** `public` = all signed-in users + listed + view-counted; `private` = owner + anyone with the share link; `unlisted` = owner only (**the column default**). Do not "fix" either side.
- **Expected usage is `unlisted` and `public`.** `private` is the niche middle. Weight UI accordingly.
- **`supabase/schema.sql` was deleted 2026-09-23** (Task 2). Verify a database fact against `supabase/migrations/`, `src/types/database.ts`, or the live project via Supabase MCP. `npm run db:schema` generates an uncommitted single-file view when you want one.
- **Gates before every commit:** `npm run type-check` → `npm run lint` → `npm test` → `npm run build`. Report actual output, never expected.
- **Check ports 3100–3110 at the START of any browser task**, not only the end.
- **`npm install` silently reverts the `@poe2-toolkit` patches.** Recover with `npx patch-package`.
- **`next dev` needs `--webpack` in this worktree** (`node_modules` is a directory junction; Turbopack rejects it). `npm run build` already carries the flag.
- **`prettier` has no config here** and rewrites whole files to double quotes against house style. Do not run it.
- **The test account writes to the real production-linked Supabase project.** Say so in chat before a step that writes; delete rows afterwards and verify the table.
- **No pull requests.** Finish by merging locally. Every push to `main` deploys to production — confirm with the user first.

---

## Branch and production posture — read before touching anything

**Corrected 2026-09-23, verified live.** The concern that "recent database migration changes are on a branch rather than main" does not describe what is actually true, and the difference matters for risk.

- `list_branches` on project `mjxadehorflhncendqiy` returns `[]`. **There are no Supabase database branches.** There is one database.
- `list_migrations` returns 7 applied migrations, most recently `20260923051313 swap_private_unlisted_visibility_semantics`.
- **All seven are already live in the production database.** A git branch has never gated them. `builds.visibility` default reads `'unlisted'::text` in production right now.

**Why production is nonetheless fine.** `main`'s deployed code carries `visibility` only as a TypeScript type (`src/lib/build/types.ts`, `src/types/database.ts`). It never filters, writes, or branches on the column — `git grep visibility main -- src/` returns type declarations and nothing else, and `src/lib/build/visibility.ts` does not exist on `main`. The entire sharing surface lives on `worktree-server-migration`. So the swapped semantics are live in the database and unreferenced by the deployed application.

**Consequence for this plan: stay on `worktree-server-migration`.** Pushing to `main` buys nothing — it would not "move the migrations," because they are already moved — and it deploys 41 commits and 11,079 changed lines straight to production in one step. The worktree is not harder to work in. **Recommendation: do not merge until a slice is verified on a dev server, per the user's standing request.**

**What actually needs fixing** is that there is no local record of any migration. That is Slice 0.

---

## Slice roadmap

> **Status, 2026-09-24: Slices 0 and 1 are complete** — `CURRENT-STATE.md` holds the verified detail. Slice 1 grew beyond Tasks 6–11 as written: two extra migrations (checkpoint-0 and `updated_at` triggers; deferred position uniqueness, a reorder function, a last-checkpoint guard) and one correction (the owner policy split so it no longer overlaps reads). A code review then added state validation on every write and held two further migrations for the merge to `main` (applied 2026-09-24 with that merge; now in `supabase/migrations/`). **Slice 2 (PoB2 import) is next, and needs its own plan document before any code** — its design inputs are in `specs/2026-09-23-pob2-decode-findings.md`, and the gem join should use `gemId` (20/20 on the real build) rather than names. Note for Slice 2 and Slice 4: `src/lib/build/stateInput.ts` refuses any gear or gem field it does not know, so a new stored field must be added there in the same change or every save carrying it is refused.

Ordered by dependency and by the cost of doing it later, not by preference.

| # | Slice | Gap | Why here | Own plan? |
|---|---|---|---|---|
| 0 | Migration discipline + decode spike | — | Everything after adds schema; today there is nowhere to record it. The spike answers three questions the import design depends on. | this doc |
| 1 | Leveling checkpoints | #5 | **`builds` holds 1 row.** This reshape is free today and expensive after import populates the table. | this doc |
| 2 | PoB2 import | #6 | Highest leverage per unit of effort; populates the app with real builds to test slices 3–5 against. | after Slice 0's spike |
| 3 | Structural validation | #2 (partial) | Needs no formulas. Pure functions reused by every later slice. | separate |
| 4 | Item affixes, rolls, tiers | #3 | A mapping job against 5,267 typed mod files we already own. | separate |
| 5 | Defence stat engine | #1, #2 (numeric), #8 | Only worth building once affixed items feed it. | separate |

**Slices 2–5 deliberately have no task-level detail yet.** Slice 2's design depends on three facts Slice 0's spike establishes; writing bite-sized steps against unverified assumptions is exactly the failure mode `CURRENT-STATE.md` was created to stop. Each gets its own plan document when its predecessor lands.

**The UI pass runs as a parallel track, user-driven.** Do not redesign unprompted — ask, then change. Recorded starting material is in the handoff's §2.

---

## Verified facts this plan is built on

Each was checked on 2026-09-23 by the method named. Re-verify before trusting; do not extend.

| Fact | Method |
|---|---|
| `builds` holds **1 row**; `build_tags`, `build_likes`, `build_bookmarks`, `characters` all **0** | `select count(*)` on the live database |
| `builds.visibility` default `'unlisted'::text`; `passive_state` default `'{"set1": [], "set2": []}'::jsonb` (omits `ascendancyNodes`) | `information_schema.columns` |
| `builds` SELECT policy is `visibility = 'public'` only; owner policy is `ALL` on `auth.uid() = user_id` | `pg_policies` |
| `get_build_by_share_token` is `SECURITY DEFINER` and returns **the `builds` row only** | `pg_get_functiondef`, recorded in CURRENT-STATE |
| Tree nodes are keyed by GGG numeric skill id (`"42761"`), 5,151 nodes, `public/data/tree/0.5.2/data.json` | read on disk |
| `item-index.json`: 4,994 entries, **0 duplicate names** | script over the index |
| `skill-index.json`: 1,118 entries, **17 duplicate names**, all hidden/triggered variants (`spark` vs `spark-skill-gem-unique-earthbound-triggered-spark`; `unleash` ×3) | script over the index |
| `@poe2-toolkit/gem-extractor`'s `Gem` **value** carries no GGG metadata id — but `GemData.gems` is **keyed** by it (`SkillGemIceNova`), and `normalizeSkill` took that key and discarded it. Fixed and synced 2026-09-23; all 1,118 records now carry `gemId`, and PoB import matches **20/20** | `dist/buildGems.d.ts`, `dist/buildGems.js:168,193`, then re-measured against the fixture |
| Item detail files carry `twoHanded`, `requirements`, `armour`, `weapon`, `spirit`, `dropLevel`, `implicitMods` | read on disk |
| Mod files carry `rolls: [{stat, min, max}]` with `tier`, `level`, `generationType`, `families`, `spawnWeights` | read on disk |

### Three corrections to the handoff's framing

**1. Import and affix-authoring are different problems.** "We do not have PoB's `ModParser.lua` problem" is true for *authoring* affixes — the user picks from our typed `rolls[{stat,min,max}]`. It is **false for importing PoB2 items**: PoB2's `<Items>` element stores items as PoE clipboard display text (`"+(5-8) to Strength"`), and reading that back is precisely what `ModParser.lua` does. Slice 2 imports tree + gems + base items and **reports** dropped rolls. Slice 4 adds best-effort text matching against our own mod display strings.

**2. PoB2 code import is cheap; GGG `.build` import is not.** GGG's `.build` JSON keys skills on `Metadata/Items/Gems/SkillGemEarthquake`. Our dataset carries no metadata id at any layer, so that join needs a derived heuristic table we would have to build and maintain. PoB2's XML resolves against `skill-index.json` today. **Do PoB2 first. Treat `.build` as a separate, later decision.**

> **Amended 2026-09-23 by the Slice 0 spike** (`specs/2026-09-23-pob2-decode-findings.md`). This originally said PoB2's XML "keys on display names". That was narrower than the truth: every `<Gem>` carries `gemId`, `skillId` and `variantId` alongside `nameSpec`. The conclusion holds — we hold no metadata id, so the join stays name-based — but name-based joining measured **60% on a real cross-patch build**, not the near-certainty the original wording implied. A new decision follows from that and is listed in Open Decisions: whether to pull GGG metadata ids through our own extraction before Slice 2, which would make the join exact and unblock `.build` at the same time.

**3. The share path is a hidden tax on every child table.** `get_build_by_share_token` is `SECURITY DEFINER` and returns the `builds` row. A share-link reader is not the owner and the build may not be `public`, so RLS hides any child row from them. Every table added from Slice 1 onward needs its own definer RPC or an extension of the existing one. Budget for it; do not discover it at the end.

---

## Subagent protocol (Pro plan — keep delegation cheap)

Delegation costs tokens twice: the subagent's own run, and its result injected verbatim into this session's context. On a Pro budget the second cost is the one that ends sessions early. Rules:

**Delegate only these three shapes.** Anything else stays on the main thread.

| Shape | Agent | Budget note |
|---|---|---|
| "Where is X / what calls Y / list every use of Z" across many files | `caveman:cavecrew-investigator` | Returns a `path:line — symbol — note` table, roughly a third of vanilla `Explore`'s prose. |
| A surgical edit in **1–2 files whose paths you already know** | `caveman:cavecrew-builder` | Hard-refuses 3+ files. Never dispatch without exact paths — passing context costs more than doing it inline. |
| Reviewing a finished slice diff | `caveman:cavecrew-reviewer` | One line per finding, severity-tagged. |

**Hard rules.**
- **Never spawn an agent to answer something already in this plan or in `CURRENT-STATE.md`.** Every spawn starts cold and re-derives context that is already on disk.
- **One investigator, not three**, unless the angles are genuinely disjoint (definitions vs. callers vs. tests). Parallel scouts triple the injected result.
- **Never delegate a new feature, a new file, or a cross-file refactor.** Builder returns `too-big.` and the turn is wasted.
- **Do not delegate the Slice 0 spike.** Its whole value is that the controller sees the raw decoded XML; a summarised relay reintroduces exactly the document-provenance failure this project keeps paying for.
- **Reviewer runs once per slice, on the diff** — not per task, and not for architecture opinions.

**Expected spend across Slices 0–1: roughly three to five dispatches total.** If it climbs past that, the work is being decomposed wrong.

---

# Slice 0 — Migration discipline + decode spike

**Deliverable:** a local migration record that matches the live database, a correctly regenerated `schema.sql`, a deleted dead Server Function, and three verified answers that unblock Slice 2.

---

### Task 1: Establish `supabase/migrations/` and backfill the applied history

**Files:**
- Create: `supabase/migrations/` (7 files, named below)
- Create: `supabase/migrations/README.md`

**Interfaces:**
- Produces: a directory every later slice writes its DDL into, with one file per applied version.

- [ ] **Step 1: List what the live database has applied**

Use the Supabase MCP `list_migrations` tool against project `mjxadehorflhncendqiy`. Expected exactly these seven, in this order:

```
20260731015813  campaign_progress_optional_character
20260826160624  add_price_entry_leagues_view
20260828024123  builds_visibility_forks_likes
20260828024222  builds_visibility_forks_likes_advisor_fixes
20260828024741  builds_get_author_name
20260829195704  add_preferred_price_league_to_user_profiles
20260923051313  swap_private_unlisted_visibility_semantics
```

If the list differs, **stop and report it** — it means something applied outside this history and the backfill would encode a false record.

- [ ] **Step 2: Create one file per version, reconstructed from live state**

Name each `supabase/migrations/<version>_<name>.sql`. These are a *record*, not a replayable history — the database already has them. Put that in a header comment on every file so nobody tries to run them:

```sql
-- 20260923051313_swap_private_unlisted_visibility_semantics.sql
--
-- RECORD ONLY. This migration is already applied to the live database
-- (project mjxadehorflhncendqiy). It was reconstructed on 2026-09-23 from
-- live state via pg_get_functiondef / information_schema, because no local
-- migration file existed when it was applied. Do not replay it.
--
-- Semantics after this migration (see CURRENT-STATE.md):
--   public   = every signed-in user; listed; view-counted
--   private  = owner + anyone holding the share link
--   unlisted = owner only. THE COLUMN DEFAULT.
```

Reconstruct each body by querying the live database, not by reading `supabase/schema.sql`. For the functions, `pg_get_functiondef` gives the exact text:

```sql
select pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('get_build_by_share_token', 'increment_build_view_count', 'get_build_author_name');
```

- [ ] **Step 3: Write the forward rule**

Create `supabase/migrations/README.md`:

```markdown
# Migrations

One database. No Supabase branches (`list_branches` returns `[]` as of
2026-09-23). Every migration here is already live in production the moment
it is applied — a git branch has never gated schema changes on this project.

## The rule, from 2026-09-23 onward

Every schema change is BOTH:
1. a file in this directory, named `<UTC timestamp>_<snake_case_name>.sql`, and
2. an `apply_migration` call through the Supabase MCP tools,

in the SAME commit as the application code that needs it.

The seven files dated before 2026-09-23 are reconstructed records of
migrations applied before this rule existed. Their headers say so. Do not
replay them.

## Never

Do not treat `../schema.sql` as authoritative. It is a convenience dump that
has been wrong twice, once stating the inverse of the privacy model under a
"generated from the live database" header. Query the live project, or read
`src/types/database.ts`.
```

- [ ] **Step 4: Verify the record matches reality**

Run, and paste the real output into the commit message:

```bash
npm run db:types
```

Then `git diff --stat src/types/database.ts`. Expected: **no diff**. A diff means `src/types/database.ts` was stale and the backfill was built on a stale reading — investigate before continuing.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations
git commit -m "chore(db): backfill the applied migration history as local files"
```

Full message body:

```
No local migration record has ever existed on this project; all seven
applied migrations went through apply_migration with nothing on disk. These
files reconstruct that history from live state (pg_get_functiondef,
information_schema) and are marked RECORD ONLY — the database already has
them.

Establishes the forward rule in supabase/migrations/README.md: every schema
change is both a file here and an apply_migration call, in the same commit
as the code that needs it.

Verified: list_migrations returns exactly these seven versions; npm run
db:types produces no diff against src/types/database.ts.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 2: Regenerate `supabase/schema.sql` honestly

**Files:**
- Modify: `supabase/schema.sql`

**Interfaces:**
- Consumes: the live database, via Task 1's verification.
- Produces: a dump whose header states what it is and is not.

- [ ] **Step 1: Regenerate from the live database**

Dump every object in `public` from the live project. Do not hand-patch. If the tooling cannot produce a clean dump, **say so and leave the file alone** — a second hand-patched dump under a "generated" header is the exact failure this task exists to end.

- [ ] **Step 2: Replace the header**

```sql
-- supabase/schema.sql
--
-- A CONVENIENCE DUMP, NOT AN AUTHORITY.
--
-- Regenerated 2026-09-23 from project mjxadehorflhncendqiy. It goes stale
-- the moment anyone applies a migration without regenerating it, and it has
-- been wrong twice before — the second time stating the INVERSE of the
-- privacy model under a "generated from the live database" header.
--
-- To verify a database fact: query the live project with the Supabase MCP
-- tools, or read src/types/database.ts (generated, correct).
-- The migration record is supabase/migrations/.
```

- [ ] **Step 3: Confirm the visibility semantics survived the regeneration**

```bash
grep -n "visibility" supabase/schema.sql
```

Expected: `builds.visibility` default is `'unlisted'::text`, and `get_build_by_share_token` filters `visibility IN ('public','private')`. If either reads otherwise, the dump is wrong — do not commit it.

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql
git commit -m "docs(schema): regenerate schema.sql and demote it in its own header"
```

Full message body:

```
Replaces the 2026-09-18 generation plus its 2026-09-23 hand patch with a
clean dump, and rewrites the header to say plainly that this file is a
convenience copy rather than an authority — it has stated the inverse of the
privacy model once already.

Verified: builds.visibility defaults to 'unlisted'::text and
get_build_by_share_token filters visibility IN ('public','private') in the
regenerated file.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 3: Delete the uncalled `toggleBuildBookmark`

**Files:**
- Modify: `src/app/(dashboard)/builds/actions.ts`

A Server Function with no caller is reachable by direct POST. There is no bookmarks UI and none is planned in Slices 0–5, so the exposure has no offsetting value.

- [ ] **Step 1: Confirm it has no caller**

```bash
grep -rn "toggleBuildBookmark" src/ e2e/
```

Expected: the definition, and nothing else. **If a caller exists, stop** — the handoff's claim is wrong and this task becomes "wire the UI" instead.

- [ ] **Step 2: Delete the function and any now-unused imports**

- [ ] **Step 3: Confirm the table keeps its policies**

`build_bookmarks` stays, with its RLS intact — this removes a route, not the schema. No migration.

- [ ] **Step 4: Run the gates**

```bash
npm run type-check
```

Then `npm run lint`, then `npm test`.

- [ ] **Step 5: Commit**

```
fix(builds): remove toggleBuildBookmark, a Server Function with no caller

It was reachable by direct POST while nothing in the app invoked it, and no
bookmarks UI is planned through the convergence slices. The build_bookmarks
table and its RLS policies are untouched, so wiring a UI later needs no
migration.

Verified: grep over src/ and e2e/ found the definition and no call site.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 4: The decode spike — answer three questions before Slice 2 is designed

**Files:**
- Create: `src/lib/pob/__fixtures__/sample-pob2-code.txt`
- Create: `scripts/spike-decode-pob.ts` (throwaway; deleted in Slice 2)
- Create: `docs/superpowers/specs/2026-09-23-pob2-decode-findings.md`

**Do not delegate this task.** Its value is that the controller reads the raw decoded XML directly.

- [ ] **Step 1: Fetch one real code and vendor it as a fixture**

Pick a public pobb.in build. Fetch its raw code from `https://pobb.in/pob/<id>` and save the response verbatim to the fixture path. Record the source URL and the fetch date in a sibling note. One fixture is enough; the point is a real artefact, not coverage.

- [ ] **Step 2: Decode it**

```ts
// scripts/spike-decode-pob.ts
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

const raw = readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8').trim();
const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
const xml = inflateSync(Buffer.from(b64, 'base64')).toString('utf8');
console.log(xml);
```

Run it with `npx tsx scripts/spike-decode-pob.ts`, redirecting into the session scratchpad directory (not `/tmp` — this is Windows). **Read the XML.**

- [ ] **Step 3: Answer the three questions, in writing, with the evidence**

Write `docs/superpowers/specs/2026-09-23-pob2-decode-findings.md`. For each answer, quote the XML fragment it came from.

1. **Does `<Tree>` hold multiple `<Spec>` elements, and does `<Skills>` hold multiple skill sets?** The research doc says "spec(s)" and this has never been verified. Slice 1's checkpoint model and Slice 2's `mapCheckpoints` both assume yes.
2. **Do `<Spec nodes="...">` ids match our `0.5.2` tree node keys, and at what hit rate?** Compute it: parse the node list, load `public/data/tree/0.5.2/data.json`, report `matched / total` and list up to ten misses.
3. **What fraction of `<Skills>` gem names resolve against `skill-index.json`?** Report `resolved / total`, and list every unresolved name.

- [ ] **Step 4: Apply the gate**

- **Tree hit rate ≥ 95%** → Slice 2 imports the tree. Proceed as planned.
- **Tree hit rate < 95%** → the tree export versions have drifted. Slice 2 drops to gems + items + notes, and the tree becomes its own investigation. **Record the number; do not average it away.**
- **`<Tree>` holds only one `<Spec>`** → Slice 1 still proceeds (checkpoints are our own feature and pobb.in demonstrably has 8 of them), but Slice 2's `mapCheckpoints` is dropped and imports produce a single checkpoint.

> **Gate outcome, 2026-09-23 — PASSED.** Tree **99.50%** (600/603 across 8 specs, one unknown node id `15671`), so Slice 2 imports the tree. `<Tree>` holds **8 named `<Spec>` elements**, so Slice 1's checkpoint model is validated and `mapCheckpoints` survives. Gems resolve at **60%** after tier-stripping, which makes the import report mandatory rather than merely good practice.
>
> **One assumption this task disproved:** PoB checkpoints are **tree-only** — one `<SkillSet>` and one `<ItemSet>` against eight `<Spec>`s. Slice 1's table stores `gear_state` and `gem_state` per checkpoint, which stays correct as a superset, but `mapCheckpoints` in Slice 2 must write eight copies of the same gear and gems and the report must say it did. Full detail in `specs/2026-09-23-pob2-decode-findings.md`.

- [ ] **Step 5: Commit the fixture and the findings**

```
spike(pob): decode a real PoB2 share code and record what it contains

Vendors one real pobb.in code as a fixture and answers the three questions
Slice 2's import design depends on: whether the XML carries multiple tree
specs and skill sets, what fraction of its passive node ids match our 0.5.2
tree export, and what fraction of its gem names resolve against
skill-index.json. Every answer quotes the XML fragment it came from.

The throwaway script goes away when Slice 2 replaces it with a tested
module.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 5: Run `npm run sync:wiki` (independent; own commit)

**Files:**
- Modify: `public/data/wiki/**` (large — 1,118 skill records plus icons)

Four fields (`qualityStats`, `spellCritChance`, `attackCritChance`, `hoverImage`) were being silently dropped by `normalizeSkill`. The pipeline is fixed; **the files on disk are not**, and nothing that wants gem quality or crit numbers can proceed until this runs. It pulls from the GGPK/patch server and is a deliberate, heavy operation.

- [ ] **Step 1: Tell the user before starting.** This rewrites the vendored dataset and produces a very large diff.

- [ ] **Step 2: Run it**

```bash
npm run sync:wiki
```

- [ ] **Step 3: Verify the four fields actually landed**

Read a regenerated skill record and confirm `qualityStats` is present on the record and `spellCritChance` / `attackCritChance` are present on its `scaling[]` entries. **If they are absent, the sync did not pick up the fix — stop and report it** rather than committing a no-op dataset churn.

- [ ] **Step 4: Re-run the extractor↔normalizer diff**

Repeat the 2026-09-23 audit: diff every `@poe2-toolkit` extractor type against its normalizer output. The failure mode is silent — data arrives and the mapping simply does not list the field. `Item` and `Mod` were complete; all four losses were in gems.

- [ ] **Step 5: Gates, then commit separately from everything else**

```bash
npm run type-check
```

Then `npm run lint`, `npm test`, `npm run build`, then commit:

```
chore(wiki): resync the dataset so the normalizer fixes reach disk

normalizeSkill stopped dropping qualityStats, spellCritChance,
attackCritChance and hoverImage on 2026-09-23, but that fixed the pipeline,
not the files — no skill record on disk carried any of them until this sync
regenerated all 1,118 from the GGPK/patch server.

Verified: the four fields are present in the regenerated records; the
extractor-to-normalizer diff was re-run and found no further losses.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

- [ ] **Step 6: Update `CURRENT-STATE.md`**

Three claims become false the moment this lands: "the data has not been re-synced", "no synced skill file has ever contained gem quality", and "every skill file on disk still lacks all four fields". Fix them in this same commit range, stating the new verification method and date.

---

# Slice 1 — Leveling checkpoints

**Deliverable:** a build is a sequence of named, leveled checkpoints; the existing single row becomes checkpoint 0; share links render every checkpoint.

**Do this before Slice 2.** `builds` holds one row. Importing first means doing this reshape later against a populated table, and means the first real pobb.in import discards seven of its eight loadouts.

**Files (whole slice):**
- Create: `supabase/migrations/<ts>_add_build_checkpoints.sql`
- Create: `supabase/migrations/<ts>_add_get_build_checkpoints_by_share_token.sql`
- Create: `src/lib/build/checkpointState.ts`
- Create: `src/lib/build/__tests__/checkpointState.test.ts`
- Create: `src/components/build/CheckpointBar.tsx`
- Modify: `src/app/api/builds/route.ts`, `src/app/api/builds/route.test.ts`
- Modify: `src/app/(dashboard)/tree/page.tsx`, `TreeBuildSession`
- Modify: `src/components/builds/SharedBuildView.tsx`
- Modify: `src/types/database.ts` (regenerated)
- Test: `e2e/checkpoints.spec.ts`

**Interfaces produced (later slices rely on these exact names):**

```ts
// src/lib/build/checkpointState.ts
export interface BuildCheckpoint {
  id: string;
  position: number;
  name: string;
  level: number;
  passive_state: PassiveState;
  gear_state: unknown;   // validate with parseGearState, never trust directly
  gem_state: unknown;    // validate with parseGemState, never trust directly
}
export function parseCheckpoints(raw: unknown): BuildCheckpoint[];
export function activeCheckpoint(list: BuildCheckpoint[], id: string | null): BuildCheckpoint | null;
export function nextPosition(list: BuildCheckpoint[]): number;
export function reorder(list: BuildCheckpoint[], from: number, to: number): BuildCheckpoint[];
```

---

### Task 6: The migration

**Files:**
- Create: `supabase/migrations/<UTC timestamp>_add_build_checkpoints.sql`

**Interfaces:**
- Consumes: Task 1's migration directory and its forward rule.
- Produces: table `public.build_checkpoints`.

- [ ] **Step 1: Write the migration file**

```sql
create table public.build_checkpoints (
  id            uuid primary key default gen_random_uuid(),
  build_id      uuid not null references public.builds(id) on delete cascade,
  position      integer not null,
  name          text not null,
  level         integer not null default 1,
  passive_state jsonb not null default '{"set1": [], "set2": [], "ascendancyNodes": []}'::jsonb,
  gear_state    jsonb not null default '{}'::jsonb,
  gem_state     jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint build_checkpoints_position_unique unique (build_id, position),
  constraint build_checkpoints_level_range check (level between 1 and 100)
);

create index build_checkpoints_build_id_position_idx
  on public.build_checkpoints (build_id, position);

alter table public.build_checkpoints enable row level security;
```

Note the `passive_state` default **includes `ascendancyNodes`**, unlike `builds.passive_state`, whose default omits it and forces every writer to supply all three keys. Do not copy that older default forward.

- [ ] **Step 2: Add the policies, mirroring `build_tags` exactly**

`build_tags` already solves "owner writes, public-parent reads" on this schema. Copy its shape rather than inventing a second one.

```sql
create policy "Owners can do everything with their build checkpoints"
  on public.build_checkpoints for all
  using (exists (select 1 from public.builds b
                 where b.id = build_checkpoints.build_id and b.user_id = auth.uid()))
  with check (exists (select 1 from public.builds b
                      where b.id = build_checkpoints.build_id and b.user_id = auth.uid()));

create policy "Checkpoints on own or public builds are readable"
  on public.build_checkpoints for select
  using (exists (select 1 from public.builds b
                 where b.id = build_checkpoints.build_id
                   and (b.user_id = (select auth.uid()) or b.visibility = 'public')));
```

- [ ] **Step 3: Backfill the existing rows as checkpoint 0**

```sql
insert into public.build_checkpoints (build_id, position, name, level, passive_state, gear_state, gem_state)
select b.id, 0, 'Level ' || b.level, b.level, b.passive_state, b.gear_state, b.gem_state
from public.builds b
where not exists (select 1 from public.build_checkpoints c where c.build_id = b.id);
```

- [ ] **Step 4: Apply it, then verify against the live database**

Apply via the Supabase MCP `apply_migration` tool. Then:

```sql
select (select count(*) from public.builds) as builds,
       (select count(*) from public.build_checkpoints) as checkpoints;
```

Expected: equal counts (1 and 1 as of 2026-09-23). **A mismatch means the backfill missed rows — fix before continuing.**

- [ ] **Step 5: Regenerate types and commit**

```bash
npm run db:types
```

```
feat(builds): add build_checkpoints and backfill existing builds

A build becomes a sequence of named, leveled checkpoints rather than one
static snapshot — competitor gap #5. Done now because builds holds a single
row, so the reshape is free today and expensive once import populates the
table.

RLS mirrors build_tags' existing owner-writes/public-parent-reads shape
rather than introducing a second pattern. Every existing build is backfilled
as checkpoint 0.

Verified: builds and build_checkpoints return equal counts after the
backfill; npm run db:types regenerated cleanly.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 7: The share-path RPC

**Files:**
- Create: `supabase/migrations/<UTC timestamp>_add_get_build_checkpoints_by_share_token.sql`

**Why this is its own task:** a share-link reader is not the owner, and a `private` build is not `public`, so **both** policies from Task 6 hide every checkpoint from them. Without this, shared builds silently render one checkpoint and look broken. This is the tax every child table pays; it is cheapest to pay here.

**Interfaces:**
- Consumes: `build_checkpoints` from Task 6.
- Produces: `get_build_checkpoints_by_share_token(p_token text)`.

- [ ] **Step 1: Read the existing definer function first**

```sql
select pg_get_functiondef(p.oid) from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.proname='get_build_by_share_token';
```

Match its filter exactly — `visibility IN ('public','private')`. A divergence here is a privacy bug, not a style difference.

- [ ] **Step 2: Write the companion function**

```sql
create or replace function public.get_build_checkpoints_by_share_token(p_token text)
returns setof public.build_checkpoints
language sql
security definer
set search_path = public
as $$
  select c.*
  from public.build_checkpoints c
  join public.builds b on b.id = c.build_id
  where b.share_token = p_token
    and b.visibility in ('public', 'private')
  order by c.position;
$$;
```

A separate function rather than an extension of `get_build_by_share_token`, because that one returns `setof builds` and its shape is already relied on by `SharedBuildRow` in `src/lib/build/types.ts`. Changing its return type would ripple through the shared-build page for no gain.

- [ ] **Step 3: Verify the filter is genuinely enforced**

Against the live database, with the test account, and **say in chat before this step that it writes**: create one build at each of the three visibilities, add a checkpoint to each, then call the RPC with each share token as an unauthenticated caller. Expected: `public` and `private` return their checkpoints; `unlisted` returns zero rows. Delete the rows afterwards and confirm the table is clean.

- [ ] **Step 4: Commit**

```
feat(builds): expose checkpoints to share-link readers via a definer RPC

get_build_by_share_token is SECURITY DEFINER and returns the builds row
only, so build_checkpoints' RLS hides every checkpoint from a share-link
reader who is neither the owner nor looking at a public build. This adds a
companion definer function with the identical visibility IN
('public','private') filter.

Separate from get_build_by_share_token rather than folded into it: that one
returns setof builds and SharedBuildRow already depends on its shape.

Verified against the live database with the test account — public and
private share tokens return checkpoints, unlisted returns zero rows. Test
rows deleted and the table confirmed clean afterwards.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 8: `checkpointState.ts` — the pure module

**Files:**
- Create: `src/lib/build/checkpointState.ts`
- Test: `src/lib/build/__tests__/checkpointState.test.ts`

Fetch-free, React-free, matching `gearState.ts` / `gemState.ts`. This is the unit-test target for everything checkpoint-related that is not wiring.

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { parseCheckpoints, activeCheckpoint, nextPosition, reorder } from '../checkpointState';

const empty = { set1: [], set2: [], ascendancyNodes: [] };

describe('parseCheckpoints', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(parseCheckpoints(null)).toEqual([]);
    expect(parseCheckpoints({})).toEqual([]);
    expect(parseCheckpoints('nope')).toEqual([]);
  });

  it('drops a malformed entry without discarding its siblings', () => {
    const raw = [
      { id: 'a', position: 0, name: 'Level 31', level: 31, passive_state: { set1: [1], set2: [1], ascendancyNodes: [] }, gear_state: {}, gem_state: {} },
      { id: 'b', position: 'not-a-number', name: 'Broken', level: 40 },
    ];
    const parsed = parseCheckpoints(raw);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('a');
    expect(parsed[0].passive_state.set1).toEqual([1]);
  });

  it('sorts by position regardless of input order', () => {
    const raw = [
      { id: 'b', position: 1, name: 'Two', level: 60, passive_state: empty, gear_state: {}, gem_state: {} },
      { id: 'a', position: 0, name: 'One', level: 31, passive_state: empty, gear_state: {}, gem_state: {} },
    ];
    expect(parseCheckpoints(raw).map((c) => c.id)).toEqual(['a', 'b']);
  });
});

describe('activeCheckpoint', () => {
  const list = parseCheckpoints([
    { id: 'a', position: 0, name: 'One', level: 31, passive_state: empty, gear_state: {}, gem_state: {} },
    { id: 'b', position: 1, name: 'Two', level: 94, passive_state: empty, gear_state: {}, gem_state: {} },
  ]);

  it('falls back to the first checkpoint when the id is null or unknown', () => {
    expect(activeCheckpoint(list, null)?.id).toBe('a');
    expect(activeCheckpoint(list, 'deleted-id')?.id).toBe('a');
  });

  it('returns null for an empty list', () => {
    expect(activeCheckpoint([], null)).toBeNull();
  });
});

describe('nextPosition', () => {
  it('returns 0 for an empty list', () => {
    expect(nextPosition([])).toBe(0);
  });

  it('returns one past the highest position, not the length', () => {
    const list = parseCheckpoints([
      { id: 'a', position: 0, name: 'One', level: 31, passive_state: empty, gear_state: {}, gem_state: {} },
      { id: 'c', position: 7, name: 'Three', level: 94, passive_state: empty, gear_state: {}, gem_state: {} },
    ]);
    expect(nextPosition(list)).toBe(8);
  });
});

describe('reorder', () => {
  it('renumbers positions contiguously from zero after a move', () => {
    const list = parseCheckpoints([
      { id: 'a', position: 0, name: 'One', level: 31, passive_state: empty, gear_state: {}, gem_state: {} },
      { id: 'b', position: 1, name: 'Two', level: 60, passive_state: empty, gear_state: {}, gem_state: {} },
      { id: 'c', position: 2, name: 'Three', level: 94, passive_state: empty, gear_state: {}, gem_state: {} },
    ]);
    const moved = reorder(list, 2, 0);
    expect(moved.map((c) => c.id)).toEqual(['c', 'a', 'b']);
    expect(moved.map((c) => c.position)).toEqual([0, 1, 2]);
  });
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/lib/build/__tests__/checkpointState.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Reuse `parsePassiveState` from `./passiveState` rather than revalidating the shape. Leave `gear_state` / `gem_state` as `unknown`, exactly as `SavedBuild` does — callers run `parseGearState` / `parseGemState`. `nextPosition` returns `max(position) + 1`, never `length`, so deleting a middle checkpoint cannot collide with the unique constraint.

- [ ] **Step 4: Run them and watch them pass**

```bash
npx vitest run src/lib/build/__tests__/checkpointState.test.ts
```

- [ ] **Step 5: Commit**

```
feat(builds): add checkpointState, the pure checkpoint module

Fetch-free and React-free, matching gearState/gemState/passiveState. Parses
defensively — one malformed entry falls back without discarding its siblings
— and reuses parsePassiveState rather than revalidating the shape.

nextPosition returns max(position)+1 rather than length, so deleting a
middle checkpoint cannot collide with the (build_id, position) unique
constraint.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 9: Persist checkpoints through `POST /api/builds`

**Files:**
- Modify: `src/app/api/builds/route.ts`
- Test: `src/app/api/builds/route.test.ts`

**Two rules carried forward from the existing route, both load-bearing:**

1. **Conditional writes.** The update path already writes `gear_state` / `gem_state` / `main_skill` / `notes` only when the body sent that key, so a save that touches only the tree cannot wipe them. Checkpoints follow the same discipline.
2. **`builds.passive_state` / `gear_state` / `gem_state` keep mirroring the active checkpoint** for this slice. `/builds`' finder, `MyBuildsList` and `SharedBuildView` all read them; dual-writing now and switching readers in a later slice halves the blast radius.

- [ ] **Step 1: Write the failing tests**

The file already has its harness — `req()`, `validBody()`, `getUserMock`, `updateMock`, `insertMock`, `AUTHED`. Use them; do not build a second one.

```ts
it('returns 400 for a malformed build id rather than 500', async () => {
  getUserMock.mockResolvedValue(AUTHED);
  const res = await POST(req(validBody({ id: 'not-a-uuid' })));
  expect(res.status).toBe(400);
  expect(updateMock).not.toHaveBeenCalled();
});

it('omits checkpoints from the update payload when the body never sent the key', async () => {
  getUserMock.mockResolvedValue(AUTHED);
  await POST(req(validBody({ id: '11111111-1111-4111-8111-111111111111' })));
  expect(updateMock).toHaveBeenCalledTimes(1);
  expect(updateMock.mock.calls[0][0]).not.toHaveProperty('checkpoints');
});

it('mirrors the active checkpoint onto the builds row', async () => {
  getUserMock.mockResolvedValue(AUTHED);
  const active = { set1: [7, 8], set2: [], ascendancyNodes: [3] };
  await POST(
    req(
      validBody({
        id: '11111111-1111-4111-8111-111111111111',
        activeCheckpointId: 'cp-1',
        checkpoints: [
          { id: 'cp-0', position: 0, name: 'Level 31', level: 31, passive_state: { set1: [1], set2: [], ascendancyNodes: [] }, gear_state: {}, gem_state: {} },
          { id: 'cp-1', position: 1, name: 'Level 94', level: 94, passive_state: active, gear_state: {}, gem_state: {} },
        ],
      }),
    ),
  );
  expect(updateMock.mock.calls[0][0].passive_state).toEqual(active);
});
```

- [ ] **Step 2: Run them and watch them fail**

```bash
npx vitest run src/app/api/builds/route.test.ts
```

- [ ] **Step 3: Implement, and fix the 500-on-malformed-id at the same time**

The route currently returns 500 where every other entry point returns 404 for a bad build id. It is the same class of bug and the same file — fix it here rather than leaving it on a list. Validate `body.id` as a UUID before it reaches Postgres; a non-UUID is a 400, an unmatched UUID stays a 404 (deliberately indistinguishable from "not yours" — do not leak other users' build ids).

- [ ] **Step 4: Run the tests and the gates**

```bash
npx vitest run src/app/api/builds/route.test.ts
```

Then `npm run type-check`, `npm run lint`, `npm test`.

- [ ] **Step 5: Commit**

```
feat(builds): persist checkpoints, and return 400 for a malformed build id

Checkpoints follow the route's existing conditional-write discipline: a save
that never sent the key leaves stored checkpoints alone, the same way
gear_state and notes already work. The builds row keeps mirroring the active
checkpoint's three state columns, because the finder, MyBuildsList and
SharedBuildView all still read them — readers move in a later slice.

Also fixes the route returning 500 rather than 404 for a malformed build id,
unlike every other entry point. A non-UUID is now a 400; an unmatched UUID
stays a 404, still deliberately indistinguishable from 'not yours'.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
```

---

### Task 10: The checkpoint UI

**Files:**
- Create: `src/components/build/CheckpointBar.tsx`
- Modify: `TreeBuildSession` (per `CURRENT-STATE.md`, keyed `buildId ?? 'scratch'`)
- Modify: `src/components/builds/SharedBuildView.tsx`

**The keyed remount is load-bearing.** `CURRENT-STATE.md`: *"The keyed remount is what makes the old stale-state data-loss bugs unreachable — do not 'optimise' it away."* Switching checkpoints changes every piece of build-scoped state, so **extend the key to `buildId ?? 'scratch'` joined with the checkpoint id**. Do not add checkpoint switching as in-place state updates.

- [ ] **Step 1: Build `CheckpointBar`**

Horizontal, scrollable, one chip per checkpoint showing name and level, plus an add control. Mobile first — 375px is the design canvas.

Two constraints from recorded UI findings:
- **Tap targets ≥ 44px.** The `/builds` build-name link shipped at 24px and survived every green run because the scan only ever saw an empty page.
- **Chips must not wrap into a second row.** The Gear/Jewels/Gems chips already eat ~100px of 375px by carrying full sentences inline; a second wrapping row makes that worse. Scroll horizontally instead.

- [ ] **Step 2: Wire switching through the remount key**

- [ ] **Step 3: Render every checkpoint on the shared build page**

`SharedBuildView` reads from `get_build_checkpoints_by_share_token`. The shared-page tree already defaults `level` to 100 when absent so a reader never sees a spurious "Over" flag — **per checkpoint now**, using that checkpoint's own level, not the build's.

- [ ] **Step 4: Verify in the browser**

**Check ports 3100–3110 first.** Then run the dev server with `--webpack`, and confirm at 375px: chips do not wrap, tap targets clear 44px, switching a checkpoint swaps the tree.

- [ ] **Step 5: Commit**

---

### Task 11: E2E coverage that cannot pass while broken

**Files:**
- Create: `e2e/checkpoints.spec.ts`

All three known false-pass modes apply here. Write against them deliberately.

- [ ] **Step 1: Write the spec**

`e2e/helpers.ts` already exports everything this needs: `testBuildName`, `openTree`, `allocateNodes`, `saveBuild`, `treeState`, `measureTapTargets`, `MIN_TAP_PX`, `cleanupTestBuilds`. Use them; the tree is drivable through the dev-only `window.__vaalTree` hook.

```ts
import { expect, test } from '@playwright/test';
import {
  MIN_TAP_PX, allocateNodes, cleanupTestBuilds, measureTapTargets,
  openTree, saveBuild, testBuildName, treeState,
} from './helpers';

const SET_A = [1, 2, 3];
const SET_B = [1, 2, 3, 4, 5, 6];

test('each checkpoint keeps its own tree across a reload', async ({ page }) => {
  const name = testBuildName('checkpoints');

  await openTree(page);
  await allocateNodes(page, SET_A);
  const buildId = await saveBuild(page, name);

  await addCheckpoint(page, { name: 'Level 94', level: 94 });
  await allocateNodes(page, SET_B);
  await saveBuild(page, name);

  await openTree(page, buildId);

  // The PAIRED positive: checkpoint 0 must come back POPULATED, not merely
  // "not equal to checkpoint 1" — a build that never saved satisfies that too.
  await selectCheckpoint(page, 'Level 31');
  const first = await treeState(page);
  expect(first.allocated).toHaveLength(SET_A.length);

  await selectCheckpoint(page, 'Level 94');
  const second = await treeState(page);
  expect(second.allocated).toHaveLength(SET_B.length);
  expect(second.allocated).not.toEqual(first.allocated);

  // Assert what was SCANNED, not only what failed: an empty chip list would
  // otherwise make every assertion above vacuously green.
  const chips = await page.locator('[data-testid="checkpoint-chip"]').count();
  expect(chips).toBe(2);
});

test('checkpoint chips meet the tap target on a POPULATED build', async ({ page }) => {
  const name = testBuildName('checkpoint-taps');
  await openTree(page);
  await allocateNodes(page, SET_A);
  await saveBuild(page, name);
  await addCheckpoint(page, { name: 'Level 94', level: 94 });

  // Trap 3: run this while the build EXISTS. Cleanup leaves the account at
  // zero builds, which is how a 24px link survived every green run before.
  const { scanned, failures } = await measureTapTargets(page, '[data-testid="checkpoint-chip"]');
  expect(scanned).toBe(2);
  expect(failures, `expected every chip >= ${MIN_TAP_PX}px`).toEqual([]);
});

test.afterEach(async ({ page }) => {
  await cleanupTestBuilds(page);
});
```

`addCheckpoint` and `selectCheckpoint` are new helpers this task adds to `e2e/helpers.ts`, driving `CheckpointBar` from Task 10. `measureTapTargets` currently takes a `button, a[href]` selector — confirm it accepts an explicit selector argument before relying on the call above, and widen its signature if it does not.

Against each trap:
- **Trap 1 — `toEqual([])` over a `querySelectorAll` passes when the selector matches nothing.** Assert the scanned count. `measureTapTargets` in `e2e/helpers.ts` returns `scanned` for exactly this reason — use it.
- **Trap 2 — asserting a slot reads "Empty" is equally true of a build that never saved.** Every negative is paired with something that must come back populated. Step 4 above is the pair for step 5.
- **Trap 3 — the state a test runs in is part of the test.** Cleanup leaves the account with zero builds, so a scan of `/builds` only ever sees the empty page. **Run the tap-target scan against a build that has two checkpoints**, created by this spec, before cleanup.

- [ ] **Step 2: Run mobile and desktop**

```bash
npm run test:e2e
```

Report actual counts. The baseline is 20/20 across `build-persistence`, `draft-and-auth`, `loadout-persistence`, `sharing`, `mobile-layout`, `desktop-layout`.

- [ ] **Step 3: Commit**

- [ ] **Step 4: Update `CURRENT-STATE.md` in this same commit range**

Sections that go stale the moment this slice lands: **What is built** (checkpoints), **What is not built** (remove "leveling stages"), **Test state** (new unit and e2e counts, stated as real output), and the visibility section (the new definer RPC joins the two already listed). State how each new claim was verified, with the date. A claim with no stated provenance is indistinguishable from a guess to the next reader.

---

## Open decisions — needed before the slices that depend on them

| # | Decision | Blocks | Recommendation |
|---|---|---|---|
| 1 | Checkpoints before import — this plan inverts the handoff's order | Slice 1 vs 2 | **Checkpoints first.** `builds` holds 1 row today; importing an 8-loadout pobb.in build into a single-snapshot model discards 7 of 8, and the reshape still has to happen afterwards against a populated table. |
| 2 | Two-handed occupancy: block the pick, or warn | Slice 3 | **Warn.** Consistent with the over-budget precedent, which signals and never blocks — planning ahead of your character is a normal workflow here. |
| 3 | GGG `.build` import — ever? | post-Slice 2 | **Defer.** No metadata id exists at any layer of our data, so the join needs a derived table we would own and maintain. Revisit if GGG's account-linked Subscribe API ships. |
| 5 | **Pull GGG metadata ids through `@poe2-toolkit` extraction before Slice 2?** Raised by the decode spike. | Slice 2 scope | **Probably yes, and cheap to find out.** Name matching measured 60% on a real build. `<Gem gemId="Metadata/Items/Gems/SupportGemMartialTempo">` is already in every PoB code; if the extractor can carry the same id, the join becomes exact and GGG `.build` import (decision 3) unblocks as a side effect. First step is a read of the toolkit's extractor to see whether the id survives to its output at all — an hour, not a slice. |
| 4 | Merge to `main` | all | **Not yet.** Verify a slice on a dev server first. The migrations are already in production regardless of branch; merging only ships 41 commits of application code. |

## Unresolved, do not build on either side of it

All **37 Talismans carry `twoHanded: false`**, contradicting `docs/research/poe2/classes-and-ascendancies.md:121` on two-handed "Animal Talismans". Resolve against the game or patch notes before any occupancy rule depends on talismans specifically. Slice 3 either resolves this or excludes talismans from the rule and says so.
