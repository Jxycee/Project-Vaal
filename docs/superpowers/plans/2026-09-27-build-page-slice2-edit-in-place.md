# Build Page — Slice 2 (Edit in Place) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The owner edits a saved build on its own page (`/builds/[shareToken]?edit=1`). One build-and-checkpoint session drives every tab, unsaved work survives tab switches, reloads and checkpoint switches, and `/tree?build=` redirects to the new page.

**Architecture:** Lift everything `TreeBuildSession` owns (tree, gear, gems, level, name, league, notes, drafts, save, validation, stats) into a React context provider, `BuildSession`, rendered by `BuildPage` (already keyed by checkpoint, so the provider remounts per checkpoint exactly as the old keyed session did). **The tree state lives in the provider**, seeded from the saved checkpoint without needing the tree export. `PassiveTree` is seeded from the provider's current state each time it mounts and writes back through `onStateChange`, so save and drafts never depend on the Tree tab having been opened. Edit mode is `?edit=1` (owner only), toggled with `history.replaceState`. The existing Gear, Jewels, Gems and Checkpoints sheets become the editors, opened from their tabs; slices 3–5 replace them.

**Tech Stack:** Next.js 16.2.9 App Router, React, TypeScript, Tailwind, Supabase, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md` §6 (edit mode and session), §7.2 (redirect), §10 slice 2.

## Global Constraints

- Everything in slice 1's Global Constraints still binds (mobile-first, no horizontal scroll at 375px, 44px targets, tabs via `pushState`, checkpoints via `<Link>`, visibility vocabulary, security invariants, plain `<img>` for wiki icons, no prettier / npm install, one `next dev` per directory).
- **The keyed remount stays load-bearing.** One session per build + checkpoint; tab switches inside it, never across it.
- **Save body is unchanged** from `TreeBuildSession.tsx`'s `handleSave`, including "always send `gear_state`, `gem_state`, `main_skill`, `notes`" (`POST /api/builds` writes only keys present).
- **Drafts are unchanged** in key (`vaal:tree-draft:<buildId>:<checkpointId>`) and shape (`BuildDraftState`). They are read in a lazy `useState` initialiser, before any effect can overwrite them. A draft that is only an echo of the saved build must not prompt (`draftDiffersFrom`).
- Drafts and saves happen only in **owner** mode. A reader's session never writes localStorage and never calls the API.
- Edit mode for a non-owner: `?edit=1` is ignored, no edit controls render, and the server still refuses writes (existing `POST /api/builds` ownership rule).
- Scratch `/tree` (no `?build=`) keeps the old `TreeEditor` UI until slice 7. Do not delete `TreeEditor`, `TreeBuildSession` or `BuildSavePanel`.
- E2E: the build-persistence and loadout-persistence scenarios are the protected data-loss suite. They must pass, moved to the new page where they touch a saved build.

## Review Focus

1. **Gear-only edit, Tree tab never opened, Save, reload.** Today save returns early without a tree report. Here it must save gear AND leave the tree exactly as it was (not empty). Task 1 test "gear edit without opening the tree".
2. **Tree edit → another tab → back to Tree.** The allocation must still be there (PassiveTree remounts from session state). Task 1 test "tree survives tab switches".
3. **Draft echo.** Opening an owner build in edit mode and doing nothing must not show "Unsaved changes from last time" on the next visit. Task 1 test "no bogus restore prompt".
4. **Discard.** It must reset gear, gems, tree, name, level, league and notes, and the draft must be gone after a reload. Task 1 test "Done → Discard".
5. **Save while an edit is in flight.** Edits made after the save sent its body must stay in the draft (today's `latestSession` rule). Kept by porting that code verbatim. Task 2 notes it, and the plan reviewer checks it.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `e2e/build-page-edit.spec.ts` | Create | Slice 2 E2E (written first) |
| `e2e/helpers.ts` | Modify | `openBuildEditor`, `openEditor(section)`, and `saveBuild` working on the build page |
| affected specs (`build-persistence`, `loadout-persistence`, `checkpoints`, `item-craft`, `pob-import`, `stats`, `validation`, `cross-site`, `sharing`, `draft-and-auth`) | Modify | Follow the redirect to the build page where they reopen a saved build |
| `src/components/buildpage/session/BuildSession.tsx` | Create | Provider + `useBuildSession()`: all build-scoped state, drafts, save, derived data |
| `src/components/buildpage/session/sessionTypes.ts` | Create | Context value type |
| `src/components/buildpage/BuildPage.tsx` | Modify | Wrap in provider; read state from session; edit mode |
| `src/components/buildpage/BuildHeader.tsx` | Modify | Edit toggle, inputs, Save/Done, draft notice, discard choice |
| `src/components/buildpage/tabs/*` | Modify | Read from session; edit entry points; Tree tab editable |
| `src/components/buildpage/EditBar.tsx` | Create | Sticky Save/Done row while editing (phone) |
| `src/components/build/CheckpointsSheet.tsx` | Modify | `checkpointHref` prop instead of hard-coded `/tree?build=` |
| `src/app/(dashboard)/builds/[shareToken]/page.tsx` | Modify | Pass full checkpoints (owner) for CheckpointsSheet |
| `src/app/(dashboard)/tree/page.tsx` | Modify | Owner `?build=` → redirect to the build page |

---

### Task 1: E2E for edit in place (written first, fails)

**Files:** Create `e2e/build-page-edit.spec.ts`.

**Contract (ids later tasks render):**
- Edit toggle: link/button named **"Edit"** (owner, read mode) that sets `?edit=1`. In edit mode, a button named **"Done"**, and a **Save** button (`role=button`, name `Save`).
- Status `data-testid="save-status"`: text `Saved HH:MM:SS` after a save, `Unsaved changes` while dirty.
- Header inputs `#build-name`, `#build-level`, `#build-league`. Overview `#build-notes` (textarea) in edit mode.
- Discard choice (Done while dirty): buttons **"Save"**, **"Discard"** and **"Keep editing"**, inside `data-testid="unsaved-choice"`.
- Draft notice `data-testid="draft-notice"` with buttons **"Restore"** and **"Discard"**.
- Gear tab (edit): button **"Edit gear"** opens the existing gear sheet (`.z-40`, "Close gear sheet"). Button **"Edit jewels"** opens the jewels sheet.
- Skills tab (edit): button **"Edit skills"** opens the gems sheet.
- Tree tab (edit): editable `PassiveTree` (the dev hook `window.__vaalTree` installs).
- Checkpoint switcher, edit mode: extra menu entry **"Manage checkpoints"** opens `CheckpointsSheet` (`data-testid="checkpoints-sheet"`).

- [ ] **Step 1: Write the spec.** Seed builds through the scratch editor, which still exists. Use `openTree(page)`, allocate a few nodes with `allocateNodes(page, await nodesNearStart(page, 5))`, and save with `saveBuild(page, { name, level: 20, league: 'Standard' })`. That creates a row and stays on `/tree`. Read the new build id from the save response: `page.waitForResponse(r => r.url().endsWith('/api/builds') && r.request().method() === 'POST')` → `(await res.json()).build`, which carries `id` and `share_token`. Then visit `/builds/<share_token>?edit=1`. Tests (serial describe, `test.use({ viewport: { width: 375, height: 812 } })`, mobile only, `afterAll(cleanupWithFreshPage)`):

  1. **gear edit without opening the tree.** On `?edit=1&tab=gear`, click "Edit gear", pick the first Boots item (copy `pickFirstItem` from `sharing.spec.ts`), close the sheet, click Save, and wait for `save-status` `/^Saved /`. Reload `/builds/<token>?tab=gear` (read mode). The Gear tab contains the boots name. **And** the tree is unchanged: open the Tree tab, wait for `window.__vaalTree`, and `treeState(page).allocated.length` equals the count seeded above (≥ 5). If save ever wrote an empty tree, this fails.
  2. **tree survives tab switches.** `?edit=1&tab=tree`, wait for the hook, allocate 3 more nodes (`nodesNearStart`), switch to Gear, then back to Tree, wait for the hook: allocated count = before + 3. Then change the League input to `Hardcore`, Save, reload `?tab=tree`: allocated count persists; header `p` contains `Hardcore`.
  3. **no bogus restore prompt.** Open `?edit=1`, wait 2s, open a new page on the same URL: `draft-notice` is not visible. Pair it with a positive: edit `#build-notes` (type "draft check") WITHOUT saving, wait for the draft (`waitForDraft(page, buildId, checkpointId)`, with the checkpoint id read from the URL), reload: `draft-notice` visible, click Restore, `#build-notes` has "draft check". Then Done → `unsaved-choice` → Discard. Reload: no `draft-notice`, and `#build-notes` (edit) is empty.
  4. **non-owner cannot edit (URL tampering).** The suite has one account, so prove it at the component contract: visit `/builds/<token>?edit=1` after switching the build to Public, and the owner sees edit controls (positive). Then check the reader path's refusal: `page.request.post('/api/builds', { data: { id: '<a uuid that is not ours>', name: 'x', class: 'Witch', … } })` → 404, the existing ownership rule, asserted like `api-contracts.spec.ts`. Reuse its request shape; read that spec for the minimal valid body.
  5. **/tree?build= redirects.** `page.goto('/tree?build=<id>')` → URL becomes `/builds/<token>` with `tab=tree`, `edit=1` and `checkpoint=`. `/tree?build=00000000-0000-0000-0000-000000000000` → stays on `/tree` and shows "That build could not be found."
  6. **375px while editing.** On `?edit=1`, for each tab except Tree: no horizontal overflow; `measureTapTargets('[data-testid="build-page"]')` scanned > 0, tooSmall = [].

