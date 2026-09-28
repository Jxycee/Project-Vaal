# Build Page — Slice 3 (Checkpoint Switcher) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Checkpoints are managed from the header's checkpoint switcher. Adding, renaming, reordering and deleting happen there in edit mode; the full-screen test-grade `CheckpointsSheet` leaves the build page. The edit-mode header is compacted too (slice 2's known polish item).

**Architecture:** `CheckpointSwitcher` gains an edit-mode "Manage" view inside its menu: one row per checkpoint with switch, rename (inline), up/down and two-tap delete, plus an "Add checkpoint" form (a copy of the checkpoint being edited, unsaved edits included). Every write goes through the existing Server Functions in `src/app/(dashboard)/builds/checkpointActions.ts` (unchanged). The logic moves out of `CheckpointsSheet` into a small hook, `useCheckpointActions`, so the sheet (still used by the scratch `/tree` editor until slice 7) and the switcher share one implementation.

**Tech Stack:** Next.js 16.2.9, React, TypeScript, Tailwind, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md` §3 decision 6, §6.4, §10 slice 3.

## Global Constraints

- Everything in slices 1 and 2 still binds: mobile-first; **no horizontal scroll at 375px**; every button, link and input ≥ 44px; tabs switch by pushState; a checkpoint switch is a `<Link>`/`router.push` server navigation that remounts the session; the keyed remount stays load-bearing; no `window.confirm`.
- Switching checkpoints with unsaved changes: tree, gear and gems are already kept by the per-checkpoint draft. The menu shows the line "Unsaved changes stay as a draft on this checkpoint." above the list while `dirty`. Name, level, league and notes are not drafted (slice 2 ruling), so the line also says "Save first to keep name and notes changes." when meta is what's dirty. Read `dirty` and add a `metaDirty` to the session value if needed.
- The database refuses to delete a build's last checkpoint (a trigger). Surface its error in the menu (`role="alert"`) and never pre-empt it silently.
- Reader mode is unchanged: the menu lists checkpoints to switch to, with no management.
- Checkpoint label: show the checkpoint's name, followed by `· Lvl N` only if the name doesn't already contain that level number (avoids "Lvl 20 · Level 20").
- The menu is a dropdown, `max-h-[70dvh] overflow-y-auto`. At 375px it must stay fully on screen from both the header and the compact bar (slice 1 `align` prop).

## Review Focus

1. **Add while dirty:** the new checkpoint must copy the CURRENT session state (unsaved tree, gear and gems), exactly as `CheckpointsSheet` passes `currentState` today. Task 1 test "add copies unsaved edits".
2. **Delete the active checkpoint:** the page must land on another checkpoint (the server rewrites an unknown `?checkpoint=` to the first by position), with no crash and no stale session. Task 1 test.
3. **Reorder then reload:** the order persists, and the page stays on the same checkpoint (owner URLs name the checkpoint). Task 1 test.
4. **Rename to empty or whitespace:** the Server Function rejects it; show its error. Task 1 test.
5. **The menu at 375px with 8 checkpoints in manage view:** no horizontal overflow, 44px targets, scrollable. Task 1 test, on the imported 8-checkpoint fixture.

---

### Task 1: E2E first — `e2e/build-page-checkpoints.spec.ts` (fails now)

Seed with the 8-checkpoint PoB fixture (copy `importFixture` from `e2e/build-page.spec.ts`; the import lands on the build page now, per the slice 2 helper change). `test.use({ viewport: { width: 375, height: 812 } })`, mobile only, serial, `afterAll(cleanupWithFreshPage)`.

Contract (later tasks render it): in edit mode the switcher menu (`checkpoint-menu`) has a button **"Manage"**, which toggles to **"Done managing"**, for the manage view (`data-testid="checkpoint-manager"`). Rows are `data-testid="checkpoint-row"` with `data-checkpoint-id`. Per row: the switch link (`checkpoint-option`), and buttons **"Rename"**, `aria-label="Move <name> up"`, `aria-label="Move <name> down"`, and **"Delete"** (which becomes **"Confirm delete"** after the first tap). The rename input is `aria-label="New checkpoint name"` with **"Save name"** and **"Cancel"**. The add form uses `aria-label="Checkpoint name"`, `aria-label="Checkpoint level"` and the button **"Add checkpoint"**. Errors appear in `role="alert"` inside the menu.

Tests:
1. **manage view fits a phone.** Owner `?edit=1`, open the switcher, tap Manage: 8 `checkpoint-row`; no horizontal overflow; `measureTapTargets('[data-testid="checkpoint-menu"]')` scanned ≥ 8 and tooSmall = []; every row's bounding box lies within 0..375.
2. **reorder persists and the page stays put.** Note the active checkpoint id from the URL. Move the LAST row up once. Reload: its position changed (read the rows' `data-checkpoint-id` order before and after), and the URL still has the same `checkpoint=` id.
3. **rename.** Rename the second row to `Mapping`, Save name, and the row text contains `Mapping` after a reload. Then rename it to `   `: the alert is visible, and after a reload the name is still `Mapping`.
4. **add copies unsaved edits.** On the Tree tab in edit mode, allocate 1 unallocated node (filter out allocated ids, as `draft-and-auth.spec.ts:65` does). Don't save. Open the switcher → Manage → Add checkpoint with name `Copy test` and level 50 → the page navigates to the new checkpoint (the URL `checkpoint=` changes). Its tree contains the unsaved node (read it with the `__vaalTree` hook on the Tree tab). The header level line reads `Level 50`.
5. **delete the active checkpoint.** On the `Copy test` checkpoint: Manage → Delete → Confirm delete → the page lands on a different checkpoint whose id is in the remaining rows, and the row count is back to 8.
6. **the last checkpoint cannot be deleted.** Use a fresh scratch-saved build (one checkpoint). Manage → Delete → Confirm delete → alert visible, and the row is still present after a reload.
7. **dirty hint.** In edit mode, change League without saving, then open the switcher: the text "Save first to keep name and notes changes." is visible. Make a tree edit instead (after Done → Discard): "Unsaved changes stay as a draft on this checkpoint." is visible.

Run it; expect failures at the missing "Manage" button. Commit `test(e2e): checkpoint management in the switcher (fails until slice 3 lands)`.

### Task 2: `useCheckpointActions` hook, shared by the sheet and the switcher

Create `src/components/build/useCheckpointActions.ts`, extracted from `CheckpointsSheet.tsx`'s `run`, `move`, rename, delete (two-tap arming) and add logic, with the same Server Functions and `callAction` usage. Signature:

```ts
export function useCheckpointActions(opts: {
  buildId: string;
  checkpoints: BuildCheckpoint[];
  activeId: string | undefined;
  currentState: CheckpointStateInput | null;
  checkpointHref: (id: string | null) => string;
  onNavigate?: () => void; // e.g. close the menu
}): {
  pending: boolean;
  error: string | null;
  goTo(id: string): void;
  move(index: number, delta: -1 | 1): void;
  rename(id: string, name: string, onDone?: () => void): void;
  armedDeleteId: string | null;
  requestDelete(id: string): void; // first call arms, second deletes
  add(name: string, level: number): void; // navigates to the new checkpoint on success
};
```

`CheckpointsSheet` switches to the hook with no behaviour change. Its existing test ids stay, so the old scratch editor and any spec still using it keep working. After reorder, rename or delete, `router.refresh()` so the list re-reads. Check whether the sheet relies on revalidation instead, and keep whichever the sheet does today. Verify with `npx playwright test e2e/checkpoints.spec.ts --project=mobile` (still green), then type-check, lint and unit tests. Commit `refactor(checkpoints): share the actions between the sheet and the switcher`.

### Task 3: manage view in `CheckpointSwitcher`, dirty hint, label rule

- New props: `manage?: { buildId, fullCheckpoints, currentState, currentLevel, dirty, metaDirty }`. It is present only in owner edit mode, and BuildPage passes it from the session.
- In the menu, when `manage` is present: a "Manage" toggle, with the manage view as specified in Task 1's contract (inline rename, two-tap delete, add form with the level defaulting to the session's `meta.level`), and errors in `role="alert"`. Outside manage view, the menu lists switch links as today.
- The dirty hint lines above the list, as in Global Constraints.
- The label rule, as in Global Constraints (also applies in reader mode).
- Remove the "Manage checkpoints" entry and the `CheckpointsSheet` usage from the build page. Update `e2e/helpers.ts` `openEditor(page, 'checkpoints')` so that on the build page it opens the switcher and taps Manage, and returns the `checkpoint-manager` locator. Update any spec that used the sheet on the build page (`checkpoints.spec.ts`) to the new ids. Change the mechanism only, never the meaning.
- Session: if `metaDirty` isn't exposed, add it (`meta` differs from baseline meta) next to `dirty` in `sessionTypes.ts` and `BuildSession.tsx`.

Verify with `npx playwright test e2e/build-page-checkpoints.spec.ts e2e/checkpoints.spec.ts e2e/build-page.spec.ts e2e/build-page-edit.spec.ts --project=mobile`, then type-check, lint and unit tests. Commit `feat(build-page): manage checkpoints from the switcher`.

### Task 4: compact edit header

In `BuildHeader.tsx` edit mode, level and league share one row (`grid grid-cols-[6rem_1fr] gap-2`). Name stays full width. Labels stay visible. The Done button stays top-right. Target: at 375px the edit header is ≤ 60% of the viewport height with the 8-checkpoint fixture. Measure `header.getBoundingClientRect().height` in a new assertion in `build-page-edit.spec.ts`'s 375px test, pinned to ≤ 0.6 × 812. Verify with that spec, type-check and lint. Commit `feat(build-page): compact edit header`.

### Task 5: full suite, review, merge (controller)

Full suite in the controller's own shell, followed by type-check, lint, unit tests and build. Then a final Sonnet review, an update to `CURRENT-STATE.md`, and a merge and push (code plus docs).
