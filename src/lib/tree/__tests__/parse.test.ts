import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseTreeExport } from '../parse';

// --- Synthetic fixture: a tiny tree exercising every parse rule deterministically ---
function fixture() {
  return {
    tree: 'Default',
    groups: {
      '1': { x: -100, y: -100, orbits: [0, 1] },
      '2': { x: 100, y: 100, orbits: [0, 1] },
    },
    classes: [
      { name: 'Alpha', base_str: 15, base_dex: 7, base_int: 7, ascendancies: [] },
      {
        name: 'Beta',
        base_str: 7,
        base_dex: 7,
        base_int: 15,
        ascendancies: [{ name: 'Bright' }, null, 'Dark'],
      },
    ],
    nodes: {
      root: { group: 0, orbit: 0, orbitIndex: 0, out: ['100', '200'], in: [], edges: [] },
      '100': {
        id: 'AlphaStart', skill: 100, name: 'ALPHA', icon: 'i/a.png',
        x: -10, y: 5, group: 1, orbit: 0, stats: [], classStartIndex: [0], out: ['101'], in: ['root'],
      },
      '200': {
        id: 'BetaStart', skill: 200, name: 'BETA', icon: 'i/b.png',
        x: 20, y: -8, group: 2, orbit: 0, stats: [], classStartIndex: [1], out: ['201'], in: ['root'],
      },
      '101': {
        id: 'AlphaNotable', skill: 101, name: 'Might', icon: 'i/n.png',
        x: -12, y: 9, group: 1, orbit: 1, isNotable: true, stats: ['+10 to Strength'],
        grantedStrength: 10, out: ['300', '500'], in: ['100'],
      },
      '201': {
        id: 'BetaKeystone', skill: 201, name: 'Chaos Inoculation', icon: 'i/k.png',
        x: 25, y: -12, group: 2, orbit: 1, isKeystone: true, stats: ['Maximum Life is 1'], out: [], in: ['200'],
      },
      '300': {
        id: 'AlphaMastery', skill: 300, name: 'Might Mastery', icon: 'i/m.png',
        x: -14, y: 11, group: 1, orbit: 1, isMastery: true, stats: [], out: [], in: ['101'],
      },
      '400': {
        skill: 400, x: -8, y: 3, group: 1, orbit: 1, stats: [], out: [], in: [],
      },
      '500': {
        id: 'MightChoice', skill: 500, name: 'Might Option A', icon: 'i/c.png',
        x: -16, y: 7, group: 1, orbit: 1, isMultipleChoiceOption: true, multipleChoiceParent: 101,
        stats: ['+5 to Strength'], out: [], in: ['101'],
      },
    },
  };
}

describe('parseTreeExport (fixture)', () => {
  const m = parseTreeExport(fixture());

  it('excludes the structural "root" key and keeps only numeric ids', () => {
    expect([...m.nodes.keys()].sort((a, b) => a - b)).toEqual([100, 101, 200, 201, 300, 400, 500]);
    expect([...m.nodes.keys()].every(Number.isInteger)).toBe(true);
  });

  it('parses group centres for arc geometry', () => {
    expect(m.groups.get(1)).toEqual({ x: -100, y: -100 });
    expect(m.groups.get(2)).toEqual({ x: 100, y: 100 });
    expect(m.groups.size).toBe(2);
  });

  it('keeps group + orbit on each node', () => {
    expect(m.nodes.get(101)).toMatchObject({ group: 1, orbit: 1 });
    expect(m.nodes.get(100)).toMatchObject({ group: 1, orbit: 0 });
  });

  it('builds undirected neighbours from out ∪ in, dropping "root"', () => {
    expect(new Set(m.nodes.get(100)!.neighbors)).toEqual(new Set([101]));
    expect(new Set(m.nodes.get(101)!.neighbors)).toEqual(new Set([100, 300, 500]));
  });

  it('derives node kind with documented precedence', () => {
    expect(m.nodes.get(100)!.kind).toBe('classStart');
    expect(m.nodes.get(101)!.kind).toBe('notable');
    expect(m.nodes.get(201)!.kind).toBe('keystone');
    expect(m.nodes.get(300)!.kind).toBe('mastery');
  });

  it('flags decoration: masteries and empty proxy connectors, not real nodes', () => {
    expect(m.nodes.get(300)!.isDecoration).toBe(true); // mastery
    expect(m.nodes.get(400)!.isDecoration).toBe(true); // no name + no icon proxy
    expect(m.nodes.get(101)!.isDecoration).toBe(false); // real notable
    expect(m.nodes.get(100)!.isDecoration).toBe(false); // class start
  });

  it('captures multiple-choice options and their parent', () => {
    const opt = m.nodes.get(500)!;
    expect(opt.isMultipleChoiceOption).toBe(true);
    expect(opt.multipleChoiceParent).toBe(101);
    expect(m.nodes.get(101)!.isMultipleChoiceOption).toBe(false);
  });

  it('resolves class start nodes and drops null ascendancies', () => {
    expect(m.classes[0]).toMatchObject({ name: 'Alpha', startNodeId: 100 });
    expect(m.classes[1]).toMatchObject({
      name: 'Beta',
      startNodeId: 200,
      ascendancies: ['Bright', 'Dark'],
    });
  });

  it('keeps structured attribute grants only when present', () => {
    expect(m.nodes.get(101)!.grantedStrength).toBe(10);
    expect(m.nodes.get(100)!.grantedStrength).toBeUndefined();
  });

  it('computes bounds from actual node extents', () => {
    expect(m.bounds).toEqual({ minX: -16, minY: -12, maxX: 25, maxY: 11 });
  });

  it('throws on a class with no start node', () => {
    const bad = fixture();
    bad.nodes['100'].classStartIndex = [];
    expect(() => parseTreeExport(bad)).toThrow(/class 0/);
  });

  it('throws when root is not a valid object', () => {
    expect(() => parseTreeExport(null)).toThrow();
    expect(() => parseTreeExport(42)).toThrow();
  });
});