- [ ] **Step 2:** Run `npx playwright test e2e/build-page-edit.spec.ts --project=mobile`. Expected: FAILS at the first `?edit=1` interaction (no "Edit gear" button). Commit `test(e2e): build page edit in place (fails until slice 2 lands)`.

---

### Task 2: `BuildSession` provider

**Files:** Create `src/components/buildpage/session/sessionTypes.ts` and `src/components/buildpage/session/BuildSession.tsx`.

**Interfaces — Produces:**

```ts
// sessionTypes.ts
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { BuildEditorState, PassiveState } from '@/lib/build/types';
import type { GearItem, GearSlot } from '@/lib/build/gearSlots';
import type { GearState } from '@/lib/build/gearState';
import type { GemState } from '@/lib/build/gemState';
import type { BuildWarning } from '@/lib/build/validate';
import type { JewelSocketView, JewelOrphan } from '@/lib/build/jewelState';
import type { ReservedSpiritResult } from '@/components/build/useReservedSpirit';
import type { Sheets } from '../HeaderStats';

export interface BuildMeta { name: string; level: number; league: string; notes: string }

export interface BuildSessionValue {
  canEdit: boolean;                       // owner
  tree: GggTreeJson | null;               // the export, when loaded
  treeError: string | null;
  treeState: BuildEditorState;            // always present (seeded from the checkpoint)
  treeSeedKey: number;                    // bump => PassiveTree must remount and re-seed
  livePassive: PassiveState;
  gear: GearState;
  gems: GemState;
  meta: BuildMeta;
  // derived
  warnings: readonly BuildWarning[];
  offHandOccupied: Record<WeaponSet, GearItem | null>;
  jewels: { sockets: JewelSocketView[]; orphans: JewelOrphan[] } | null; // null until the tree export loads
  sheets: Sheets;
  reserved: ReservedSpiritResult | null;
  // editing
  dirty: boolean;
  saving: boolean;
  saveError: string | null;
  savedAt: string | null;
  draftPromptOpen: boolean;
  setTreeState(next: BuildEditorState): void;
  setMeta(patch: Partial<BuildMeta>): void;
  setGearSlot(slot: GearSlot, item: GearItem | null): void;
  pickJewel(socketId: string, item: GearItem): void;
  clearJewel(socketId: string): void;
  gemActions: { add(): void; remove(id: string): void; setSkill(id: string, item: GearItem | null): void; addSupport(id: string, item: GearItem): void; removeSupport(id: string, index: number): void; setSets(id: string, sets: readonly WeaponSet[]): void; setPrimary(id: string): void; setLevel(id: string, level: number): void; setQuality(id: string, quality: number): void };
  save(): Promise<boolean>;               // true on success
  discard(): void;                        // back to the last saved state, draft cleared, tree re-seeded
  restoreDraft(): void;
  dismissDraft(): void;                   // "Discard" on the draft notice
}
```

