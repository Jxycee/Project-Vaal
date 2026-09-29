# Build Page — Slice 7b (Scratch Planner on the Build Page; Retire the Old Editor) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/tree` without `?build=` ("Quick plan") renders the same build page shell in edit mode, with no saved row behind it. The first Save creates the build and moves to `/builds/<token>?edit=1`, keeping the current tab. The old overlay editor (`TreeEditor`, `TreeBuildSession`, `BuildSavePanel`, the chip components and the full-screen sheets nothing uses any more) is deleted. Two deferred slice 7a minors are fixed.

**Architecture:** `BuildSession` gains a scratch mode. It gets a synthesized empty row, and `save()` POSTs without an `id` (the existing scratch path of `POST /api/builds`, whose response carries the new row and `share_token`). On success it calls `router.replace` to the new build page. Drafts use the existing scratch key (`draftKey(undefined)` → `vaal:tree-draft:scratch`). The scratch draft is cleared after the first save, except when edits happened while the save was in flight (the existing `latestSession` rule). A new client component `ScratchBuildPage` renders the build page body with no checkpoints, no settings menu and no share link.

**Tech Stack:** Next.js 16.2.9 App Router, React, TypeScript, Tailwind v4, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md` §7.3, §10 slice 7 (second half).

## Global Constraints

- Earlier slices still bind: mobile-first; no horizontal scroll at 375px; 44px targets; tabs by pushState; drafts only while editing (scratch is always editing); no `window.confirm`.
- **Scratch row:** `name ''`, `class` = the first playable class (the one PassiveTree picks by default today: "first class with ascendancies"; use the same rule), `ascendancy null`, `level 1`, `league 'Standard'`, `notes null`, empty passive, gear and gem state, `visibility 'unlisted'`. `id` and `share_token` are absent: make the session accept a `scratch: true` flag instead of fake ids. The header shows "Untitled build" until a name is typed. Save is disabled until the name is non-empty; show the hint "Name your build to save it".
- **Scratch UI:** no checkpoint switcher, no ⋯ settings, no Copy link, no Done/view mode (scratch is always editing). Every tab works. The Tree tab's class and ascendancy pickers work as today.
- **First save:** `POST /api/builds` with no `id` (the body shape `TreeBuildSession.handleSave` used in scratch mode). On success: clear the scratch draft (latestSession rule), then `router.replace('/builds/' + share_token + patchQuery('', { edit: '1', tab: <current tab or null> }))`. A double tap must never create two builds: use a ref-held in-flight guard, not render state.
- **Deleted:** `src/components/tree/TreeEditor.tsx`, `TreeBuildSession.tsx`, `BuildSavePanel.tsx`, `src/components/build/GearSheet.tsx`, `GemsSheet.tsx` (keep `GemLoadoutEditor`), `CheckpointsSheet.tsx` (keep `useCheckpointActions`), `JewelsChip.tsx` and `GemsChip.tsx`. `JewelsSheet.tsx` and `StatsSheet.tsx` are deleted only if nothing on the build page uses them: grep first. Keep `PassiveTree`, `TreeControls` and `NodeInfoPanel`.
- `/tree?build=` redirect behaviour is unchanged (slice 2).
- **Slice 7a minors, fixed here:**
  1. `NewBuildSheet`: guard create with a ref, so a double Enter creates one build.
  2. `BuildSettings` delete: `clearDraft(buildId, checkpointId)` for every checkpoint of the deleted build before navigating away. Use the full checkpoint list the owner page has.

## Review Focus

1. **Scratch → first save → the new build page.** Tree, gear, gems and meta all persisted. The URL is `/builds/<token>?edit=1` (with the tab kept). Reloading shows no draft prompt. Task 1 test.
2. **A double-tapped Save in scratch creates exactly one build.** Count the builds on `/builds` before and after. Task 1 test.
3. **Scratch draft:** unsaved scratch work plus a reload shows the Restore prompt, and Restore brings the tree back. After a successful first save, a visit to `/tree` shows no prompt. Task 1 test.
4. **No leftover imports of deleted components.** The build must be clean and type-check must pass. Task 3.
5. **Double Enter in New build** creates one build (Task 1 test), and deleting a build clears its drafts (Task 1 test: seed a draft for it, delete it, and `localStorage` has no `vaal:tree-draft:<id>` keys).

---

### Task 1: E2E first — `e2e/scratch-planner.spec.ts` (fails now)

Pin 375×812, mobile only, serial, `afterAll(cleanupWithFreshPage)`. Tests as in Review Focus 1–3 and 5. Name builds via `testBuildName`. Existing helpers: `openTree(page)` (scratch) waits for the tree hook, `allocateNodes`/`nodesNearStart` (filter out already-allocated ids), `saveBuild` (dual-mode; extend it for scratch). Run it once, quietly, and expect a failure at the first new behaviour. Commit `test(e2e): scratch planner on the build page (fails until slice 7b lands)`.

### Task 2: scratch mode

- `BuildSession`: add `scratch?: boolean`. When set, `row` is the synthesized scratch row, the draft key is scratch, `save()` does the create-then-replace above, and there's a ref-held in-flight guard. Keep every other rule.
- `src/components/buildpage/ScratchBuildPage.tsx`: the build page body in scratch mode, using the same tabs and header components with the scratch props.
- `src/app/(dashboard)/tree/page.tsx`: with no `?build=`, render `ScratchBuildPage` (in place of `TreeEditor`). With `?build=`, the owner redirect is unchanged. For not ours / missing / a bad id, render `ScratchBuildPage` with the existing notice "That build could not be found." above it (keep that exact text; `build-page-edit.spec` asserts it).
- Fix the two 7a minors.

Verify the scratch spec, then once, quietly, `build-page-edit`, `draft-and-auth`, `build-persistence` and `library`. Then type-check, lint and unit tests. Commit `feat(build-page): quick plan runs on the build page`.

### Task 3: delete the old editor and migrate the specs

Delete the files listed in Global Constraints (after grepping). Remove the old-UI branches from `e2e/helpers.ts` (`openEditor`, `saveBuild`, `pickGearItem`, `openGemGroup` now have one UI). Migrate any spec still driving the old chips or sheets on `/tree`: grep for `Save build`, `Saved build`, `Close gear sheet`, `Close gems sheet`, `checkpoints-sheet`, `#build-name` on `/tree`. Change the mechanism only. Also update `docs/superpowers/CURRENT-STATE.md` to say the old editor is gone.

Verify: `npm run build` (catches dangling imports), type-check, lint, unit tests, then once, quietly, every spec you changed. Commit `refactor: retire the old tree editor`.

### Task 4: full suite once, one review, merge (controller)
