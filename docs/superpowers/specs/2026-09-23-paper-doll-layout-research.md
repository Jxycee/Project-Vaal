# Paper-Doll Equipment Layout — Research

**Date:** 2026-09-23
**Status:** Input for the user-driven UI pass (`/design`), not a decision. Nothing here is built.

The gear editor is a flat list of 17 slots. Competitors (Mobalytics, poe.ninja) and the game's own inventory use a "paper doll": weapon left, off-hand right, helmet/body/belt down the centre, rings beside the body, amulet upper-right, gloves and boots in the lower corners, flasks and charms along the bottom, with a Set 1 / Set 2 weapon-swap toggle. The question was whether any data source provides that layout so it can be imported rather than hand-coded.

## Verdict

**No importable source exists.** The layout is a small hand-written table: slot arrangement taken from the game's own inventory convention, footprints from well-known item sizes. No source we own, extract or could license provides slot geometry.

## What was checked

Researched by a subagent; the controller then re-checked the one claim it had not verified (grid overlaps, below).

| Source | Provides layout? | Detail |
|---|---|---|
| `@poe2-toolkit/*` (our GGPK extraction) | **No** | No `Inventories`/`InventoryId`/`ItemInventory` table exported. `item-extractor` reads `BaseItemTypes` but only `Name, ItemClass, ItemVisualIdentity, DropLevel, ModDomain, Tags` — **no `Width`/`Height`**. `source.table(name)` is untyped, so those columns might exist in the raw `.dat64`, but nothing extracts them today and that is unverified. |
| Our item files' `iconWidth`/`iconHeight` | **No** | Icon-render bounding boxes, not grid footprints. They fall into ~7 presets and do not track real sizes: a One Hand Sword (in-game 1×3) and a Body Armour (2×3) both report 86×128. |
| Path of Building 2 `src/Classes/ItemsTab.lua` | **No** | Its slot controls are anchored top-to-bottom — a vertical list, like ours today. No x/y or w/h geometry. |
| GGG character API (`Item` type) | **Partly, wrong shape** | An equipped item carries `inventoryId, x, y, w, h` — per-item footprint of a fetched character's actual gear. Nothing describes where the amulet *slot* sits. |
| `poe2-tools/poe2-build-planner` (MIT) | **No** | Responsive card grid (`repeat(auto-fit, minmax(220px,1fr))`), not a paper doll. |

## Constraint (AGENTS.md)

Following the slot **arrangement** is fine: it mirrors the game's own inventory, not any competitor's design. Copying a competitor's **styling** is not — Mobalytics' colours, slot frame art, borders and numbered badges are theirs. Item icons are the one GGG art we use, and we already hold them.

## Proposed grid

An 8×8 cell grid. Footprints are game convention (weapon 2×4, body 2×3, helmet/gloves/boots 2×2, belt 2×1, ring/amulet/charm 1×1, flask 1×2) — **not extracted data**. Positions are hand-placed to follow the in-game arrangement.

| Slot | Col | Row | W | H |
|---|---|---|---|---|
| `weapon1_main` / `weapon2_main` | 1 | 1 | 2 | 4 |
| `weapon1_off` / `weapon2_off` | 7 | 1 | 2 | 4 |
| `head` | 4 | 1 | 2 | 2 |
| `amulet` | 6 | 2 | 1 | 1 |
| `body` | 4 | 3 | 2 | 3 |
| `ring1` | 3 | 4 | 1 | 1 |
| `ring2` | 6 | 4 | 1 | 1 |
| `belt` | 4 | 6 | 2 | 1 |
| `gloves` | 1 | 5 | 2 | 2 |
| `boots` | 7 | 5 | 2 | 2 |
| `flask1` | 1 | 7 | 1 | 2 |
| `flask2` | 2 | 7 | 1 | 2 |
| `charm1` | 4 | 7 | 1 | 1 |
| `charm2` | 5 | 7 | 1 | 1 |
| `charm3` | 6 | 7 | 1 | 1 |

The two weapon sets share cells by design; the Set 1 / Set 2 toggle chooses which is shown, matching the `weapon1_*` / `weapon2_*` split already in `gearSlots.ts`.

**Verified by the controller:** a script over this table found **no overlapping cells**, and a grid extent of exactly 8×8.

## Open questions for the design pass

1. **375px.** An 8-column grid at 375px gives ~40px cells before gaps, and a 1×1 ring slot then misses the 44px tap-target floor that `mobile-layout.spec.ts` enforces. The paper doll may need to be desktop-only, with the current list kept on mobile — or cells sized so 1×1 slots clear 44px and the grid scrolls. The project is mobile-first, so this needs deciding before building.
2. **True PoE2 footprints.** If exact per-base sizes ever matter (e.g. a one-hand sword drawn 1×3 inside a 2×4 weapon box), `BaseItemTypes` `Width`/`Height` would need extracting through `@poe2-toolkit`. Unverified that PoE2's `.dat64` has those columns.
3. **A third ring slot.** PoB2's slot model and GGG's inventory data both carry `Ring 3` (see `specs/2026-09-23-pob2-decode-findings.md`). We model two. Still unconfirmed as a live game feature.