Use the real type names. Check what `summarizeJewels` returns (`src/lib/build/jewelState.ts:51`) and which types `JewelsSheet` takes (`sockets`, `orphans`). If they are named differently, use those names and adjust this interface. Same for `BuildWarning` (the `warnings` prop type of `GearSheet`).

**Implementation rules (port from `TreeBuildSession.tsx`, same order and comments where they still apply):**

- Props: `{ canEdit: boolean; row: SharedBuildRow; checkpointId: string | undefined; tree: GggTreeJson | null; treeError: string | null; children: ReactNode }`. `row` is already the active checkpoint's view (the page substitutes state and level).
- **Seed** (lazy `useState` initialisers, once per mount, which is safe because BuildPage is keyed by checkpoint):
  - `treeState`: `{ classId: -1, className: row.class, ascendancyId: row.ascendancy ?? undefined, ...fromPassiveState(parsePassiveState(row.passive_state)) }`. `classId` is a placeholder until PassiveTree reports. It is safe because nothing reads `classId` except PassiveTree (which seeds by name) and `draft.ts`'s type guard (which only checks it is a number). Say so in a comment.
  - `gear = parseGearState(row.gear_state)`, `gems = parseGemState(row.gem_state)`, `meta = { name: row.name, level: row.level, league: row.league, notes: row.notes ?? '' }`.
  - `baseline` (state): what was last saved, as `{ class, ascendancy, passive_state, gear_state, gem_state, meta }`, initialised from `row`. After a successful save it becomes the sent snapshot.
