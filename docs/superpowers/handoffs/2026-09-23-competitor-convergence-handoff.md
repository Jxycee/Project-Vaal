# Competitor Convergence — Handoff

**Date:** 2026-09-23
**Branch:** `worktree-server-migration` — pushed to https://github.com/Jxycee/Project-Vaal/tree/worktree-server-migration
**Status:** the four build-planner tasks and the server-side migration are complete. This hands off the *next* body of work: closing the gaps against competitor planners, plus a UI pass the user has been deferring.

---

## Read these first, in this order — and read them all before writing code

1. **`docs/superpowers/CURRENT-STATE.md`** — the anchor. The **only** build-planner document verified against the live database, and it names which other documents are wrong and how. If anything below contradicts it, CURRENT-STATE wins, because it states how each claim was checked.
2. **`AGENTS.md`** — repo rules. Two matter constantly: this is Next.js 16 with breaking changes, so **read the relevant guide in `node_modules/next/dist/docs/` before writing App Router code**; and GGG art may only depict real in-game content, never serve as a template for our own chrome.
3. **`docs/superpowers/specs/2026-09-23-competitor-build-flow-gaps.md`** — the gap analysis this work exists to close, ranked by impact on a real build.
4. **`docs/research/poe2/stat-formula-feasibility.md`** — whether a live character sheet is reachable. It carries a controller-verification section at the bottom; trust that over the body where they differ.
5. Your auto-memory for this project. `build-visibility-vocabulary`, `docs-are-the-likeliest-bug-source`, `e2e-playwright-harness`, `browser-verification-gotchas`, `npm-install-reverts-patches` and `no-prs-merge-locally` each encode a trap that has already cost real time.

**The single most important habit on this project:** verify a claim before you write it down, and verify it again before you trust it. **Seven of eight defects found in the 2026-09-20→23 work originated in a document rather than in code**, three of them in documents written during that same session. A live-database query, a `git log -- <path>`, or reading the actual failure snapshot each cost seconds. Guessing costs a round trip and leaves a false claim behind for whoever reads next.

---

## What is already done

All on this branch, none of it merged to `main`.

- The server-side migration (`/tree` and `/builds` as Server Components), build persistence, gear, jewels, gems, and sharing.
- A Playwright harness with a dev-only tree automation hook. Current counts live in CURRENT-STATE.md rather than here, so there is one copy to keep true.
- Competitor gaps **#4 (gem level/quality)**, **#7 (build notes)** and **#8 (character level as a modeled input)** — **complete** (commit `8b607e4675`). Verified on 2026-09-23: type-check and lint clean, 476 unit tests across 35 files, full e2e 20/20.

Three findings from that work are worth carrying forward, because each contradicts an intuition carried over from PoE1:
- **Active skill gems scale to level 40**, not 20.
- **Support gems have max level 1** in our data — they do not scale, so they carry no level field.
- **No gem quality data exists anywhere in our dataset.** Quality is stored for fidelity and future import/export, but cannot be validated or applied, and its 0–20 bound is an assumption marked as such in the code.

Exact verified detail — routes, visibility semantics, test counts, environment traps — is in CURRENT-STATE.md. It is deliberately not duplicated here, so there is one copy to keep true.

---

## The work being handed off

### 1. Competitor gaps, in this order

The ordering is dependency and risk, not preference. Numbers refer to the ranking in the gap analysis.

**#6 — Import/export.** Highest leverage per unit of effort. `docs/research/poe2/build-sharing-ecosystem.md` already documents PoB2's share-code format, read from its own Lua source, and PoB2 is MIT-licensed. This is how builds actually move in the PoE community; today nothing can get in or out of Project Vaal. Start with **import**, since it populates the app with real builds to test everything else against.

**#3 — Item affixes, rolls and tiers.** The largest expressive gap, and **smaller than it looks**. Two things were verified on disk 2026-09-23, both of which the earlier planning got wrong:
- `public/data/wiki/2026-08-25/mods/` holds **5,267 mod files already typed** as `rolls: [{stat, min, max}]` with `tier`, `level`, `generationType`, `families` and `spawnWeights`. PoB's hard problem — its 677KB `ModParser.lua` turning display text into typed mods — is one we simply do not have.
- Our **4,994 item detail files already carry base defences, requirements, weapon damage, `spirit`, `dropLevel` and `implicitMods`**. Our gear being "base-item-only" describes what a build *stores*, not what we *hold*. See "The data we already hold" in CURRENT-STATE.md before scoping.

