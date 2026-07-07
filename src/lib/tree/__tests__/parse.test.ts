import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseTreeExport } from '../parse';

// --- Synthetic fixture: a tiny tree exercising every parse rule deterministically ---
function fixture() {
  return {
    tree: 'Default',
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
        x: -10, y: 5, stats: [], classStartIndex: [0], out: ['101'], in: ['root'],
      },
      '200': {
        id: 'BetaStart', skill: 200, name: 'BETA', icon: 'i/b.png',
        x: 20, y: -8, stats: [], classStartIndex: [1], out: ['201'], in: ['root'],
      },
      '101': {
        id: 'AlphaNotable', skill: 101, name: 'Might', icon: 'i/n.png',
        x: -12, y: 9, isNotable: true, stats: ['+10 to Strength'],
        grantedStrength: 10, out: [], in: ['100'],
      },
      '201': {
        id: 'BetaKeystone', skill: 201, name: 'Chaos Inoculation', icon: 'i/k.png',
        x: 25, y: -12, isKeystone: true, stats: ['Maximum Life is 1'], out: [], in: ['200'],
      },
    },
  };
}

describe('parseTreeExport (fixture)', () => {
  const m = parseTreeExport(fixture());

  it('excludes the structural "root" key and keeps only numeric ids', () => {
    expect(m.nodes.size).toBe(4);
    expect([...m.nodes.keys()].sort((a, b) => a - b)).toEqual([100, 101, 200, 201]);
    expect([...m.nodes.keys()].every(Number.isInteger)).toBe(true);
  });

  it('coerces numeric node-id keys and reads coordinates', () => {
    const n = m.nodes.get(100)!;
    expect(n.id).toBe(100);
    expect(n.name).toBe('ALPHA');
    expect(n).toMatchObject({ x: -10, y: 5 });
  });

  it('builds undirected neighbours from out ∪ in, dropping "root"', () => {
    expect(new Set(m.nodes.get(100)!.neighbors)).toEqual(new Set([101]));
    expect(new Set(m.nodes.get(101)!.neighbors)).toEqual(new Set([100]));
  });

  it('derives node kind with documented precedence', () => {
    expect(m.nodes.get(100)!.kind).toBe('classStart');
    expect(m.nodes.get(101)!.kind).toBe('notable');
    expect(m.nodes.get(201)!.kind).toBe('keystone');
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
    expect(m.bounds).toEqual({ minX: -12, minY: -12, maxX: 25, maxY: 9 });
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

  it('resolves a start node for all 12 classes', () => {
    expect(m.classes.length).toBe(12);
    for (const c of m.classes) expect(m.nodes.has(c.startNodeId)).toBe(true);
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
