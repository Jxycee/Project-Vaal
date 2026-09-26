# Handoff — put build-planner data to work across the rest of the site

**Written 2026-09-26** by a cloud Claude Code session during the whole-codebase bug review of `main` @ `15fff5a7`.
**For:** a local Claude Code session on the user's machine (`C:\Dev\project-vaal`).

Read `docs/superpowers/CURRENT-STATE.md` first, as always, and `AGENTS.md`. Every fact below was checked against code, on-disk data or the live database on 2026-09-26 unless it is marked **(verify)**. Do not trust it further than that. Re-check anything you build on.

---

## 0. Who is working on what (avoid collisions)

A cloud session is fixing the review's bugs **right now** on branch `claude/project-vaal-security-review-m0qwi7`, in this order: 1–4, 8, 5–7, 9–12 (numbering from the review). Until that branch is merged into `main`, **do not edit these files**, or coordinate through the user first:

| Area | Files the cloud session is changing |
|---|---|
| Write gate / DB guard | `src/lib/build/stateInput.ts`, `gearState.ts`, `gemState.ts`, a new `src/lib/build/iconUrl.ts`, a new migration under `supabase/migrations/`, `src/types/database.ts` |
| Caching | `src/proxy.ts`, `next.config.ts` (the `/data/wiki` header rule), `src/sw.ts`, `src/lib/wiki/fetchIndex.ts` |
| Price sync | `src/app/api/prices/sync/route.ts` |
| Error handling | new `error.tsx` file(s) under `src/app`, `CheckpointsSheet.tsx`, `MyBuildsList.tsx`, `ImportSheet.tsx` |
| PoB import | `src/lib/pob/mapBuild.ts`, `mapCraft.ts`, `catalogue.ts` |
| Stats | `src/lib/build/stats/collect.ts` |
| Editor | `src/app/(dashboard)/tree/page.tsx`, `ItemPickerSheet.tsx`, `TreeBuildSession.tsx`, `src/lib/build/draftCompare.ts` |

Branch your work from `main`. After the review branch merges, merge `main` into your branch; never rebase someone else's branch.

**Status (updated 2026-09-26, same day):** items 1–12 are fixed and pushed on the review branch, one commit each (`git log main..origin/claude/project-vaal-security-review-m0qwi7`). Unit tests: 1,156 passing; type-check, lint and `next build --webpack` clean. Still open before it can merge:

- **Migration `20260926141500_build_write_guard.sql` — APPLIED 2026-09-26** by the local session, with the user's go-ahead, after its own rolled-back rehearsal under `set local role authenticated` with a real JWT (11/11 checks, including `import_build` mirroring its last checkpoint). The database records it as version `20260926152432`; the file keeps its name because code comments cite it. `npm run db:types` added `build_state_problem`.
- **The new E2E cases have now been run** (local session, 2026-09-26). `api-contracts` failed before the migration, as expected. Two failed because of the tests themselves, not the app, and are fixed in `1c1be260bf`: `draft-and-auth`'s in-flight allocation was empty (the class start has two neighbours, both already taken), and `checkpoints` waited for any `?checkpoint=`, which the new `/tree` redirect had already put in the URL. The in-flight test now fails against the pre-fix `TreeBuildSession` and passes with the fix. The full suite with the migration applied: see §5.
- **After deploy, confirm the redirect header:** `curl -sI https://www.project-vaal.xyz/data/wiki/2026-08-25/item-index.json` must show `cache-control: no-store` on the 307. Vercel preview deployments of this project answer 500 even for untouched code (probably missing Supabase env vars), so it could not be checked before merging.

---

## 1. Your task

Build the cross-site features in §3, in the order that makes sense to you, **and keep looking for further opportunities while you do**. Every time you touch a part of the site, ask:

- What does the build planner already know that this page could use?
- What does this page know that the planner could use?