- **Draft read** in a lazy initialiser: `canEdit ? loadDraft(row.id, checkpointId) : null`. `draftPromptOpen` = `stored !== null && draftDiffersFrom(stored, baselineAsBuild)`.
- **Draft write** effect (owner only): whenever `treeState`, `gear` or `gems` change, `saveDraft(row.id, { tree: treeState, gear, gem: gems }, checkpointId)` and update `latestSession.current`. Meta is not in the draft today. Keep it that way: name, level, league and notes are protected by the dirty guard, not by drafts. Note this deviation from `BuildDraftState` scope in the report.
- **dirty** = `draftDiffersFrom({tree: treeState, gear, gem: gems}, baselineAsBuild) || meta differs from baseline.meta`.
- **setTreeState**: ignore reports while `canEdit` is false. A read-only PassiveTree also reports its seeded state on mount, and a reader must never drift.
- **save()**: only when `canEdit`. Body exactly as `TreeBuildSession.handleSave`: `id: row.id`, `checkpoint_id: checkpointId`, `name/level/league/notes` from meta, `class: treeState.className`, `ascendancy: treeState.ascendancyId ?? null`, `passive_state: toPassiveState(...)`, `gear_state`, `gem_state`, `main_skill: deriveMainSkill(gems)`. On success: set `savedAt` to `new Date().toLocaleTimeString()`, set baseline to the SENT snapshot (not current state), clear the draft only if nothing changed since sending (port `latestSession` exactly), then `router.refresh()`. Return true. On failure set `saveError` (`payload.error ?? 'Could not save this build.'`, or the network message from TreeBuildSession) and return false.
- **discard()**: reset treeState, gear, gems and meta from baseline, `clearDraft`, bump `treeSeedKey`, close the draft prompt.
- **restoreDraft()**: apply stored tree, gear and gems, bump `treeSeedKey`, close the prompt. **dismissDraft()**: `clearDraft`, close the prompt.
- Derived data, exactly as TreeBuildSession derives it: `livePassive = toPassiveState(treeState.main, treeState.ascendancyNodes, treeState.attributeChoices)`, `craftData = useCraftData(gear)`, `warnings = validateCheckpoint({ passive: livePassive, gear, craftData })`, `offHandOccupied` via `offHandOccupiedBy`, `jewels = tree ? summarizeJewels(tree, treeState.main.allocated, gear.jewels) : null`, `defence = useDefenceSheets({ tree, className: treeState.className, level: meta.level, passive: livePassive, gear })`, `sheets = treeError ? { error: treeError } : defence`, `reserved = useReservedSpirit(gems)`.
- The gem handlers are exactly TreeBuildSession's, including the `fetchMaxGemLevel` clamp on skill swap.
- `useBuildSession()` throws a clear error outside the provider.

