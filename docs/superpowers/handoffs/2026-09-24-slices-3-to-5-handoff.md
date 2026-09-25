# Slices 3–5 — Handoff

**Date:** 2026-09-24
**Branch:** `worktree-server-migration` (worktree `C:/Dev/project-vaal-wt/server-migration`), level with `main` at the time of writing.
**Status:** Slices 0, 1 and 2 of `plans/2026-09-23-convergence-integration.md` are complete, merged to `main`, and live in production. This hands off the last three slices. **The UI pass is a separate handoff and comes after Slice 5.** Until then every new surface is test-grade (see "Rules that stay in force").

---

## Read these first, in this order

1. **`docs/superpowers/CURRENT-STATE.md`** — the only document verified against the live database. Where anything here disagrees with it, it wins.
2. **`AGENTS.md`** — Next.js 16 has breaking changes (read `node_modules/next/dist/docs/` before writing App Router code), and the GGG-art rule.
3. **`docs/superpowers/plans/2026-09-23-convergence-integration.md`** — the slice roadmap, the open-decisions table and the subagent protocol. Slices 3–5 have **no task-level detail there on purpose**; each needs its own plan document first.
4. **`docs/superpowers/plans/2026-09-24-slice2-pob-import.md`** — the most recent example of how a slice was planned and run: facts verified before code, failure-mode tests first, a result section at the end. Copy its shape.
5. **`docs/superpowers/specs/2026-09-23-competitor-build-flow-gaps.md`** — gaps #1, #2, #3 and #8 are what these slices close.
6. **`docs/research/poe2/stat-formula-feasibility.md`** — Slice 5's input. Read the "Controller verification" section at the bottom first; it corrects the body.
7. Your auto-memory. `docs-are-the-likeliest-bug-source`, `npm-install-reverts-patches`, `e2e-playwright-harness`, `browser-verification-gotchas` and `no-prs-merge-locally` each encode a trap that has cost real time.

---

## What exists now (so you do not rebuild it)

- **Builds as leveling journeys.** Every build is an ordered list of checkpoints (`public.build_checkpoints`), each with its own tree, gear and gems. The `builds` row mirrors one checkpoint through database triggers; `active_checkpoint_id` says which.
- **PoB2 import** (`src/lib/pob/`, `src/app/(dashboard)/builds/importActions.ts`). It is relevant to all three slices below, because it already *reports* what those slices will start to *keep*:
  - rolled item mods, runes, quality and variants are counted and reported as not kept (Slice 4 can start keeping them);
  - PoB's attribute choices (`AttributeOverride`) are reported as dropped (Slice 5 needs them — see its open decision);
  - the item catalogue (`src/lib/pob/catalogue.ts`) is a ready-made server-side index of items, gems and tree nodes.
- **Limits already enforced:** 5 supports per skill (`MAX_SUPPORTS_PER_SKILL`), 8 ascendancy points (`MAX_ASCENDANCY_POINTS`), a level-derived passive budget (signalled, never blocked), gem level capped per gem.
- **The write gate** (`src/lib/build/stateInput.ts`) refuses any gear or gem field it does not know. **Any new stored field must be added there in the same change**, or every save carrying it is refused.

---

## Slice 3 — Structural validation (gap #2)

**Goal:** pure functions that look at a checkpoint's tree, gear and gems and return warnings. No formulas. Every later slice reuses them.

