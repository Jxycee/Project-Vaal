# Build Page — Slice 7a (Settings Menu, Library, Nav, New Build) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A build's settings (visibility, tags, rename, delete) live on the build page, in a ⋯ menu. `/builds` becomes a library of profile-style cards. "New build" is a small class → ascendancy → name sheet. Import lands on the new build's Overview. The nav loses "Tree".

**Architecture:** There's no new server code. The settings menu calls the existing Server Functions in `src/app/(dashboard)/builds/actions.ts` (`setBuildVisibility`, `addBuildTag`, `removeBuildTag`, `renameBuild`, `deleteBuild`). New build calls `POST /api/builds`, whose create response already returns the row, `share_token` included. Import calls `importPobBuild`, which must also return `share_token` (read it back from the insert). Library cards read columns the `/builds` page already selects, plus any it lacks (check `builds/page.tsx`'s select). They never read `passive_state`, `gear_state` or `gem_state`.

**Tech Stack:** Next.js 16.2.9 App Router, React, TypeScript, Tailwind v4, Supabase, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md` §5.1 (actions: ⋯ settings menu), §8.1–§8.4, §10 slice 7 (first half).

## Global Constraints

- Earlier slices bind: mobile-first; **no horizontal scroll at 375px**; 44px targets; tabs by pushState; no `window.confirm`; placeholder visuals; plain `<img>` for icons.
- **Visibility vocabulary unchanged:** `VISIBILITY_LABEL` / `VISIBILITY_HINT` from `src/lib/build/visibility.ts`. `unlisted` = owner only, `private` = anyone with the link. Keep the line "Switching to Unlisted disables this link immediately." next to the control. Do not "fix" the vocabulary.
- **Settings menu** (owner only, in both view and edit mode): a `⋯` button (`aria-label="Build settings"`) in `HeaderActions` opens a menu or sheet (`data-testid="build-settings"`). It contains:
  - **Visibility:** three radio-style buttons using the labels and hints above.
  - **Tags:** chips with remove buttons, plus an add input (`aria-label="New tag"`) and an "Add tag" button.
  - **Rename:** input (`aria-label="Build name"`) plus "Save name".
  - **Delete build:** two-tap, with the second button reading "Confirm delete". On success, navigate to `/builds`.
  - Errors show in `role="alert"`. After any change, `router.refresh()` so the header reflects it.
  - If edit mode is dirty, rename in this menu edits `meta.name` in the session instead of calling `renameBuild`, so the name has one source of truth while editing. When the page is not dirty or not in edit mode, the menu calls `renameBuild`.
- **Library cards** (`/builds`, the Mine tab): each card is ONE link to `/builds/<share_token>` (`data-testid="build-card"`). It shows:
  - the main skill's gem icon when its icon can be found cheaply, otherwise the class initial as a placeholder;
  - the name (2 lines max) and class · ascendancy · level;
  - the main skill name and league · "updated n ago";
  - a visibility badge and tags.
  No rename, delete, visibility, tag or copy controls on the card. The Public tab uses the same card with the author in place of the visibility badge.
- **Page actions on `/builds`:** "+ New build" (opens the sheet), "Import" (the existing import sheet), and "Quick plan" (a link to `/tree`).
- **New build sheet** (`data-testid="new-build-sheet"`):
  1. Class: a grid of the 8 classes, each a 44px+ button named after the class. The list must match what the tree offers; read it the way TreeControls or PassiveTree gets class names, without loading the 5 MB tree export. If the only source is the export, use a small static list from the same data source (`src/lib/tree/ascendancyNames.ts` or similar) and say where it came from.
  2. Ascendancy (optional): that class's ascendancies.
  3. Name (required, `aria-label="Build name"`).
  4. **Create build** → `POST /api/builds` with empty state → navigate to `/builds/<share_token>?edit=1`, which opens on Overview.
  A link "or import from Path of Building" switches to the import form.
- **Import:** on success, navigate to `/builds/<share_token>?edit=1` (Overview). The sheet shows the one-screen summary first, with the report behind "Show details". Drop "(test UI)" from the title.
- **Nav:** remove Tree from `NAV` in `src/components/layout/shell-chrome.tsx`. `/tree` highlights Builds.

## Review Focus

1. **Deleting from the settings menu** must go through `deleteBuild` (which re-checks ownership) and land on `/builds`. The deleted build's link then 404s. Task 1 test.
2. **Switching visibility to Unlisted** from the menu revokes the link for readers. Prove it at the RPC, as `sharing.spec.ts` does, and pair it with the owner still opening the page. Task 1 test.
3. **Renaming while edit mode is dirty** must not fork the name: the menu writes `meta.name` and the next Save persists it. Task 1 test.
4. **New build** lands on its Overview in edit mode, with the chosen class and ascendancy in the header, and a reload shows it saved. Task 1 test.
5. **Library cards** never render management controls, and every card links to a page that opens. Task 1 test (tap targets, count, link targets).

---

### Task 1: E2E first (fails now)

Two new specs, both pinned to 375×812, mobile only, serial, `afterAll(cleanupWithFreshPage)`:
- `e2e/build-settings.spec.ts`: visibility (all three states, the reader revocation proved at the RPC, the owner still sees the page), tags add and remove (visible after a reload), rename from view mode, rename while edit mode is dirty (the name appears after Save and a reload), and delete (lands on `/builds`, and the old URL shows "Build not found").
- `e2e/library.spec.ts`: cards (count ≥ 2 after seeding two builds; each card is one link to `/builds/`; no Rename, Delete or Copy buttons and no combobox inside `/builds`' Mine list; tap targets ≥ 44). The new build sheet (class → ascendancy → name → lands on `/builds/<token>` with `edit=1`, and the header shows the class/ascendancy text). Import lands on the build page. The nav has no "Tree" link (`nav a[href="/tree"]` count 0 in both navs), and "Quick plan" links to `/tree`.

Run each once, quietly, and expect failures at the first new id. Commit `test(e2e): settings menu, library cards, new build (fail until slice 7a lands)`.

### Task 2: settings menu

`src/components/buildpage/BuildSettings.tsx`, wired into `HeaderActions` (owner) and fed from the server page (visibility, tags and name are already in `row` / `tags`). Owner tags: `load.ts` already loads them for the owner path. Verify the settings spec quietly, then type-check and lint. Commit `feat(build-page): build settings menu`.

### Task 3: library cards, new build, import landing, nav

Rewrite `MyBuildsList.tsx` into cards (keep the file or replace it; update `builds/page.tsx`). Add `NewBuildSheet.tsx`. Update `ImportSheet.tsx` (landing, summary-first, title) and `importActions.ts` (return `share_token`). Update `BuildFinder.tsx` to the card. Remove Tree from `shell-chrome.tsx` NAV. Verify the library spec quietly, then type-check and lint. Commit `feat(builds): library cards, new build sheet, import lands on the build`.

### Task 4: migrate the E2E helpers and specs

The cards no longer carry `a[href^="/tree?build="]`, delete buttons or the visibility combobox. Update `e2e/helpers.ts`:
- `gotoBuilds` waits for `build-card` or the empty state.
- `listedBuildNames` reads the card names.
- `cleanupTestBuilds` opens each `E2E-` card → ⋯ Build settings → Delete → Confirm delete.
- A shared `readShareToken(page, name)` reads the card's href.
- `setVisibility(page, token, v)` goes through the settings menu.

Replace the per-spec copies of `readShareToken` and `importFixture` (several specs carry their own) with the helpers. Change the mechanism only. Run once, quietly: every spec that used `/builds` rows (grep `combobox`, `a[href^="/tree?build="]`, `readShareToken`, `Import from PoB`). Then type-check and lint. Commit `test(e2e): helpers follow the library cards and settings menu`.

### Task 5: full suite once, one review, merge (controller)