This is a mapping job against data we own, not an extraction or parsing project.

**#5 — Leveling checkpoints.** Turns a build from a snapshot into a journey; a real pobb.in build carried 8 named checkpoints from level 31 to 94. This changes the stored build shape more deeply than anything else on the list, so **do it while the table is still nearly empty**. Every existing build becomes "one checkpoint".

**#1 and #2 — The stat engine and numeric validation.** Feasible and not blocked: PoB2 is MIT-licensed and implements the defensive calculations in `CalcDefence.lua` (240KB), separate from the much larger offence/DPS modules we do not need. Read the feasibility report before scoping. Note the split that makes this tractable:
- **Structural validation needs no formulas** and can ship at any time: support-socket caps, the 8-point ascendancy cap, unreachable tree nodes, duplicate uniques, two-handed occupancy, charm and flask slot rules.
- **Numeric validation** (the reservation bar, resistance caps) needs the engine.
- **Spirit reservation may be reachable without a general engine** — our skill data already carries per-gem `reservation` values. Worth testing before committing to the full port.

### 2. The UI pass the user has been waiting for

The user has said repeatedly that they want to adjust the UI to their liking, and has deliberately held it until the functionality settled. **It is now their turn to drive.** Do not redesign unprompted; ask what they want changed, then change it.

Concrete observations already recorded from a manual pass at 375px, as starting material only:

- The Gear / Jewels / Gems chips **wrap onto two rows and consume roughly 100px of a 375px canvas**, because the Jewels and Gems chips carry full sentences inline ("Jewels — allocate a socket on the tree").
- The `/builds` row does not show the build's main skill, even though `main_skill` is stored.
- Picker results are text-only until an item is picked; icons resolve only at pick time, because `WikiSearchEntry` carries no icon field.
- One gem renders as **"Spectre: (0)"** — a raw formatting token leaking from game data into a user-facing name.
- The expanded save panel overlaps the chip row.

**Hard constraint, unchanged:** the `VaalOrb` component (`src/components/dashboard/vaal-orb.tsx`) must never be altered, replaced, or have its behaviour changed. See the `site-redesign-sequence` memory.

Also relevant to UI weighting: the user expects **`unlisted` and `public` to be the two commonly used visibility options**, with `private` the niche middle. Do not build the control around `private` as the default mental model.

### 3. Loose ends worth closing

- `toggleBuildBookmark` is a Server Function with **no caller** — either wire a bookmarks UI or delete it. It is reachable by direct POST today.
- `POST /api/builds` returns a 500 rather than a 404 for a malformed build id, unlike every other entry point.
- `supabase/schema.sql` was regenerated 2026-09-18 and hand-patched 2026-09-23; **regenerating it properly is still an open task.**
- **Two-handed weapon occupancy is now cheap.** Every item detail carries a `twoHanded` flag, verified 100% accurate across every two-hander and one-hander category sampled. Enforcing "a two-hander occupies the off-hand slot" needs no new data — only a decision about whether to block the pick or warn. It was previously recorded as blocked on data; that was wrong.
- **Gem quality: the pipeline is fixed, the data is not synced yet.** `normalizeSkill` was dropping `GemScaling.qualityStats`, which `@poe2-toolkit/gem-extractor` has produced all along — already resolved at quality 20 and text-rendered. Fixed 2026-09-23 with regression tests, but **no skill file on disk carries it until someone runs `npm run sync:wiki`**, which pulls from the GGPK/patch server and is a deliberate, heavier operation. `WikiSkillDetail.qualityStats` is optional for exactly that reason. Running that sync is the next step for anything that wants gem quality.
- ~~Gem quality data is the one thing PoB2 has that we lack.~~ **Superseded** — it was our own normalizer, not a data gap. Kept for the record: `docs/research/poe2/pob2-data-comparison.md` compares the two datasets: ours is better typed almost everywhere (PoB2 embeds roll ranges in display strings; ours are already `{stat, min, max}`), but it has no gem quality at all while PoB2's `src/Data/Skills/act_*.lua` carries `qualityStats`/`altQualityStats`. **Pull this through our own `@poe2-toolkit` extraction pipeline, not by copying PoB2's files** — their code is MIT but their data files are explicitly `-- Skill data (c) Grinding Gear Games`, and our pipeline already takes the same data from official patch data, which `AGENTS.md` sanctions. Use PoB2 as a cross-check.
- **Unresolved:** all 37 Talismans carry `twoHanded: false`, contradicting `docs/research/poe2/classes-and-ascendancies.md:121` on two-handed "Animal Talismans". Resolve against the game or patch notes before any occupancy rule depends on talismans specifically.

