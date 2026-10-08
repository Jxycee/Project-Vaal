// src/lib/build/paperDoll.ts
// =============================================================================
// Pure layout tables for the Gear tab's paper doll (Slice 4). No React, no
// fetch — just where each slot sits on a phone-width grid and a desktop grid,
// and the weapon-set indirection the doll's Set I / Set II toggle needs.
//
// Slot arrangement follows the game's own inventory convention (AGENTS.md's
// "GGG art use" constraint: arrangement is fine, competitor STYLING is not).
// Positions are hand-placed, not derived from any data source — see
// docs/superpowers/specs/2026-09-23-paper-doll-layout-research.md, "Verdict."
// The desktop table is that research spec's "Proposed grid" table, verbatim.
// The phone table is the build plan's Global Constraints section, verbatim —
// docs/superpowers/plans/2026-09-28-build-page-slice4-paper-doll.md.
// =============================================================================

import type { WeaponSet } from '@poe2-toolkit/tree-core';
import type { GearSlot } from './gearSlots';

/** One cell's position on a doll grid. 1-indexed, matching CSS grid-column/-row lines. */
export interface DollCell {
  col: number;
  row: number;
  w: number;
  h: number;
}

/**
 * The doll's slot vocabulary: every `GearSlot` except the four weapon slots,
 * which collapse into one `weapon_main` / `weapon_off` pair the Set I / Set
 * II toggle resolves through `dollSlot` below — both sets share the same two
 * cells on the grid, exactly as the tree's set1/set2 share the same nodes.
 */
export type DollSlotKey =
  | Exclude<GearSlot, 'weapon2_main' | 'weapon2_off' | 'weapon1_main' | 'weapon1_off'>
  | 'weapon_main'
  | 'weapon_off';

/**
 * Render order: weapons, head, body, gloves, boots, then the accessory/charm
 * row — task-2-brief.md's required order. Also the full slot vocabulary each
 * `*_DOLL.cells` table must place exactly once (see the paperDoll.test.ts
 * "places every DOLL_KEYS entry exactly once" check).
 */
export const DOLL_KEYS: readonly DollSlotKey[] = [
  'weapon_main',
  'weapon_off',
  'head',
  'body',
  'gloves',
  'boots',
  'amulet',
  'ring1',
  'ring2',
  'ring3',
  'belt',
  'flask1',
  'flask2',
  'charm1',
  'charm2',
  'charm3',
];

/**
 * Phone grid, 6 columns x 7 rows. A 1x1 cell (ring/amulet/charm) at 375px
 * with a 16px gutter and 6px gaps measures (343 - 30) / 6 ≈ 52px — clears the
 * 44px tap-target floor. See the plan's Global Constraints section for the
 * exact per-slot placement this table encodes.
 */
export const PHONE_DOLL: { cols: 6; rows: 7; cells: Record<DollSlotKey, DollCell> } = {
  cols: 6,
  rows: 7,
  cells: {
    weapon_main: { col: 1, row: 1, w: 2, h: 4 },
    head: { col: 3, row: 1, w: 2, h: 2 },
    weapon_off: { col: 5, row: 1, w: 2, h: 4 },
    body: { col: 3, row: 3, w: 2, h: 3 },
    gloves: { col: 1, row: 5, w: 2, h: 1 },
    boots: { col: 5, row: 5, w: 2, h: 1 },
    ring1: { col: 1, row: 6, w: 1, h: 1 },
    amulet: { col: 2, row: 6, w: 1, h: 1 },
    ring2: { col: 3, row: 6, w: 1, h: 1 },
    ring3: { col: 4, row: 7, w: 1, h: 1 },
    belt: { col: 4, row: 6, w: 1, h: 1 },
    flask1: { col: 5, row: 6, w: 1, h: 1 },
    flask2: { col: 6, row: 6, w: 1, h: 1 },
    charm1: { col: 1, row: 7, w: 1, h: 1 },
    charm2: { col: 2, row: 7, w: 1, h: 1 },
    charm3: { col: 3, row: 7, w: 1, h: 1 },
  },
};

/**
 * Desktop (md+) grid, 8 columns x 8 rows — the research spec's "Proposed
 * grid" table, verbatim. Not extracted data; footprints follow game
 * convention (weapon 2x4, body 2x3, helmet/gloves/boots 2x2, belt 2x1,
 * ring/amulet/charm 1x1, flask 1x2).
 */
export const DESKTOP_DOLL: { cols: 8; rows: 8; cells: Record<DollSlotKey, DollCell> } = {
  cols: 8,
  rows: 8,
  cells: {
    weapon_main: { col: 1, row: 1, w: 2, h: 4 },
    weapon_off: { col: 7, row: 1, w: 2, h: 4 },
    head: { col: 4, row: 1, w: 2, h: 2 },
    amulet: { col: 6, row: 2, w: 1, h: 1 },
    body: { col: 4, row: 3, w: 2, h: 3 },
    ring1: { col: 3, row: 4, w: 1, h: 1 },
    ring2: { col: 6, row: 4, w: 1, h: 1 },
    ring3: { col: 3, row: 3, w: 1, h: 1 },
    belt: { col: 4, row: 6, w: 2, h: 1 },
    gloves: { col: 1, row: 5, w: 2, h: 2 },
    boots: { col: 7, row: 5, w: 2, h: 2 },
    flask1: { col: 1, row: 7, w: 1, h: 2 },
    flask2: { col: 2, row: 7, w: 1, h: 2 },
    charm1: { col: 4, row: 7, w: 1, h: 1 },
    charm2: { col: 5, row: 7, w: 1, h: 1 },
    charm3: { col: 6, row: 7, w: 1, h: 1 },
  },
};

/**
 * A doll key -> the real `GearSlot` for the weapon set currently showing.
 * `weapon_main`/`weapon_off` resolve to `weapon{set}_main`/`weapon{set}_off`;
 * every other key already IS a `GearSlot` and passes through unchanged,
 * regardless of `set` — this is deliberate: the doll never has two different
 * cells sharing one non-weapon key, so there is nothing for `set` to select
 * between there.
 */
export function dollSlot(key: DollSlotKey, set: WeaponSet): GearSlot {
  if (key === 'weapon_main') return set === 1 ? 'weapon1_main' : 'weapon2_main';
  if (key === 'weapon_off') return set === 1 ? 'weapon1_off' : 'weapon2_off';
  return key as GearSlot;
}