- [ ] **Step 1:** Write both files. **Step 2:** `npm run type-check && npm run lint`. **Step 3:** Commit `feat(build-page): BuildSession provider owns the build's state`.

---

### Task 3: BuildPage reads from the session (read mode parity)

**Files:** Modify `BuildPage.tsx`, `BuildHeader.tsx`, `HeaderStats` callers, `tabs/*`, and the server `page.tsx` (full checkpoints for the owner).

- `BuildPage`: `const edit = mode === 'owner' && searchParams.get('edit') === '1'`. Render `<BuildSession canEdit={mode === 'owner'} row={row} checkpointId={activeCheckpointId} tree={tree} treeError={treeError}>`, and put everything below it in an inner component `BuildPageBody` that reads `useBuildSession()`. Remove the direct `parse*`, `useDefenceSheets` and `useReservedSpirit` calls from BuildPage (the session owns them now).
- Tabs and header read `gear`, `gems`, `treeState`/`livePassive`, `meta` (name, level and league in the header; notes in Overview), `sheets` and `reserved` from the session, so an unsaved edit shows everywhere at once.
- `TreeTab`: `initialState` = session `treeState` (className, ascendancyId, main, ascendancyNodes, attributeChoices), `key={treeSeedKey}`, `readOnly={!edit}`, `onStateChange={edit ? setTreeState : undefined}`, `level={meta.level}`.
- Server `page.tsx`: also pass `fullCheckpoints={loaded.mode === 'owner' ? checkpoints : []}` (the `BuildCheckpoint[]` the CheckpointsSheet needs). Add it to `BuildPageProps`.

- [ ] Verify: `npx playwright test e2e/build-page.spec.ts --project=mobile` stays 6/6 (read mode unchanged). Commit `refactor(build-page): tabs and header read from the session`.

---

### Task 4: Edit mode UI

**Files:** `BuildHeader.tsx`, `EditBar.tsx` (new), `tabs/OverviewTab.tsx`, `tabs/GearTab.tsx`, `tabs/SkillsTab.tsx`, `CheckpointSwitcher.tsx`, `BuildPage.tsx`, `CheckpointsSheet.tsx`.

- **Edit toggle.** In read mode the owner's "Edit" is a `<button>` that sets `edit=1` with `history.replaceState` (via `patchQuery`), not a link to `/tree`. In edit mode it becomes "Done". Done while `!dirty` removes `edit`. Done while `dirty` shows `unsaved-choice` inline under the header, with Save (save, then leave edit mode on success), Discard (`discard()`, then leave edit mode) and Keep editing (close the choice). No `window.confirm`.
- **Header inputs** (edit mode): name `#build-name` (text), level `#build-level` (number 1–100, clamp on blur like BuildSavePanel), league `#build-league` (text). All `h-11`, and they wrap at 375px. Class and ascendancy stay read-only text here; they change on the Tree tab.
- **EditBar** (edit mode): sticky under the tab strip. It holds `save-status` (`Saving…` / `Saved HH:MM:SS` / `Unsaved changes` / the save error in `role="alert"`) and a primary **Save** button (disabled while saving or when not dirty). On `md:` it can sit inline in the header row instead. Keep one Save button in the DOM at a time.
- **Draft notice** (`draft-notice`): under the header when `draftPromptOpen`, with Restore and Discard.
- **Overview** (edit): notes becomes `<textarea id="build-notes">` bound to `meta.notes` (`min-h-32`). Empty-state text becomes a hint.
- **Gear tab** (edit): above the list, buttons **Edit gear** (opens `GearSheet` with `gear`, `warnings`, `occupiedBy={offHandOccupied}`, `onChange={setGearSlot}`) and **Edit jewels** (opens `JewelsSheet` with `jewels.sockets`/`orphans`, `onPick={pickJewel}`, `onClear={clearJewel}`; disabled with the text "Loading tree…" while `jewels` is null).
- **Skills tab** (edit): button **Edit skills** opens `GemsSheet`, wired to `gemActions` exactly as TreeBuildSession wires it.
- **Checkpoint switcher** (edit): a last menu entry **Manage checkpoints** opens `CheckpointsSheet` with `buildId=row.id`, `loadedWithBuild`, `checkpoints={fullCheckpoints}`, `activeId`, `currentLevel={meta.level}`, `currentState={{ passive_state: livePassive, gear_state: gear, gem_state: gems }}`, and the new `checkpointHref`.
- **CheckpointsSheet**: add a prop `checkpointHref: (checkpointId: string | null) => string` and use it for the `router.push` (line ~85) and the `<a href>` (line ~133). `null` means "the build without a checkpoint". The build page passes `(id) => '/builds/<token>' + patchQuery(location.search, { checkpoint: id })`. `TreeBuildSession` (scratch/old editor) passes today's `/tree?build=` URLs, so it is unchanged.
- **Leaving edit mode by navigating** (checkpoint switch, tab links): nothing special. The draft keeps tree, gear and gems, as it does today.

