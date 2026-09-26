# Findings — cross-site build data (answers §5 of the 2026-09-26 handoff)

**Written 2026-09-26** by a local Claude Code session on branch `feat/cross-site-build-data` (from `main` @ `15fff5a7`).

The handoff itself (`docs/superpowers/handoffs/2026-09-26-cross-site-build-data-handoff.md`) exists only on the cloud session's branch `claude/project-vaal-security-review-m0qwi7`. Its §5 asks for findings to be appended there. They are kept in this separate file instead, because adding that file on a second branch would make an add/add merge conflict. Fold this into §5 when both branches are on `main`.

Every claim below says how it was checked.

---

## What was built (small wins, per handoff §1)

The user chose **"None yet"** for the big features (A build cost, B campaign × stats, C wiki usage counts). Only the small wins were built:

- **D. Dashboard.** Build Planner moved from "Coming next" to the live tools (links to `/builds`). The now-empty "Coming next" section is gone. A "Recent builds" list shows the user's three most recently updated builds: name, ascendancy label, level, checkpoint count, and when it was updated. Each row opens `/tree?build=<id>`. The query is scoped `.eq('user_id', …)`. The "Builds saved" stat no longer says "Build Planner coming soon".
- **F. Ascendancy display names** (appendix item 17), in `src/lib/tree/ascendancyNames.ts` → `ascendancyLabel(className, ascendancy)`. Used on the dashboard, the public finder rows and the shared build header. **Not yet in `MyBuildsList.tsx`**, because that file is on the cloud session's do-not-edit list. It needs the same one-line change (`{b.ascendancy ?? b.class}` → `{ascendancyLabel(b.class, b.ascendancy)}`) once that branch merges.

*Verified:* `e2e/cross-site.spec.ts` (mobile) seeds one build in each ascendancy vocabulary (see finding 1) and checks the dashboard and the shared page against both. Each half was re-run against `main`'s version of its file and failed there: the dashboard at the Build Planner card, the shared page at `Witchhunter · Level 42`. `src/lib/tree/__tests__/ascendancyNames.test.ts` lists six failure modes and was written before the module. It includes a drift guard against the vendored tree export.

---

## New findings

### 1. `builds.ascendancy` holds two vocabularies (bug; not fixed; file is on the cloud session's list)

The handoff's §3 says `ascendancy` "stores the tree's **internal id** (`Witch1`)". **That is only half true.**

- **The tree editor** saves tree-core's *normalized* ascendancy id. After `normalizeGggTree`, that id **is the display name**: `Infernalist`, `Lich`, `Abyssal Lich`. *Checked by:* dumping `normalizeGggTree(raw, '0_5').classes[].ascendancies[].id` from `public/data/tree/0.5.2/data.json` (each entry also carries `internalId: 'Witch1'` etc.). The editor saves `editorState.ascendancyId` as `ascendancy` (`TreeBuildSession.tsx:374`). `PassiveTree.tsx:213` looks up `activeClass.ascendancies.find((a) => a.id === ascendancyId)`.
- **The PoB importer** saves GGG's *raw* id: `catalogue.ascendancyIdFor` maps `(class, name)` to `asc.id` from the raw export (`catalogue.ts:130-140`, and `catalogue.test.ts:21` expects `'Mercenary2'`), and `mapBuild.ts:204` writes that value as `build.ascendancy`.

**Consequence (read from the code, not reproduced in a browser):** an imported build opened in `/tree` passes `'Mercenary2'` as `ascendancyId`. `PassiveTree`'s lookup at `:213` finds nothing, so `activeAscendancyDef` is undefined and `graphAscendancyId` falls back to the raw id. The ascendancy picker should show nothing selected. Whether the imported ascendancy nodes still render is **unverified**.

**Suggested fix (for whoever owns `src/lib/pob/`):** have `ascendancyIdFor` return the normalized id (the name) that the editor saves. Then migrate the rows already stored with raw ids (`update builds set ascendancy = <name> where ascendancy ~ '^[A-Z][a-z]+[0-9]+b?$'`, with the mapping from the export), rehearsed in `begin; … rollback;` first. Live rows on 2026-09-26: the one build has `ascendancy` null, so today nothing needs migrating. `ascendancyLabel` reads both vocabularies either way.

### 2. Unique prices exist in two leagues only, and not in the default one

*Checked by:* `select category, league, count(*) from price_entries where category like 'uniques-%' group by 1,2` on 2026-09-26.

- `uniques-*` rows exist **only for `Runes of Aldur` and `Forbidden Rites`**. There are none for `Standard` or either HC league. Runes, soul cores and the other currency categories are present in all five leagues.
- `builds.league` defaults to `'Standard'`, so feature A would show every unique as "not priced" for a default build. Feature A needs either a league picker that defaults to the current league, or a statement on the cost line that uniques are unpriced in Standard.

### 3. The unique price join works, at 96%

*Checked by:* a script (in the session scratchpad, not committed) reading every `public/data/wiki/2026-08-25/items/*.json` and every `price_entries` unique name through the anon key.

- There are **440** unique items on disk, not the 425 the handoff says. 422 of them carry `uniqueMods.baseType`.
- `name + ' ' + uniqueMods.baseType` matches a price row for **404 of 422 (96%)**.
- 45 priced uniques have no wiki item. Most are content newer than our 2026-08-25 sync: tablets, relics, `Megalomaniac`, `From Nothing`.
- Runes: **142/142** price names are wiki item names. Soul cores: **30/30**.
- `price_entries` is readable with the anon key. That is expected (`/prices` is public), and it means a cost line needs no new policy.

### 4. There is nothing to aggregate yet

*Checked by:* live counts on 2026-09-26. There is 1 build in total, and 0 of them are public. Feature C would render "0 public builds" everywhere until people publish. `builds` has partial indexes on `main_skill`, `(visibility, class, league)` and `game_version`, and **no GIN index on the jsonb state columns**, which confirms the handoff's note.

### 5. Two unit tests time out under the full parallel run, on `main` too

`scripts/typedStats.data.test.ts` ("shares most of the defensive ids…") and `src/lib/wiki/categoryTaxonomy.test.ts` ("covers every real synced item's search-index category…") exceed vitest's 5s default in `npm test`. Both pass when run alone. *Checked by:* running `npm test` on `main` @ `15fff5a7`, which fails the same two tests. This is not caused by this branch. The likely fix is a per-test timeout on these two data-heavy tests.

### 6. No spec publishes a build (observation, deliberate)

No E2E spec sets a build to `public`, so the finder rows (`BuildFinder.tsx`) are covered only through the shared header, which uses the same helper. Publishing a test build would briefly list it to every signed-in user on production, so `cross-site.spec.ts` uses `private` (link-shared) instead.

---

## Opportunities noticed, not built

- **Dashboard hero CTA.** "Open passive tree" could become "Open Build Planner" now that the planner is live. This is a design call for the UI pass.
- **`/prices` → wiki links** (handoff §4). The join is proven by finding 3 in reverse. `/prices` is public and `/wiki` needs sign-in, so a signed-out visitor following the link would land on `/login`. That is acceptable, but it should be decided.
