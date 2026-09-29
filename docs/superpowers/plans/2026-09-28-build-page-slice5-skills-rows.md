# Build Page — Slice 5 (Skills Rows) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Skills tab shows gem groups as compact one-line rows, main skill first. Tapping a row shows its supports (read mode) or opens an editor for just that group (edit mode). The full-screen all-groups GemsSheet leaves the build page.

**Architecture:** Extract the per-loadout editor (`LoadoutCard` plus its picker wiring) from `GemsSheet.tsx` into `GemLoadoutEditor`. `GemsSheet` (the scratch `/tree` editor, until slice 7) renders it unchanged. A new `GemGroupSheet` renders it for one loadout. `SkillRows` renders the compact list from the session's `gems`. Every edit goes through the session's `gemActions`.

**Tech Stack:** Next.js 16.2.9, React, TypeScript, Tailwind v4, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md` §5.2 (Skills row), §10 slice 5.

## Global Constraints

- Earlier slices still bind: mobile-first; **no horizontal scroll at 375px**; every button, link and input ≥ 44 × 44; tabs switch by pushState; session mutators are no-ops for non-owners; no `window.confirm`; placeholder visuals only; wiki gem icons use plain `<img>`.
- **Row design.** One `<button data-testid="skill-row" data-loadout-id>` per loadout, at most **64px** tall at 375px. Its label (`aria-label`) is `<skill name or "Empty group">, level <n>, <k> supports`. It contains:
  - the skill icon (32px), the name (truncated), and `Lv n` (plus ` · q%` when quality > 0);
  - the supports as up to 5 icons of 20px each (no names on the row);
  - weapon-set dots (reuse `WEAPON_SET_DOT`) when the group is tied to one set;
  - a **Main** badge on the main skill's row (`mainSkillLoadout`).
- **Order:** `loadoutsMainFirst`.
- **Spirit line** at the top of the tab, unchanged from today (`reserved / spirit`, headline set).
- **Read mode:** tapping a row toggles an inline detail under it (`data-testid="skill-detail"`) listing support names with icons, plus level and quality. One detail is open at a time.
- **Edit mode:** tapping a row opens `GemGroupSheet` for that loadout (`data-testid="gem-group-sheet"`, portal, close button "Close skill group"). A button **"+ Add skill group"** calls `gemActions.add()` and opens the sheet on the new loadout. The sheet holds the full per-group editor, with the same controls and labels as today's LoadoutCard: skill picker, supports (+ Add support, remove), level and quality inputs, Set I/II toggles, Main skill, and Remove group. Removing the group closes the sheet.
- Keep today's GemsSheet control labels and aria-labels (for example "Remove skill 1", "Add support", "+ Add skill") inside `GemLoadoutEditor`, so the scratch editor and specs that drive GemsSheet keep working.

## Review Focus

1. **Add group → sheet → pick skill → Save → reload:** the row exists with that skill, and the main-skill order is right. Task 1 test.
2. **Level edit in the group sheet persists**, and the `fetchMaxGemLevel` clamp still applies on a skill swap (it lives in the session's `gemActions.setSkill`). Task 1 test (level change).
3. **Removing the main skill's group:** the Main badge moves to the next group with a skill (`deriveMainSkill` rule), and the order updates. Task 1 test.
4. **A reader** gets inline details only: no sheet and no add button. Task 1 test.
5. **Row height** ≤ 64px and no overflow at 375px with 5 supports and long names. Task 1 test (the fixture has 5-support groups).

---

### Task 1: E2E first — `e2e/build-page-skills.spec.ts` (fails now)

Seed with the 8-checkpoint PoB fixture, on its last checkpoint (5 skills, 20 gems). Pin 375×812, mobile only, serial, `afterAll(cleanupWithFreshPage)`. Tests:
1. **compact rows:** 5 `skill-row`s. Each has a bounding height ≤ 64 and fits within 0..375. There's no horizontal overflow. The first row contains "Main" and the header's `build-main-skill` text. `measureTapTargets('[data-testid="skills-tab"]')` scanned ≥ 5, tooSmall = [].
2. **read detail:** tapping row 2 shows `skill-detail` with ≥ 1 support name. Tapping row 3 moves the detail, so exactly 1 `skill-detail` is visible. No `gem-group-sheet`, and no "+ Add skill group" button.
3. **edit level:** `?edit=1&tab=skills`, tap row 1, and `gem-group-sheet` opens. Set the level input to a new value within the gem's cap (read the "/ max" text), close the sheet, Save, and wait for `save-status /^Saved /`. After a reload, the row's aria-label contains `level <new>`.
4. **add group:** "+ Add skill group" opens the sheet on an empty group. Pick the first skill from the picker (the picker pattern from `sharing.spec.ts`), close, Save, reload: 6 rows, and one of them has the picked name.
5. **remove the main group:** edit mode, tap the Main row, and "Remove" the group (the editor's remove-group control). Save and reload. Five rows remain, the removed skill's name is gone, and the Main badge now sits on the first row, whose name equals the header's `build-main-skill`.

Run it quietly (`--reporter=line`, filtered) and expect a failure at the first `skill-row`. Commit `test(e2e): compact skill rows (fails until slice 5 lands)`.

### Task 2: extract `GemLoadoutEditor` (no behaviour change)

Move `LoadoutCard` and its helpers (`useMaxGemLevel`, `GemIcon`, `toggleSet`) plus the picker wiring for one loadout (skill picker and support picker, as `GemsSheet` opens them) into `src/components/build/GemLoadoutEditor.tsx`. Its props are one loadout, its display index, `isPrimary`, and callbacks bound to that loadout's id. `GemsSheet` maps its loadouts through it. Keep every label, aria-label and test id identical. Verify with a quiet run of `e2e/loadout-persistence.spec.ts` (it drives the gems UI), then type-check and lint. Commit `refactor(gems): one-loadout editor shared by the sheet`.

### Task 3: `SkillRows`, `GemGroupSheet`, Skills tab, migration

- `src/components/buildpage/skills/SkillRows.tsx`, `SkillDetail`, and `src/components/buildpage/skills/GemGroupSheet.tsx` (portal at z-40, following JewelsSheet's shell pattern, with the close button "Close skill group"). They render `GemLoadoutEditor` for the chosen loadout id, wired to `gemActions` and `isPrimary` via `mainSkillLoadout`. If the loadout disappears (removed), the sheet closes.
- `SkillsTab.tsx`: the spirit line, "+ Add skill group" (edit only), then `SkillRows`. Remove "Edit skills" and the GemsSheet usage from the build page. Delete `ReadOnlyGemList.tsx` if nothing else uses it (grep).
- `e2e/helpers.ts`: `openEditor(page, 'gems')` on the build page selects the Skills tab and returns it. Add `openGemGroup(page, index)`, which works on the build page (tap row → sheet) and on the scratch editor (GemsSheet already open → the index-th card). Migrate build-page callers (`loadout-persistence`, `stats`, `validation`, `sharing`, `build-page`) by mechanism only.
- Verify with quiet runs: first the skills spec, then once `loadout-persistence stats validation sharing build-page build-page-edit`. Then type-check, lint and unit tests. Commit `feat(build-page): compact skill rows`.

### Task 4: full suite once, one review, merge (controller)

Same as slice 4. Test budget per `memory/test-usage-budget.md`.