// --- Real-data integration: runs only when the export is vendored ---
const TREE_ROOT = join(process.cwd(), 'public', 'data', 'tree');
function realDataPath(): string | null {
  if (!existsSync(TREE_ROOT)) return null;
  for (const v of readdirSync(TREE_ROOT).sort().reverse()) {
    const p = join(TREE_ROOT, v, 'data.json');
    if (existsSync(p)) return p;
  }
  return null;
}
const realPath = realDataPath();

describe.skipIf(!realPath)('parseTreeExport (real export)', () => {
  const m = parseTreeExport(JSON.parse(readFileSync(realPath!, 'utf8')));

  it('parses the full node set with root excluded', () => {
    expect(m.nodes.size).toBeGreaterThan(5000);
    expect([...m.nodes.keys()].every(Number.isInteger)).toBe(true);
  });

  it('parses group centres (~1621) for arcs', () => {
    expect(m.groups.size).toBeGreaterThan(1500);
    for (const g of m.groups.values()) {
      expect(typeof g.x).toBe('number');
      expect(typeof g.y).toBe('number');
    }
  });

  it('resolves a start node for all 12 classes', () => {
    expect(m.classes.length).toBe(12);
    for (const c of m.classes) expect(m.nodes.has(c.startNodeId)).toBe(true);
  });

  it('treats every mastery as decoration (PoE2 0.5.x)', () => {
    const masteries = [...m.nodes.values()].filter((n) => n.kind === 'mastery');
    expect(masteries.length).toBeGreaterThan(300);
    for (const n of masteries) expect(n.isDecoration).toBe(true);
  });

  it('flags empty proxy connectors as decoration', () => {
    const proxies = [...m.nodes.values()].filter((n) => !n.name && !n.icon);
    expect(proxies.length).toBeGreaterThan(100);
    for (const n of proxies) expect(n.isDecoration).toBe(true);
  });

  it('captures multiple-choice options present in the data', () => {
    const opts = [...m.nodes.values()].filter((n) => n.isMultipleChoiceOption);
    expect(opts.length).toBeGreaterThan(0);
    for (const o of opts) expect(o.multipleChoiceParent === undefined || Number.isInteger(o.multipleChoiceParent)).toBe(true);
  });

  it('parses known nodes (Avatar of Fire keystone, Weapon Master conversion)', () => {
    const avatarOfFire = m.nodes.get(18684)!;
    expect(avatarOfFire.name).toBe('Avatar of Fire');
    expect(avatarOfFire.kind).toBe('keystone');
    const weaponMaster = m.nodes.get(8272)!;
    expect(weaponMaster.weaponPassivePointsGranted).toBe(100);
    expect(weaponMaster.passivePointsGranted).toBe(-100);
  });

  it('every neighbour id resolves to a real node', () => {
    for (const n of m.nodes.values()) {
      for (const nb of n.neighbors) expect(m.nodes.has(nb)).toBe(true);
    }
  });
});
