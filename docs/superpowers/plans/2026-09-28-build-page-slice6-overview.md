# Build Page — Slice 6 (Overview) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Overview tab reads like the build's front page. It shows the main skill group, key items as a compact icon grid, the checkpoints at a glance, and notes. Empty builds get calls to action instead of blank boxes.

**Architecture:** Only `src/components/buildpage/tabs/OverviewTab.tsx` and small subcomponents under `src/components/buildpage/overview/` change. All data comes from the session (`gems`, `gear`, `meta`, `mainSkillLoadout`, `keyItems`, `headlineSet`) plus the checkpoint list BuildPage already has. A CTA switches tab using the same pushState helper the tab strip uses. Extract a `selectTab(tab)` function from `BuildTabs.tsx` and reuse it.

**Tech Stack:** Next.js 16.2.9, React, TypeScript, Tailwind v4, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md` §5.2 (Overview row), §8.1 (empty-state CTAs), §10 slice 6.

## Global Constraints

- Earlier slices bind: mobile-first; no horizontal scroll at 375px; 44px targets; tabs via pushState only; no `window.confirm`; placeholder visuals; plain `<img>` for icons; mutators are owner-only.
- **Sections, in order:**
  1. **Main skill.** Icon, name, level and quality, then the supports as icon + name rows. The whole card is a button that opens the Skills tab.
  2. **Key items.** `keyItems(gear, headlineSet)` as a grid of 44px icon tiles, with the name under each (1 line, truncated). 4 columns on phone and 6 on md+. Each tile is a button that opens the Gear tab.
  3. **Checkpoints.** Shown only when there are 2 or more. One line per checkpoint, `name · Lvl n`, with the active one marked. Each is a `<Link>` to that checkpoint (server navigation, current tab kept).
  4. **Notes.** Read mode shows the full text, or "No notes yet." Edit mode shows the `#build-notes` textarea (keep the id).
- **Empty states** (read and edit):
  - No main skill: "No skills yet". Owners also get a **Pick your main skill** button that opens the Skills tab (and `?edit=1` if not already editing).
  - No key items: "No gear yet". Owners also get **Add gear**, which opens the Gear tab in edit mode.
  - Readers see only the plain text, with no CTA.
- **Height budget:** at 375×812, the Overview content above the Notes section is ≤ 1 screen (812px) for the 8-checkpoint fixture's last checkpoint. Some vertical scroll is fine; the budget keeps the page summary-like.

## Review Focus

1. **A CTA must not lose unsaved work.** Switching to edit mode or another tab happens in-page (pushState / replaceState, no remount). Task 1 test: edit notes, don't save, tap a CTA, and the notes value is still there.
2. **A reader never sees a CTA** that leads to edit mode. Task 1 test.
3. **A checkpoint link** from Overview lands on that checkpoint with the Overview tab kept. Task 1 test.
4. **The key-item grid** fits at 375px with long unique names. Task 1 test (no overflow, 44px tiles).
5. **An empty scratch-saved build** shows both CTAs to its owner. Task 1 test.

---

### Task 1: E2E first — `e2e/build-page-overview.spec.ts` (fails now)

Seed two builds: the 8-checkpoint PoB fixture (last checkpoint), and an empty scratch-saved build (seeded the way `build-page-edit.spec.ts` does it). Pin 375×812, mobile only, serial, `afterAll(cleanupWithFreshPage)`. Test ids: `overview-main-skill` (button), `overview-key-items` (grid), `overview-key-item` (tile buttons), `overview-checkpoints` (list), `overview-notes`, `overview-cta-skills`, `overview-cta-gear`. Tests:
1. **fixture overview:** the main skill card is visible, and tapping it selects the Skills tab. The key items grid has ≥ 1 tile, and every tile is ≥ 44px and inside 0..375. The checkpoints list shows 8 entries. The height from the top of `overview-tab` to the top of `overview-notes` is ≤ 812. No horizontal overflow.
2. **checkpoint link:** tap the 2nd checkpoint entry, and the URL `checkpoint=` changes, Overview stays selected, and the header level line changes.
3. **empty build, owner:** both CTAs are visible. `overview-cta-gear` → Gear tab in edit mode (the URL has `edit=1` and `tab=gear`, and the "Save" button exists).
4. **CTA keeps unsaved notes:** on the empty build in `?edit=1`, type into `#build-notes`, tap `overview-cta-skills` → Skills tab. Switch back to Overview, and the notes value is unchanged.
5. **owner in view mode:** on the empty build without `edit=1`, the CTAs are visible, and tapping `overview-cta-gear` enters edit mode (the URL gains `edit=1`). The suite has one account, so the reader rule ("no CTA for a non-owner") can't be driven end to end. Task 2 enforces it in code (CTAs render only when `canEdit`), and the final review verifies it.

Run quietly and expect a failure at the first new test id. Commit `test(e2e): overview front page (fails until slice 6 lands)`.

### Task 2: implement the Overview

As specified in Global Constraints. Extract `selectTab` from `BuildTabs.tsx` into `src/components/buildpage/tabNav.ts` (`selectTab(tab)` pushState, `enterEdit()` replaceState `edit=1`) and use it in both places. Verify the overview spec, then run `build-page.spec.ts` and `build-page-edit.spec.ts` once, quietly, then type-check, lint and unit tests. Commit `feat(build-page): overview front page`.

### Task 3: full suite once, one review, merge (controller)
