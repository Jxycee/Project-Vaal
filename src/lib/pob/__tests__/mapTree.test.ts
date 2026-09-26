import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { getCatalogue } from '../catalogue';
import { decodePobCode } from '../decode';
import { mapTree, type TreeLookup } from '../mapTree';
import { parsePobXml, type PobSpec } from '../parse';

// Failure modes first (AGENTS.md). A small fake tree isolates each rule;
// the real tree and the real build check the whole thing at the end.
//
//   main nodes 1–10 (1–5 are generic attribute nodes)    class start 99    unknown: anything else
//   ascendancy 'A1': start 20, nodes 21, 22
//   ascendancy 'B1': node 30

const fake: TreeLookup = {
  hasNode: (id) => (id >= 1 && id <= 10) || [20, 21, 22, 30, 99].includes(id),
  ascendancyOf: (id) => (id >= 20 && id <= 22 ? 'A1' : id === 30 ? 'B1' : null),
  isStartNode: (id) => id === 20 || id === 99,
  isAttributeNode: (id) => id >= 1 && id <= 5,
};

const spec = (overrides: Partial<PobSpec> = {}): PobSpec => ({
  title: 'T',
  nodes: [],
  weaponSet1: [],
  weaponSet2: [],
  attributeOverrides: { str: [], dex: [], int: [] },
  jewelSockets: [],
  ...overrides,
});

describe('mapTree — every way it can go wrong', () => {
  it('drops nodes this tree does not have, and names them', () => {
    const { value, report } = mapTree(spec({ nodes: [1, 555, 2, 777] }), 'A1', fake, 3);
    expect(value.set1).toEqual([1, 2]);
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ kind: 'dropped', area: 'tree', checkpoint: 3 });
    expect(report[0].message).toContain('555');
    expect(report[0].message).toContain('777');
  });

  it('omits start nodes silently — our editor never stores them, so nothing is lost', () => {
    const { value, report } = mapTree(spec({ nodes: [99, 1, 20, 21] }), 'A1', fake, 1);
    expect([...value.set1, ...value.set2, ...value.ascendancyNodes]).not.toContain(99);
    expect([...value.set1, ...value.set2, ...value.ascendancyNodes]).not.toContain(20);
    expect(value.ascendancyNodes).toEqual([21]);
    expect(report).toEqual([]);
  });

  it("drops another ascendancy's nodes, and says so", () => {
    const { value, report } = mapTree(spec({ nodes: [21, 30] }), 'A1', fake, 1);
    expect(value.ascendancyNodes).toEqual([21]);
    expect(report).toHaveLength(1);
    expect(report[0].message).toContain('30');
  });

  it('drops every ascendancy node when the build has no ascendancy', () => {
    const { value, report } = mapTree(spec({ nodes: [1, 21, 22] }), null, fake, 1);
    expect(value.ascendancyNodes).toEqual([]);
    expect(value.set1).toEqual([1]);
    expect(report).toHaveLength(1);
  });

  it('never puts an ascendancy node in a weapon set, even when PoB lists it in one', () => {
    // tree-core: ascendancy nodes are always shared (mode 0), matching PoB.
    const { value } = mapTree(spec({ nodes: [21], weaponSet1: [21] }), 'A1', fake, 1);
    expect(value).toEqual({ set1: [], set2: [], ascendancyNodes: [21] });
  });

  // Slice 5: attribute choices are stored now (PassiveState.attributeChoices).
  it('keeps the attribute choice of every imported generic attribute node, and reports nothing', () => {
    const { value, report } = mapTree(spec({ nodes: [1, 2, 3], attributeOverrides: { str: [1], dex: [2, 3], int: [] } }), 'A1', fake, 2);
    expect(value.attributeChoices).toEqual({ '1': 'str', '2': 'dex', '3': 'dex' });
    expect(report).toEqual([]);
  });

  it('reports a choice for a node that was not imported, or is not a generic attribute node, by id', () => {
    const { value, report } = mapTree(spec({ nodes: [1, 7], attributeOverrides: { str: [1, 2], dex: [7, 555], int: [] } }), 'A1', fake, 2);
    expect(value.attributeChoices).toEqual({ '1': 'str' });
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ kind: 'dropped', area: 'tree', checkpoint: 2 });
    for (const id of ['2', '7', '555']) expect(report[0].message).toContain(id);
  });

  it('refuses to guess when PoB lists one node under two attributes', () => {
    const { value, report } = mapTree(spec({ nodes: [1], attributeOverrides: { str: [1], dex: [1], int: [] } }), 'A1', fake, 2);
    expect(value).not.toHaveProperty('attributeChoices');
    expect(report[0].message).toContain('1');
  });

  it('turns an empty spec into an empty state with nothing to report', () => {
    expect(mapTree(spec(), 'A1', fake, 1)).toEqual({ value: { set1: [], set2: [], ascendancyNodes: [] }, report: [] });
  });

  it('collapses a node listed twice', () => {
    expect(mapTree(spec({ nodes: [1, 1, 2] }), 'A1', fake, 1).value.set1).toEqual([1, 2]);
  });
});

describe('mapTree — weapon sets', () => {
  it('puts WeaponSet1 nodes in set1 only, WeaponSet2 in set2 only, and the rest in both', () => {
    // Our storage spells "shared" as "in both" (passiveState.ts), and PoB's
    // spells it as "in neither WeaponSet list" (PassiveSpec.lua Save).
    const { value } = mapTree(spec({ nodes: [1, 2, 3, 4], weaponSet1: [2], weaponSet2: [3] }), 'A1', fake, 1);
    expect(value.set1).toEqual([1, 2, 4]);
    expect(value.set2).toEqual([1, 3, 4]);
  });
});

describe('mapTree — the real build against the real tree', async () => {
  const decoded = decodePobCode(readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8'));
  if (!decoded.ok) throw new Error('fixture failed to decode');
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error('fixture failed to parse');
  const { tree } = await getCatalogue();
  const ascendancy = tree.ascendancyIdFor('Mercenary', 'Witchhunter');

  it('imports spec 1 as 35 main-tree nodes and 2 ascendancy nodes', () => {
    const { value, report } = mapTree(parsed.build.specs[0], ascendancy, tree, 1);
    expect(value.set1).toHaveLength(35);
    expect(value.set2).toEqual(value.set1); // no weapon-set nodes in this build
    expect(value.ascendancyNodes).toHaveLength(2);
    // Nothing in this spec is unknown, and every attribute choice is kept.
    expect(report).toEqual([]);
    expect(value.attributeChoices).toEqual({
      '45969': 'dex', '27439': 'dex', '42350': 'dex', '22975': 'dex', '8600': 'dex', '36629': 'dex',
      '51921': 'int', '61438': 'int', '16168': 'int',
      '28510': 'str', '25374': 'str',
    });
  });

  it('imports spec 8 at exactly the 8-point ascendancy cap, reporting the one lost node', () => {
    // Keeping PoB's ascendancy start node would make this 9 — over the cap.
    const { value, report } = mapTree(parsed.build.specs[7], ascendancy, tree, 8);
    expect(value.set1).toHaveLength(116);
    expect(value.ascendancyNodes).toHaveLength(8);
    expect(report.some((r) => r.message.includes('15671'))).toBe(true);
    // 28 overrides; 15671 is the one node this tree does not have.
    expect(Object.keys(value.attributeChoices ?? {})).toHaveLength(27);
  });
});
