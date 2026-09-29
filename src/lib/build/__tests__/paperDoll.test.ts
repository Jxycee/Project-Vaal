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

describe('PHONE_DOLL / DESKTOP_DOLL extents', () => {
  it('PHONE_DOLL is 6x7', () => {
    expect(PHONE_DOLL.cols).toBe(6);
    expect(PHONE_DOLL.rows).toBe(7);
  });

  it('DESKTOP_DOLL is 8x8', () => {
    expect(DESKTOP_DOLL.cols).toBe(8);
    expect(DESKTOP_DOLL.rows).toBe(8);
  });

  // docs/superpowers/specs/2026-09-23-paper-doll-layout-research.md, "Proposed
  // grid" table, verbatim — the plan requires this exact table, not a
  // re-derivation of it.
  it('DESKTOP_DOLL matches the research spec table exactly', () => {
    const expected: Record<DollSlotKey, DollCell> = {
      weapon_main: { col: 1, row: 1, w: 2, h: 4 },
      weapon_off: { col: 7, row: 1, w: 2, h: 4 },
      head: { col: 4, row: 1, w: 2, h: 2 },
      amulet: { col: 6, row: 2, w: 1, h: 1 },
      body: { col: 4, row: 3, w: 2, h: 3 },
      ring1: { col: 3, row: 4, w: 1, h: 1 },
      ring2: { col: 6, row: 4, w: 1, h: 1 },
      belt: { col: 4, row: 6, w: 2, h: 1 },
      gloves: { col: 1, row: 5, w: 2, h: 2 },
      boots: { col: 7, row: 5, w: 2, h: 2 },
      flask1: { col: 1, row: 7, w: 1, h: 2 },
      flask2: { col: 2, row: 7, w: 1, h: 2 },
      charm1: { col: 4, row: 7, w: 1, h: 1 },
      charm2: { col: 5, row: 7, w: 1, h: 1 },
      charm3: { col: 6, row: 7, w: 1, h: 1 },
    };
    expect(DESKTOP_DOLL.cells).toEqual(expected);
  });

  // Global Constraints' phone table, verbatim.
  it('PHONE_DOLL matches the plan\'s phone table exactly', () => {
    const expected: Record<DollSlotKey, DollCell> = {
      weapon_main: { col: 1, row: 1, w: 2, h: 4 },
      head: { col: 3, row: 1, w: 2, h: 2 },
      weapon_off: { col: 5, row: 1, w: 2, h: 4 },
      body: { col: 3, row: 3, w: 2, h: 3 },
      gloves: { col: 1, row: 5, w: 2, h: 1 },
      boots: { col: 5, row: 5, w: 2, h: 1 },
      ring1: { col: 1, row: 6, w: 1, h: 1 },
      amulet: { col: 2, row: 6, w: 1, h: 1 },
      ring2: { col: 3, row: 6, w: 1, h: 1 },
      belt: { col: 4, row: 6, w: 1, h: 1 },
      flask1: { col: 5, row: 6, w: 1, h: 1 },
      flask2: { col: 6, row: 6, w: 1, h: 1 },
      charm1: { col: 1, row: 7, w: 1, h: 1 },
      charm2: { col: 2, row: 7, w: 1, h: 1 },
      charm3: { col: 3, row: 7, w: 1, h: 1 },
    };
    expect(PHONE_DOLL.cells).toEqual(expected);
  });
});

describe('dollSlot', () => {
  it('maps weapon_main/weapon_off to set 1 slots', () => {
    expect(dollSlot('weapon_main', 1)).toBe('weapon1_main');
    expect(dollSlot('weapon_off', 1)).toBe('weapon1_off');
  });

  it('maps weapon_main/weapon_off to set 2 slots', () => {
    expect(dollSlot('weapon_main', 2)).toBe('weapon2_main');
    expect(dollSlot('weapon_off', 2)).toBe('weapon2_off');
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
  // DOLL_KEYS has 15 entries (13 fixed + weapon_main/weapon_off), one fewer
  // pair than GEAR_SLOTS' 17 (4 weapon slots): a single `set` only ever
  // resolves the doll's shared weapon cells to ONE set's slots at a time —
  // that is the whole point of the toggle. So a set can only ever cover 15
  // of the 17 real slots; the union across both sets is what must equal
  // GEAR_SLOTS exactly.
  it('set 1 alone covers every non-weapon slot plus its own two weapon slots', () => {
    const mapped = new Set(DOLL_KEYS.map((k) => dollSlot(k, 1)));
    expect(mapped.has('weapon1_main')).toBe(true);
    expect(mapped.has('weapon1_off')).toBe(true);
    expect(mapped.has('weapon2_main')).toBe(false);
    expect(mapped.has('weapon2_off')).toBe(false);
    expect(mapped.size).toBe(DOLL_KEYS.length);
  });

  it('set 2 alone covers every non-weapon slot plus its own two weapon slots', () => {
    const mapped = new Set(DOLL_KEYS.map((k) => dollSlot(k, 2)));
    expect(mapped.has('weapon2_main')).toBe(true);
    expect(mapped.has('weapon2_off')).toBe(true);
    expect(mapped.has('weapon1_main')).toBe(false);
    expect(mapped.has('weapon1_off')).toBe(false);
    expect(mapped.size).toBe(DOLL_KEYS.length);
  });

  it('the union across both sets equals GEAR_SLOTS exactly', () => {
    const union = new Set<GearSlot>([...DOLL_KEYS.map((k) => dollSlot(k, 1)), ...DOLL_KEYS.map((k) => dollSlot(k, 2))]);
    expect([...union].sort()).toEqual([...GEAR_SLOTS].sort());
  });

  it('render order is weapons, head, body, gloves, boots, then accessories', () => {
    expect(DOLL_KEYS.slice(0, 6)).toEqual(['weapon_main', 'weapon_off', 'head', 'body', 'gloves', 'boots']);
    const rest = new Set(DOLL_KEYS.slice(6));
    const accessories: GearSlot[] = ['amulet', 'ring1', 'ring2', 'belt', 'flask1', 'flask2', 'charm1', 'charm2', 'charm3'];
    expect(rest).toEqual(new Set(accessories));
  });
});