Write any new opportunity you find into §5 of this file with the facts you checked, even if you don't build it. Tell the user about each one before building it, so they can decide. Big features need their agreement first. Small wins such as a link or a count can simply be built.

---

## 2. Rules of this repo that will bite you

- **Deploys.** Every push to `main` deploys straight to production. Merge locally into `main` and push only after the user confirms. Do not open a PR unless asked.
- **The database is production.** There are no Supabase branches. A migration is live the moment it is applied. Each schema change is a file in `supabase/migrations/` **plus** an `apply_migration` call **in the same commit**, then `npm run db:types`. See `supabase/migrations/README.md`. Before applying, rehearse the SQL inside `begin; … rollback;` via `execute_sql` under `set local role authenticated` (this is how earlier migrations were verified).
- **Visibility is inverted from the usual meaning.** `public` = listed and readable by every signed-in user. `private` = owner plus anyone holding the share link. `unlisted` = owner only. **Any aggregation across users must use `visibility = 'public'` builds only.** A `private` build is "link-shared, don't publicise". Never count it, list it or mention it anywhere else.
- **All of `/builds`, `/wiki` and `/data/wiki/**` require sign-in.** Anything new that shows build or wiki data must also require it. `/prices` is public, so be careful about showing build-derived data there to signed-out visitors.
- **Testing (AGENTS.md):**
  - Prefer E2E (Playwright, `e2e/`) and produce a repeatable artifact.
  - Never write unit tests after the code.
  - If you must test in isolation, write every way it can fail FIRST, then the code.
- **Next.js here is not the one you know.** Read `node_modules/next/dist/docs/` before using an API. Also: `npm install` silently reverts the `@poe2-toolkit` patches (run `npx patch-package`), and `next dev` needs `--webpack` in the worktree.
- **GGG art:** only real in-game content may use GGG art (tree, wiki icons, prices icons). Any new chrome must be original.

---

## 3. What the build sections hold, and where it can go

### What a build carries (verified)

| Data | Where | Notes |
|---|---|---|
| Class, ascendancy, level, league, name, notes, `main_skill`, view count | `public.builds` | `ascendancy` stores the tree's **internal id** (`Witch1`), not the display name (`Infernalist`). Map it through the tree export's `classes[].ascendancies[{id,name}]`. `league` is free text defaulting to `'Standard'`. |
| Leveling checkpoints: name, level, tree, gear, gems each | `public.build_checkpoints` | The `builds` row mirrors the most recently saved checkpoint (triggers). |
| Gear per slot (17 slots) plus jewels by socket node id | `gear_state` jsonb | Each item: `slug, name, category, isUnique, iconUrl`, optional `craft` (rarity, affixes by mod slug with rolled values, runes by item slug, quality, corrupted). |
| Gems: skill plus up to 5 supports per loadout, level, quality, weapon sets, primary | `gem_state` jsonb | `main_skill` = primary loadout's skill name (`deriveMainSkill`). |
| Passive allocation per weapon set, ascendancy nodes, attribute choices | `passive_state` jsonb | Node ids are the 0.5.2 tree's. |
| Tags (≤ N per build, 1–32 chars, normalised lowercase) | `public.build_tags` | |
| Derived, not stored: defence sheet (Life, Mana, ES, Armour, Evasion, attributes, resistances, Spirit per weapon set), structural and craft warnings, reserved Spirit | `src/lib/build/stats/`, `src/lib/build/validate/` | Pure functions. The client needs the stats files (`public/data/wiki/<v>/implicit-stats.json`, `unique-stats.json`, `public/data/tree/0.5.2/node-stats.json`). |

Live counts on 2026-09-26: **1 build** (Witch, no ascendancy), 6 user profiles, 1 `campaign_progress` row, **0 `characters`**, **0 `ladder_entries`**. Design for growth; don't assume data exists.

### Opportunities, with the join each one needs

