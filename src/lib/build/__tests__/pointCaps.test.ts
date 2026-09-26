import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_ASCENDANCY_POINTS, MAX_WEAPON_SET_POINTS } from '../constants';
import { ascendancyPointsSpent, basicPointShift, FREE_ASCENDANCY_NODES, POINT_GRANTS, weaponSetPointCap } from '../pointCaps';

// Failure modes first (AGENTS.md). The validator and the editor have no tree
// export in hand, so the nodes that change the point caps are pinned here —
// and this test re-derives them from the export, so a tree update that adds,
// moves or drops one fails loudly instead of silently miscounting.
const nodes = (JSON.parse(readFileSync('public/data/tree/0.5.2/data.json', 'utf8')) as {
  nodes: Record<string, { isFree?: boolean; weaponPassivePointsGranted?: number; passivePointsGranted?: number }>;
}).nodes;

describe('pointCaps — pinned against the 0.5.2 tree export', () => {
  it('lists exactly the ascendancy nodes the export marks isFree', () => {
    const free = Object.entries(nodes).filter(([, n]) => n.isFree).map(([id]) => Number(id));
    expect([...FREE_ASCENDANCY_NODES].sort()).toEqual(free.sort());
  });

  it('lists exactly the nodes that grant or take passive points, with their amounts', () => {
    const grants = Object.entries(nodes)
      .filter(([, n]) => n.weaponPassivePointsGranted !== undefined || n.passivePointsGranted !== undefined)
      .map(([id, n]) => [Number(id), { weapon: n.weaponPassivePointsGranted ?? 0, basic: n.passivePointsGranted ?? 0 }]);
    expect(Object.fromEntries(grants)).toEqual(Object.fromEntries(Object.entries(POINT_GRANTS).map(([id, g]) => [Number(id), g])));
  });
});

describe('pointCaps — what the caps are', () => {
  const WEAPON_MASTER = 8272;
  const witch2 = [1, 2, 3, 4, 5, 6, 7, 8];

  it('does not charge a free ascendancy node against the ascendancy cap', () => {
    expect(ascendancyPointsSpent([...witch2, 8415])).toBe(MAX_ASCENDANCY_POINTS);
    expect(ascendancyPointsSpent([...witch2, 9])).toBe(MAX_ASCENDANCY_POINTS + 1);
  });

  it("raises each weapon set's cap by Weapon Master's 100, and lowers the basic budget by as much", () => {
    const plain = { set1: [], set2: [], ascendancyNodes: witch2 };
    const master = { set1: [], set2: [], ascendancyNodes: [WEAPON_MASTER] };
    expect(weaponSetPointCap(plain)).toBe(MAX_WEAPON_SET_POINTS);
    expect(weaponSetPointCap(master)).toBe(MAX_WEAPON_SET_POINTS + 100);
    expect(basicPointShift(plain)).toBe(0);
    expect(basicPointShift(master)).toBe(-100);
  });
});