---

## Documents: which to trust, which to update, which are traps

**The anchor.** `docs/superpowers/CURRENT-STATE.md`. Keep it true. When you change something it describes — routes, visibility, test counts, what is built — **update it in the same commit as the change**, not later. It states how each claim was verified; preserve that discipline, because a claim with no stated provenance is indistinguishable from a guess to the next reader.

**Trustworthy and current:**
- `docs/superpowers/specs/2026-09-20-gear-data-corrections.md` — the corrected slot→category mapping
- `docs/superpowers/specs/2026-09-20-jewels-design.md`, `2026-09-20-gear-design.md`
- `docs/superpowers/specs/2026-09-23-competitor-build-flow-gaps.md`
- `docs/research/poe2/stat-formula-feasibility.md` (read its controller-verification section)
- `docs/research/poe2/build-sharing-ecosystem.md` — PoB2 format, read from primary source
- `src/types/database.ts` — generated, correct

**Bannered as wrong in part — each names its own false claims at the top:**
- `docs/superpowers/specs/2026-09-16-build-planner-design.md` — still the best account of *why* the feature is shaped as it is, but wrong on visibility semantics, `Focii`, and the `'Spirit Gem'` claim
- `docs/superpowers/plans/2026-09-22-task4-sharing.md` — body is pre-swap throughout
- `docs/superpowers/handoffs/2026-09-18-server-side-migration-kickoff.md` — complete; two DB facts now false
- `docs/superpowers/plans/2026-09-16-build-planner-task1-persistence.md` — complete; column default now false

**Actively dangerous if trusted:** `supabase/schema.sql`. It carries a "generated from the live database" header and has been wrong twice, the second time stating the **inverse** of the privacy model. **Never verify a database fact against it.** Query the live project with the Supabase MCP tools, or read `src/types/database.ts`.

**Do not delete superseded documents.** They are the record of how the work happened. Banner them, name the specific false claims, and point at CURRENT-STATE.md.

---

## Verification, and how it lies

`npm run test:e2e` (or `--project=mobile`, or `--grep` for a subset) beats hand-clicking, and the dev-only `window.__vaalTree` hook makes the WebGL canvas drivable. The `e2e-playwright-harness` memory has the details.

**Three ways a test here has passed while broken.** All three actually happened on this branch:
1. `expect(list).toEqual([])` over a `querySelectorAll` is green whenever the selector matches nothing. Assert what you scanned, not only what failed — `measureTapTargets` in `e2e/helpers.ts` returns `scanned` for exactly this reason.
2. Asserting a slot reads "Empty" after a reload is equally true of a build that never saved at all. Pair every negative with something that must come back populated.
3. **The state a test runs in is part of the test.** The tap-target scan of `/builds` only ever saw the *empty* page, because cleanup leaves the account with zero builds — so a 24px build-name link, the page's primary action, survived every green run.

**Gates before every commit:** `npm run type-check` → `npm run lint` → `npm test` → `npm run build`. Report actual output, never expected. And check ports 3100-3110 at the **start** of any browser task, not only the end.

**The test account writes to the real production-linked Supabase project.** Create rows, delete them, verify the table afterwards, and say so in chat before a step that writes.

---

## Integration

Per the `no-prs-merge-locally` memory: **do not open pull requests.** Finish by merging into `main` locally and pushing. Every push to `main` deploys straight to production, so confirm with the user first — they have asked to test on a dev server before anything ships.

The branch is already on GitHub, so a Vercel **preview** deployment may exist for it; that is a safe place to look without touching production.