**A. Prices × builds — "what does this build cost?"**
- `price_entries(league, category, name, api_id, divine_value, exalted_value, icon_url, fetched_at)`. Leagues synced right now: `Standard`, `Runes of Aldur`, `HC Runes of Aldur`, `Forbidden Rites`, `HC Forbidden Rites`.
- **Runes and soul cores:** price `name` equals our wiki item name exactly (e.g. `Greater Iron Rune`, `Soul Core of Tacati`). Join `craft.runes[]` (item slugs) → item detail `name` → `price_entries.name` in categories `runes` / `soulcores`.
- **Uniques:** price `name` is **unique name + base name** concatenated: `Kaom's Heart Conqueror Plate`, `Grand Spectrum Ruby`, `Guiding Palm of the Heart Shrine Sceptre`. Join on `GearItem.name + ' ' + uniqueMods.baseType` (from the item detail file), in categories `uniques-accessory|armour|flask|jewel|weapon`. The base is what tells multi-base uniques apart (Grand Spectrum Ruby/Emerald/Sapphire), so don't join on name alone. Check your coverage against real rows before trusting it **(verify: measure the match rate over all 425 typed uniques)**.
- Rares and magic items have no market price, so say "not priced" rather than 0.
- The build's `league` field could offer the leagues from the `price_entry_leagues` view instead of free text. Keep `'Standard'` as the default, and keep old free-text values readable.
- Surfaces: a cost line per checkpoint on `/tree` and on the shared page; "priced in <league>, synced <fetched_at>".

