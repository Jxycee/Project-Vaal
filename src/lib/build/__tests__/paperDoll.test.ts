import { describe, it, expect } from 'vitest';
import { DESKTOP_DOLL, DOLL_KEYS, PHONE_DOLL, dollSlot, type DollCell, type DollSlotKey } from '../paperDoll';
import { GEAR_SLOTS, type GearSlot } from '../gearSlots';

// The ways this layout table can be wrong (task-2-brief.md): a slot missing
// or duplicated, two cells overlapping, a cell spilling outside the grid, the
// weapon-set mapping pointing at the wrong slot, or DOLL_KEYS silently
// dropping a real GEAR_SLOTS entry. Each `describe` below is one of those
// failure modes, not just a happy-path readout.

function coveredCells(cell: DollCell): Set<string> {
  const covered = new Set<string>();
  for (let c = cell.col; c < cell.col + cell.w; c++) {
    for (let r = cell.row; r < cell.row + cell.h; r++) {
      covered.add(`${c},${r}`);
    }
  }
  return covered;
}

const LAYOUTS = [
  { name: 'PHONE_DOLL', layout: PHONE_DOLL },
  { name: 'DESKTOP_DOLL', layout: DESKTOP_DOLL },
] as const;

describe.each(LAYOUTS)('$name', ({ layout }) => {
  it('places every DOLL_KEYS entry exactly once', () => {
    const keys = Object.keys(layout.cells).sort();
    expect(keys).toEqual([...DOLL_KEYS].sort());
  });

  it('has no two cells overlapping', () => {
    const seen = new Map<string, DollSlotKey>();
    for (const [key, cell] of Object.entries(layout.cells) as [DollSlotKey, DollCell][]) {
      for (const coord of coveredCells(cell)) {
        const owner = seen.get(coord);
        expect(owner, `${key} overlaps ${owner} at ${coord}`).toBeUndefined();
        seen.set(coord, key);
      }
    }
  });

  it('keeps every cell inside cols x rows', () => {
    for (const [key, cell] of Object.entries(layout.cells) as [DollSlotKey, DollCell][]) {
      expect(cell.col, `${key} col`).toBeGreaterThanOrEqual(1);
      expect(cell.row, `${key} row`).toBeGreaterThanOrEqual(1);
      expect(cell.col + cell.w - 1, `${key} right edge`).toBeLessThanOrEqual(layout.cols);
      expect(cell.row + cell.h - 1, `${key} bottom edge`).toBeLessThanOrEqual(layout.rows);
    }
  });
});

describe('dollSlot', () => {
  it('maps weapon_main/weapon_off to set 1 slots', () => {
    expect(dollSlot('weapon_main', 1)).toBe('weapon1_main');
    expect(dollSlot('weapon_off', 1)).toBe('weapon1_off');
  });

  it('passes every non-weapon key through unchanged, regardless of set', () => {
    const nonWeapon = DOLL_KEYS.filter((k) => k !== 'weapon_main' && k !== 'weapon_off');
    for (const key of nonWeapon) {
      expect(dollSlot(key, 1)).toBe(key);
      expect(dollSlot(key, 2)).toBe(key);
    }
  });
});

describe('DOLL_KEYS covers every GEAR_SLOTS entry, for both weapon sets', () => {

  it('the union across both sets equals GEAR_SLOTS exactly', () => {
    const union = new Set<GearSlot>([...DOLL_KEYS.map((k) => dollSlot(k, 1)), ...DOLL_KEYS.map((k) => dollSlot(k, 2))]);
    expect([...union].sort()).toEqual([...GEAR_SLOTS].sort());
  });

});
