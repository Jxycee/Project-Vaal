# Build Page — Slice 4 (Gear Paper Doll) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Gear tab shows the build's equipment as a paper doll: in-game arrangement, a Set I / Set II toggle, a detail panel for the tapped slot, and collapsed warnings. In edit mode, tapping a slot lets the owner choose, edit or clear the item in place. The full-screen gear list leaves the build page.

**Architecture:** A pure layout module (`src/lib/build/paperDoll.ts`) defines two grids: phone (6 columns) and desktop (8×8, from `specs/2026-09-23-paper-doll-layout-research.md`). Each slot's cell position is set through CSS custom properties, so one DOM switches layout at `md:`. `PaperDoll` renders the cells. The tapped slot opens `GearSlotDetail` below the doll. In edit mode, the detail's buttons open the existing standalone `ItemPickerSheet` (choose) and `ItemEditorSheet` (affixes), and write through the session's `setGearSlot`. `GearSheet` stays for the scratch `/tree` editor until slice 7.

**Tech Stack:** Next.js 16.2.9, React, TypeScript, Tailwind v4 (arbitrary properties), Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-27-build-profile-redesign-design.md` §3 decision 9, §5.2 (Gear row), §5.4, §10 slice 4. Layout research: `docs/superpowers/specs/2026-09-23-paper-doll-layout-research.md`.

## Global Constraints

- Slices 1–3 still bind: mobile-first; **no horizontal scroll at 375px**; every button and link ≥ 44 × 44px; tabs switch by pushState; session mutators are no-ops for non-owners; no `window.confirm`.
- **Placeholder visuals only.** Neutral cell frames (`border-border bg-card/40`), item icons (plain `<img>`, auth-gated path) and a text label. No GGG or Mobalytics slot art, frames, colours or numbered badges (`AGENTS.md`; the research spec's "Constraint" section).
- Phone layout, 6 columns. A 1×1 slot must measure ≥ 44px at 375px: with a 16px gutter and 6px gaps, a cell is (343 − 30) / 6 ≈ 52px.
  - Doll: weapon c1–2 r1–4, head c3–4 r1–2, off-hand c5–6 r1–4, body c3–4 r3–5, gloves c1–2 r5, boots c5–6 r5.
  - Accessory row: r6 ring1 c1, amulet c2, ring2 c3, belt c4, flask1 c5, flask2 c6.
  - Charm row: r7 charm1 c1, charm2 c2, charm3 c3.
- Desktop (md+) uses the 8×8 table from the research spec, verbatim (weapons c1/c7 r1 2×4, head c4 r1 2×2, amulet c6 r2, body c4 r3 2×3, ring1 c3 r4, ring2 c6 r4, belt c4 r6 2×1, gloves c1 r5 2×2, boots c7 r5 2×2, flasks c1 and c2 r7 1×2, charms c4, c5 and c6 r7), capped at about `max-w-xl` so cells don't balloon.
- The weapon set toggle defaults to the build's headline set (`headlineSet`). Weapon cells show `weapon{set}_main` / `weapon{set}_off`.
- An empty off-hand that a two-hander occupies shows "Occupied by <name>" (dimmed) and keeps `data-testid="gear-occupied-<slot>"`. Reuse the session's `offHandOccupied`.
- Keep the existing per-slot test ids so specs migrate by mechanism only: `gear-warning-<slot>`, `gear-note-<slot>`, `gear-craft-<slot>`, `gear-occupied-<slot>`. New: `doll-slot-<slot>` on each cell button, `gear-slot-detail` on the detail panel, `gear-warnings` on the collapsed warnings chip or list.
- Warnings: one chip `⚠ n` (or `ⓘ n` for notes only) above the doll. It expands to the full list, with each item keeping `data-testid="build-warning"` and `data-severity`. A cell with a warning shows a small marker inside its own bounds.
- Jewels stay below the doll as today (list, plus "Edit jewels" in edit mode).

## Review Focus

1. **A 1×1 cell at 375px** (ring, amulet, charm) under 44px, or the doll overflowing sideways. Task 1 test measures every `doll-slot-*`.
2. **Set toggle:** the weapon cells must show the chosen set's items, and choosing an item into a weapon cell must write to that set's slot (`weapon2_main` when Set II is showing). Task 1 test.
3. **Edit round trip without the old sheet:** choose boots, add an affix in the editor, save, reload. The doll shows the boots, and `gear-craft-boots` shows the summary. Task 1 test.
4. **A reader tapping a cell** gets the detail panel only, with no choose, edit or clear controls. Task 1 test (read-mode visit).
5. **The warnings chip** hides nothing permanently: its count equals the number of `build-warning` items once expanded. Task 1 test using the imported fixture (which has warnings).

---

### Task 1: E2E first — `e2e/build-page-gear.spec.ts` (fails now)

Seed with the 8-checkpoint PoB fixture (copy `importFixture` from `e2e/build-page.spec.ts`), go to its last checkpoint (deep link `?checkpoint=<last id>` via the switcher's `checkpoint-option`s), and pin `test.use({ viewport: { width: 375, height: 812 } })`. Mobile only, serial, `afterAll(cleanupWithFreshPage)`. Tests:
1. **the doll fits a phone:** Gear tab, 15 `doll-slot-*` cells visible (13 fixed + 2 weapon). Every cell box is ≥ 44 × 44 and inside 0..375. No horizontal overflow. Pair it with a positive: at least one cell has an `img`.
2. **set toggle:** read `doll-slot-weapon1_main`'s text with Set I showing. Toggle Set II, and the weapon cells now have test ids `doll-slot-weapon2_main` / `doll-slot-weapon2_off`, with the `weapon1_*` ids gone.
3. **detail panel (reader-like read mode, no edit):** tap `doll-slot-body` → `gear-slot-detail` is visible and contains the body item's name. No "Choose item" / "Edit affixes" / "Clear" buttons.
4. **warnings chip:** `gear-warnings` shows a count n > 0. After expanding, `build-warning` count = n.
5. **edit round trip:** `?edit=1&tab=gear`, tap `doll-slot-boots` → Choose item → pick the first result (copy `pickFirstItem` from `sharing.spec.ts`, adapted to the picker opened from the detail panel) → the boots cell shows its name → Edit affixes → the item editor opens (`data-testid="item-editor"`) → close it. Save and wait for `save-status` `/^Saved /`. Reload `?tab=gear` (read): `doll-slot-boots` contains the name.
6. **choosing into Set II writes weapon2:** edit mode, Set II, tap `doll-slot-weapon2_main` → Choose item → pick first. Save, reload, Set II: `doll-slot-weapon2_main` shows the new item. Pair it: Set I's weapon cell is unchanged from the value read in test 2.
7. **clear:** edit mode, tap the boots → Clear → the cell reads Empty → Save → reload → Empty.

Run it and expect a failure at the first `doll-slot-*`. Commit `test(e2e): gear paper doll (fails until slice 4 lands)`.

### Task 2: `src/lib/build/paperDoll.ts` + unit tests (write the tests first)

```ts
export type DollCell = { col: number; row: number; w: number; h: number };
export type DollSlotKey = Exclude<GearSlot, 'weapon2_main' | 'weapon2_off' | 'weapon1_main' | 'weapon1_off'> | 'weapon_main' | 'weapon_off';
export const PHONE_DOLL: { cols: 6; rows: 7; cells: Record<DollSlotKey, DollCell> };
export const DESKTOP_DOLL: { cols: 8; rows: 8; cells: Record<DollSlotKey, DollCell> };
export function dollSlot(key: DollSlotKey, set: WeaponSet): GearSlot; // weapon_main + 2 → 'weapon2_main'
export const DOLL_KEYS: readonly DollSlotKey[]; // render order: weapons, head, body, gloves, boots, then accessories
```

Tests (these are the ways the layout can be wrong):
- Each layout places every key exactly once.
- No two cells overlap (check the covered cell sets).
- Every cell lies inside `cols × rows`.
- `dollSlot` maps both sets correctly and passes non-weapon keys through.
- `DOLL_KEYS` ∪ weapon mapping covers every `GEAR_SLOTS` entry for each set.
- The desktop table equals the research spec's table.

Commit `feat(gear): paper doll layout tables`.

### Task 3: `PaperDoll`, `GearSlotDetail`, Gear tab integration, E2E migration

- `src/components/buildpage/gear/PaperDoll.tsx`: the Set I / II toggle (buttons `h-11`, labels "Set I" / "Set II"), then a grid whose cells use inline CSS variables (`--pc --pr --pw --ph` for phone, `--dc --dr --dw --dh` for desktop) with classes `[grid-column:var(--pc)/span_var(--pw)] [grid-row:var(--pr)/span_var(--ph)] md:[grid-column:var(--dc)/span_var(--dw)] md:[grid-row:var(--dr)/span_var(--dh)]`. The grid template: `grid-cols-6 md:grid-cols-8 gap-1.5`. **Check that Tailwind v4 generates these arbitrary properties** by measuring cell positions in the E2E, not by eye.
  - Each cell is a `<button data-testid="doll-slot-<slot>" aria-label="<label>: <name or Empty>" aria-pressed={selected}>` showing the icon (object-contain) and, when the cell is big enough, the label. A warning or note marker sits in the corner.
- `src/components/buildpage/gear/GearSlotDetail.tsx`: the selected slot's label, item name (plus Unique), rarity/craft summary (`gear-craft-<slot>`), the slot's warnings, and "Occupied by …" when that applies. In edit mode it adds the buttons **Choose item**, **Edit affixes** (item only) and **Clear** (item only). They open `ItemPickerSheet` (keyed by slot, as GearSheet does) and `ItemEditorSheet`, and write via `setGearSlot`.
- `GearTab.tsx`: warnings chip (`gear-warnings`, expandable), the doll, the detail, then jewels. Remove the "Edit gear" button and the `GearSheet` usage from the build page.
- `e2e/helpers.ts`: `openEditor(page, 'gear')` on the build page now selects the Gear tab and returns the doll. Add `pickGearItem(page, slot, name?)`, which works on both UIs (scratch: GearSheet row → picker; build page: doll cell → Choose item → picker). Migrate the build-page callers (`loadout-persistence`, `item-craft`, `validation`, `sharing` where they apply) by mechanism only, keeping every assertion's meaning.

Verify the gear spec, those four specs, `build-page` and `build-page-edit` on mobile, then type-check, lint and unit tests. Commit `feat(build-page): gear paper doll`.

### Task 4: full suite, review, merge (controller)

Same as earlier slices: full suite in the controller's shell, then build, a Sonnet final review, `CURRENT-STATE.md`, and merge and push.