**B. Campaign tracker × stats engine.**
- `src/lib/build/stats/campaign.ts` (`FIXED_QUEST_REWARDS`, `CHOICE_QUESTS`, the act/penalty ladder) duplicates `src/lib/campaign/data.ts` (the tracker's checklist). They should share one source, so a patch can't update one and not the other.
- The stats engine **guesses** campaign progress from level. `campaign_progress.progress` (jsonb `{ [areaId]: boolean }`, ids are `${actId}-${slug(area)}-${slug(boss)}`) holds what the user actually completed. It is per user and optionally per character (`character_id` is nullable, and every live row has it null). Offer "use my campaign progress" on the owner's own stat sheet. Never do this on someone else's shared build, because another person's progress means nothing for the build.
- Reverse direction: a build's checkpoints (e.g. "Act 2, level 28") could show the tracker's rewards for that stage.
- The tracker itself has open bugs from the review (listed in the appendix). Fix them before building on it.

**C. Wiki × builds — "used in N public builds".**
- Skill pages: count public builds whose `gem_state` has that skill (or `main_skill` = name, which is indexed on public builds). Item pages: count public builds whose `gear_state` holds that slug.
- Needs a query over public builds only: plain `select … where visibility = 'public'` (RLS allows it for signed-in users), or a small `SECURITY DEFINER` RPC returning counts only. **(verify: jsonb containment performance. There is no GIN index on the state columns today.)**
- Link back to the finder filtered by skill (`/builds?tab=public&skill=<name>`, already supported by `finderFilters.ts`).

**D. Dashboard.**
- It still lists "Build Planner — Coming soon" (`src/app/(dashboard)/dashboard/page.tsx`, `COMING_SOON`) while `/builds` is live. Move it to live tools.
- Show the user's most recent builds and checkpoints (owner query with `.eq('user_id', …)`).

**E. Characters.**
- `builds.character_id` and the `characters` table (class, ascendancy, level, league, name, realm, GGG id) exist, but nothing writes characters yet (0 rows). When character sync lands, a build can be linked to a character to prefill class/league/level and compare planned against actual.

**F. Finder and search.**
- Facets and header lines should show ascendancy **display names** (see the `ascendancy` note above).
- Tags could become wiki-style search chips.

---

## 4. Also look for (seeds for §1's "keep looking")

- `/prices` item rows could link to the matching wiki page. Same name join as A, in reverse.
- The wiki's mentions index (`src/lib/wiki/mentions.ts`) could link skill and item names inside **build notes** on the shared page.
- The tree node search, the wiki and the stat engine all read the same node ids. A "what gives +X to Y on the tree" wiki view would reuse `node-stats.json`.
- Anything else you notice. Record it in §5.

---

## 5. New opportunities found during implementation

_(append here: what, where, the join, what you verified, whether the user approved it)_

_Written 2026-09-26 by the local session on `feat/cross-site-build-data`. Each entry says how it was checked._

**What the user approved.** Asked which of A, B and C to build, the user chose **"None yet"**. Only the small wins were built:

- **D. Dashboard.** Build Planner is now a live tool linking to `/builds`, and the empty "Coming next" section is gone. A "Recent builds" list (owner-scoped `.eq('user_id', …)`, newest 3) shows name, ascendancy, level and checkpoint count, and each row opens `/tree?build=<id>`.
- **F / appendix 17. Ascendancy display names.** `src/lib/tree/ascendancyNames.ts` → `ascendancyLabel(class, ascendancy)`, used on the dashboard, `/builds` (Mine rows), the finder rows and the shared page header.
- *Verified:* `e2e/cross-site.spec.ts` seeds one build in each vocabulary (see 1). Each half was re-run against `main`'s file and failed there. `src/lib/tree/__tests__/ascendancyNames.test.ts` lists six failure modes, was written before the module, and includes a drift guard against the vendored export.

**1. `builds.ascendancy` held two vocabularies. Bug FIXED.** §3 above says the column stores the internal id (`Witch1`). That was true only of PoB imports.
- The **editor** saves tree-core's *normalized* id, which is the display name (`Infernalist`). *Checked by* dumping `normalizeGggTree(...).classes[].ascendancies[].id`. `PassiveTree.tsx:213` matches on it.
- The **importer** stored GGG's raw id (`mapBuild.ts` → `catalogue.ascendancyIdFor`). An imported build therefore opened in `/tree` with `ascendancyId: "Mercenary2"`, which matches no ascendancy. *Reproduced* by a new assertion in `e2e/pob-import.spec.ts`, which failed with `Received: "Mercenary2"`.
- *Fix:* `mapBuild.ts` stores the name, which is the editor's id, and keeps the raw id only for matching nodes in `mapTree`. Two unit tests had pinned the old value and were corrected. The E2E now passes (`Witchhunter`, 2 ascendancy nodes).
- The live database had no raw-id rows (1 build, ascendancy null), so no data migration is needed. `ascendancyLabel` still reads both vocabularies, for any older import.

**2. The Abyssal Lich import dropped its ascendancy nodes. FIXED 2026-09-26 (`3324de08f9`).** No tree node carries `ascendancyId: 'Witch3b'`; it reuses Lich's `Witch3` graph and re-skins 13 of its nodes through `overridePairs`. PoB2 lists the base `Witch3` ids for it: *checked in* PoB2's `src/Export/Scripts/passivetree_ggg.lua`, which attaches the replacement to the base node as an `option`. `mapTree` compared each node to `'Witch3b'`, so every Abyssal Lich node was dropped. The catalogue now has `graphOf()`, which resolves an ascendancy's graph the way the tree-core patch resolves `graphId`, and `mapBuild` matches nodes by graph. Failure modes were written first in `mapBuild.test.ts`: the new case failed before the fix, and a plain Lich build is pinned unchanged.

**3. Unique prices exist in two leagues only, and not in the default.** *Checked by* querying `price_entries` by category and league. `uniques-*` rows exist only for `Runes of Aldur` and `Forbidden Rites`. Runes and soul cores are in all 5 leagues. `builds.league` defaults to `'Standard'`, so feature A needs a league choice or an honest "uniques unpriced in Standard".

**4. The unique price join works at 96%.** *Checked by* a script over every item detail file and every price row (anon-readable). There are 440 uniques on disk (not 425), and 422 have `uniqueMods.baseType`. **404/422** match `name + ' ' + baseType`. 45 priced uniques have no wiki item, mostly content newer than our 2026-08-25 sync. Runes match **142/142** and soul cores **30/30**.

**5. There is nothing to aggregate yet.** On 2026-09-26 the database held 1 build, 0 of them public, and there is no GIN index on the state columns. Feature C would show 0 everywhere today.

**6. Two unit tests timed out under the full `npm test` run, on `main` too. FIXED 2026-09-26.** They were `scripts/typedStats.data.test.ts` and `src/lib/wiki/categoryTaxonomy.test.ts`. Each reads a whole data directory (5,267 mod files or 4,994 item files): about 2s alone, but over the 5s default when the suite runs in parallel. The directory sweeps now have a 30s timeout, and the item sweeps assert they read something. `npm test` then passed 1167/1167 on three runs in a row.

**7. No spec publishes a build, on purpose.** Publishing would briefly list an `E2E-` build to every signed-in user in production. The finder row shares its label helper with the shared page, which the spec does cover.

**8. Branch verification, with the migration applied (2026-09-26).** The full E2E suite passed 81, skipped 1 (the opt-in network test) and failed 0 in 18.0 min. Afterwards the database held 1 build, 1 checkpoint and 0 `E2E-` rows. type-check, lint and `npm run build` are clean, and `grep -r __vaalTree .next/static/` finds nothing. `npm test` passes except the two pre-existing timeouts in 6. The security advisors show nothing new: every remaining warning predates this branch, and so does leaked-password protection being off in Supabase Auth.

**Not built, noted:** the dashboard hero's "Open passive tree" could become "Open Build Planner" (a UI-pass call). `/prices` → wiki links (§4) work by the join in 4, reversed, but `/wiki` needs sign-in while `/prices` does not.

---

## Appendix — review findings the cloud session is NOT fixing in its first pass

For awareness. If your feature work touches one of these files, fix the bug as part of your change (with a test written before the fix, per AGENTS.md) and note it here. Otherwise leave it for the user to schedule.

- 13. Defence-changing stats dropped silently (`statTable.ts` / `collect.ts:128-131`): e.g. Eldritch Will `maximum_life_mana_and_energy_shield_+%`, `base_all_attributes`, Iron Reflexes, Chayula's Gift, the life-to-ES conversions.
- 14. "Reduced" mods at the wrong end of the roll (`craftText.ts:29` `valueAt`, `craft.ts:95` `bestRolls`).
- 15. `gear_state.jewels` never category-checked: any item under a socket key is counted by the stats engine.
- 16. Campaign tracker drops a debounced save on unmount (`CampaignTracker.tsx:64-68`); whole-blob upsert from stale state; out-of-order saves.
- 17. Ascendancy internal id shown as display text.
- 18. Tapping the current class wipes the tree (`TreeControls.tsx:121`).
- 19. A failed gem-data fetch forces the gem level to 1 (`TreeBuildSession.tsx:265-273`).
- 20. Import preview race (`ImportSheet.tsx`).
- 21. "Heavy Crown Mace" read as the Heavy Crown helmet (`catalogue.ts:198-215`).
- 22. `{fractured}` / multi-range affixes, "Twice Corrupted", `Rune: None` (`mapCraft.ts`).
- 23. Unique variant lines lost in `normalize.ts`; Grand Spectrum first-wins in `sync-wiki.ts:374`; keyword-enriched lines never match.
- 24. Unknown unique import gives false affix warnings.
- 25. Base implicits that change craft rules are ignored.
- 26. Tree caps ignore Weapon Master / `isFree` nodes.
- 28–30, 33. Finder tag-filter URL length, stale `main_skill` after deleting a checkpoint, level not in the draft, degraded-checkpoint draft key.
- (27, 31 and 32 — save-route length caps, gear slug shape, writable `user_profiles.created_at` — are being folded into the cloud session's fix for item 1.)