- [ ] Verify: `npx playwright test e2e/build-page-edit.spec.ts e2e/build-page.spec.ts --project=mobile`. Tests 1–3 and 6 of the edit spec should pass now; 4–5 need Task 5. Commit `feat(build-page): edit in place`.

---

### Task 5: `/tree?build=` redirect and the E2E migration

**Files:** `src/app/(dashboard)/tree/page.tsx`, `e2e/helpers.ts`, the affected specs.

- `tree/page.tsx`: when the build is the caller's and `share_token` is not null, `redirect('/builds/' + token + patchQuery('', { tab: 'tree', edit: '1', checkpoint: checkpointParam /* or the resolved first checkpoint */ }))`. Resolve the checkpoint the way the page does today (`activeCheckpoint`). Otherwise (not ours, missing, bad id, null token) behave exactly as today.
- `helpers.ts`:
  - `openTree(page, buildId)` with a buildId now lands on the build page's Tree tab in edit mode via the redirect. Keep the function, and make it wait for `window.__vaalTree` as before.
  - Add `openEditor(page, section: 'gear' | 'jewels' | 'gems' | 'stats' | 'checkpoints')`. It works on BOTH UIs: on `/tree` it clicks the old chips (`Gear`, `/^Jewels/`, `/^Gems/`, `Stats`, `/^Checkpoints/`). On `/builds/` it selects the matching tab and clicks "Edit gear" / "Edit jewels" / "Edit skills". For `stats` it selects the Stats tab (no sheet, so callers read `stats-panel` instead of `stats-sheet`). For `checkpoints` it opens the switcher and clicks "Manage checkpoints".
  - `saveBuild(page, opts)` works on both. On `/builds/` it fills `#build-name`/`#build-level`/`#build-league`, fills `#build-notes` after selecting Overview, clicks Save, and waits for `save-status` `/^Saved /`. On `/tree` it behaves as today.
  - `gotoBuilds`, `listedBuildNames` and `cleanupTestBuilds` keep keying on `/builds` rows' `a[href^="/tree?build="]`. MyBuildsList is unchanged in this slice.
- Specs: run each affected spec. Where one fails because it now lands on the build page, switch it to the helpers above. Change the mechanism only, never the assertion's meaning. Specs to run: `build-persistence`, `loadout-persistence`, `checkpoints`, `item-craft`, `pob-import`, `stats`, `validation`, `cross-site`, `sharing`, `draft-and-auth`.

- [ ] Verify: each spec alone, then Task 6. Commit `feat(build-page): /tree?build= opens the build page; e2e follows`.

---

### Task 6: Full suite, build, review, merge

- Stop any server on 3000. Run `npm run test:e2e` **in the foreground** (a background run dies with its shell and fakes `0xC0000142` failures). Then `npm run type-check`, `npm run lint`, `npm test`, `npm run build`.
- Controller: a final branch review (Sonnet) focused on Review Focus 1–5 and data loss. Then update `CURRENT-STATE.md` (build page editing, redirect, the E2E helpers) and merge and push (code plus docs).
