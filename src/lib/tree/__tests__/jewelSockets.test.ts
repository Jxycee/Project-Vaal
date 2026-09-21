import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { resolvableJewelSockets } from '../jewelSockets';

function fixture(nodes: GggTreeJson['nodes'], jewelSlots: (string | number)[] | undefined): GggTreeJson {
  return {
    groups: {},
    nodes,
    classes: [],
    jewelSlots,
    min_x: 0,
    min_y: 0,
    max_x: 0,
    max_y: 0,
  };
}

describe('resolvableJewelSockets', () => {
  it('normalises all four raw socket-name forms GGG ships', () => {
    const raw = fixture(
      {
        '1': { name: '[Jewel] Socket' },
        '2': { name: '[SinisterJewelSockets|Sinister] [Jewel] Socket' },
        '3': { name: 'Crystalline Phylactery' },
        '4': { name: "Zarokh's Gift" },
      },
      [1, 2, 3, 4],
    );
    expect(resolvableJewelSockets(raw)).toEqual([
      { id: 1, name: 'Jewel Socket' },
      { id: 2, name: 'Sinister Jewel Socket' },
      { id: 3, name: 'Crystalline Phylactery' },
      { id: 4, name: "Zarokh's Gift" },
    ]);
  });

  it('filters out jewelSlots ids with no matching node (the ~40% dangling case)', () => {
    const raw = fixture({ '1': { name: '[Jewel] Socket' } }, [1, 999]);
    expect(resolvableJewelSockets(raw)).toEqual([{ id: 1, name: 'Jewel Socket' }]);
  });

  it('normalises string ids to numbers before comparing against raw.nodes', () => {
    const raw = fixture({ '5': { name: '[Jewel] Socket' } }, ['5']);
    expect(resolvableJewelSockets(raw)).toEqual([{ id: 5, name: 'Jewel Socket' }]);
  });

  it('collapses a duplicate id to one entry', () => {
    const raw = fixture({ '1': { name: '[Jewel] Socket' } }, [1, '1']);
    expect(resolvableJewelSockets(raw)).toEqual([{ id: 1, name: 'Jewel Socket' }]);
  });

  it('returns an empty array when jewelSlots is absent', () => {
    expect(resolvableJewelSockets(fixture({}, undefined))).toEqual([]);
  });

  it('falls back to an empty name rather than throwing when a resolved node has none', () => {
    const raw = fixture({ '1': {} }, [1]);
    expect(resolvableJewelSockets(raw)).toEqual([{ id: 1, name: '' }]);
  });
});

describe('resolvableJewelSockets against the real 0.5.2 export', () => {
  const raw = JSON.parse(
    readFileSync(path.join(process.cwd(), 'public/data/tree/0.5.2/data.json'), 'utf-8'),
  ) as GggTreeJson;

  // Data regression: a tree-export bump that changes which/how many sockets
  // resolve should fail this test loudly rather than silently shrinking the
  // panel. Verified 2026-09-20 against this exact file: 31 jewelSlots ids, 19
  // resolve to a real node, 12 do not.
  it('resolves exactly 19 of the 31 exported jewelSlots ids', () => {
    expect(resolvableJewelSockets(raw)).toHaveLength(19);
  });

  it('produces the four documented display-name forms with the documented counts', () => {
    const names = resolvableJewelSockets(raw).map((s) => s.name);
    const counts = names.reduce<Record<string, number>>((acc, n) => {
      acc[n] = (acc[n] ?? 0) + 1;
      return acc;
    }, {});
    expect(counts).toEqual({
      'Jewel Socket': 12,
      'Sinister Jewel Socket': 5,
      'Crystalline Phylactery': 1,
      "Zarokh's Gift": 1,
    });
  });
});