**Verified on disk 2026-09-24** (`public/data/wiki/2026-08-25/`):
- **221 of 4,994 items carry `twoHanded: true`**, and their `tags` include `two_hand_weapon` / `twohand` (e.g. Siege Crossbow).
- **All 37 Talismans carry `twoHanded: false`**, which contradicts `docs/research/poe2/classes-and-ascendancies.md:121`. The roadmap says to resolve this against the game or patch notes, or to exclude talismans from the rule and say so. **Do not build on either side of it unverified.**
- **109 skills carry a `reservation`** value in `scaling[]` (e.g. Alchemist's Boon, 30), and **13 items grant `spirit`** (e.g. Aromatic Sceptre, 100). Spirit sources from the tree and ascendancies are **not yet checked** — verify before claiming a spirit total.

**Candidate checks, cheapest first:** a two-handed weapon plus anything in the same set's off-hand; reservation versus available spirit (only once every spirit source is known); an item in a slot its category does not fit (should already be impossible through the UI — check imports); anything else the plan's research turns up.

**Open decision (roadmap #2):** warn or block on two-handed occupancy. The recommendation is **warn**, matching the passive-budget precedent. Confirm with the user in the Slice 3 plan.

**Shape:** `src/lib/build/validate/` (or similar), pure and unit-tested, returning typed warnings. Show them in a test-grade list; the UI pass will place them properly.

---

## Slice 4 — Item affixes, rolls, tiers (gap #3)

**Goal:** a stored item carries its rarity and its chosen mods with rolled values, authored from our typed mod data; and PoB import keeps what it can match instead of reporting it all as dropped.

**Verified on disk 2026-09-24:**
- **5,267 mod files**, each with `rolls: [{stat, min, max}]`, `tier`, `level`, `generationType` (Prefix / Suffix / …), `domain`, `families`, `stats` (display strings) and `spawnWeights: [{tag, weight}]`.
- **4,554 of 4,994 items carry `tags`** (Siege Crossbow: `crossbow, default, ranged, two_hand_weapon, twohand, weapon`), plus `implicitMods`, `modDomain` and `itemClass`.
- So eligibility is a join between a mod's `spawnWeights` and an item's `tags`. The PoE convention is that the **first** spawn-weight tag the item carries decides the weight, and weight 0 excludes. **That convention is not verified against this data** — confirm it on a handful of known items before relying on it.

**Work this implies:**
- Extend `GearItem` (`src/lib/build/gearSlots.ts`) with rarity and mods. Then update `parseGearState`, the write gate, the gear sheet (test-grade editor), the shared-build view and jewels, which use the same item shape.
- PoB import: mod lines are clipboard display text, and a sibling `<ModRange range="0.5">` gives each roll's position within its range (see `specs/2026-09-23-pob2-decode-findings.md`). Match them best-effort against our mods' `stats` strings. Unmatched lines stay reported, as they are today.
- A stored-state change means old rows lack the new fields. Readers must default them, never crash — the same discipline `parseGearState` already follows.

---

## Slice 5 — Defence stat engine (gaps #1 numeric, #2 numeric, #8)

**Goal:** Life, Mana, Energy Shield, Armour, Evasion, attributes and resistances, computed from tree + gear + gems + level, shown per checkpoint.

**Inputs already in hand:** character level (a real stored input), affixed items (after Slice 4), tree allocation per checkpoint.

**From the feasibility report — mind its verification status:**
- PoB2's `CalcDefence.lua` / `CalcPerform.lua` implement this. PoB2 is **MIT**, so porting the arithmetic is allowed with attribution. **The attribution line is "Copyright (c) 2018 Xavier Wang"**, not the report body's "David Gowor, 2016" (corrected in its Controller verification section). Check per-file headers of anything ported.
- The numeric constants (Life = 28 + 12/level + 2/Str, the resistance caps, the armour formula with 12, and so on) are **cross-checked by the report but not independently verified**. Verify them before building on them.

**Open decisions for the Slice 5 plan:**
- **Attribute choices.** A "+attribute" passive's chosen attribute changes Str/Dex/Int, and so Life and Mana. Today it is not stored (PoB import reports it dropped). Storing it needs a `PassiveState` extension touching the editor, the write gate and every reader. This was recorded in the Slice 2 plan as a decision for the controller; **ask the user**.
- **Campaign resistance penalty** (gap #8): a config input, a per-checkpoint value, or derived from checkpoint level. Ask.

---

## How to run each slice (what worked in Slice 2)

1. **Plan document first**, in `docs/superpowers/plans/`, with a "verified facts" table saying how each fact was checked. Verify facts on disk or in the live database before writing them. Two of Slice 2's planned numbers were wrong until checked.
2. **Failure-mode tests first** in every module (AGENTS.md), against small fakes; then one test against real data.
3. **Migrations:** write the file in `supabase/migrations/`, apply with the Supabase MCP `apply_migration`, then **rename the file to the version the live database recorded** (`select version from supabase_migrations.schema_migrations where name = …`). Verify as the `authenticated` role with RLS in a block that rolls back by raising. Then regenerate types and run the security advisors. There is one database and it is production: a migration is live the moment it is applied, whatever branch the code is on.
4. **E2E** from the migration worktree. The main worktree's `.env.local` has no E2E credentials. Assert populated, different values rather than "empty after reload", and assert how many controls a tap-target scan measured.
5. **Merging to `main`** (the user asks first; no PRs):
   - Gates on the merged tree: type-check, lint, unit tests, and a build **after `rm -rf .next`** (a stale cache failed the build once).
   - In the main worktree, run `npm install` then `npx patch-package`; an install reverts the `@poe2-toolkit` patches.
   - **If any server code reads `public/data` at request time, check its route's `.nft.json` after the build.** The tracer missed the PoB catalogue entirely: `/builds` listed 0 data files until `outputFileTracingIncludes` in `next.config.ts` was added. The build was green anyway.
   - Push, wait for the Vercel production deploy to reach **READY** (the Vercel MCP `list_deployments`), and only then apply any migration the new code must precede.

---

## Rules that stay in force

- **No UI redesign until after Slice 5.** New surfaces are test-grade: plain markup, 44px controls, a `TEST-GRADE` header comment, portal sheets at `z-40`. Functional only — the user's UI pass replaces them. The existing test-grade surfaces are `CheckpointsSheet` and `ImportSheet`.
- **Visibility vocabulary is inverted on purpose**: `private` means link-shareable, `unlisted` means owner-only. Do not "fix" it.
- **Signed-out users see no builds**, and the database enforces it too (since `20260923234918`). Any new child table needs RLS for `authenticated`, plus its own path for share-link readers (a definer RPC), budgeted from the start.

---

## Loose ends, none blocking

- **PoB import on production has not been exercised signed in.** The tracing fix is verified in the build output only. First real import confirms it; a failure throws a clear "no skill detail files" error (Vercel runtime logs).
- **Maxroll and poe.ninja imports:** the endpoints answer at their documented paths, but no real PoE2 share id was found to prove the success path. pobb.in and poe2db.tw are verified live.
- **Older migration files are named by write time, not the live version**; from `20260925010117` on they match. Harmless; do not "fix" by renaming applied history without checking.
- **Security advisors:** `handle_new_user` is anon-executable (a trigger function; pre-existing), and leaked-password protection is off (an Auth setting — the user's call).
