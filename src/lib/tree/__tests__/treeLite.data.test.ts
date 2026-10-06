// Failure modes this guards, written before the projection exists:
//  1. lite.json drifts from data.json after a re-vendor (stale names/flags).
//  2. the structural "root" key leaks into nodes.
//  3. a falsy flag is emitted, bloating the file for nothing.
//  4. a reader of the full export gives a different answer on the lite slice
//     (jewel sockets, ascendancy point count, class base attributes).
//  5. a node the stats engine can look up goes missing.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { TREE_VERSION } from '../version';
import { projectTreeLite, type TreeLite } from '../treeLite';
import { resolvableJewelSockets } from '../jewelSockets';
import { ascendancyPointCount } from '@/lib/build/ascendancyPoints';

const dir = path.join(process.cwd(), 'public', 'data', 'tree', TREE_VERSION);
const full = JSON.parse(readFileSync(path.join(dir, 'data.json'), 'utf8')) as GggTreeJson;
const committed = JSON.parse(readFileSync(path.join(dir, 'lite.json'), 'utf8')) as TreeLite;
const projected = projectTreeLite(full);

describe('tree lite projection', () => {
  it('lite.json equals the projection of data.json (re-run sync:tree-lite after a re-vendor)', () => {
    expect(committed).toEqual(projected);
  });

  it('keeps every real node id and drops the structural root', () => {
    const ids = Object.keys(full.nodes).filter((k) => k !== 'root');
    expect(Object.keys(committed.nodes).sort()).toEqual(ids.sort());
    expect('root' in committed.nodes).toBe(false);
  });

  it('emits flags only when true, and only the fields readers use', () => {
    for (const n of Object.values(committed.nodes)) {
      expect(Object.keys(n).every((k) => ['name', 'isGenericAttribute', 'isMultipleChoiceOption'].includes(k))).toBe(true);
      if ('isGenericAttribute' in n) expect(n.isGenericAttribute).toBe(true);
      if ('isMultipleChoiceOption' in n) expect(n.isMultipleChoiceOption).toBe(true);
    }
  });

  it('actually carries flags (the file is not vacuously empty)', () => {
    const vals = Object.values(committed.nodes);
    expect(vals.some((n) => n.isMultipleChoiceOption)).toBe(true);
    expect(vals.some((n) => n.isGenericAttribute)).toBe(true);
    expect(vals.filter((n) => n.name).length).toBeGreaterThan(1000);
  });

  it('jewel sockets resolve identically on lite and full', () => {
    const a = resolvableJewelSockets(committed);
    expect(a).toEqual(resolvableJewelSockets(full));
    expect(a.length).toBe(19);
  });

  it('ascendancy point count agrees for every node id, including choice options', () => {
    const ids = Object.keys(full.nodes).filter((k) => k !== 'root').map(Number);
    expect(ascendancyPointCount(ids, committed)).toBe(ascendancyPointCount(ids, full));
    const options = ids.filter((id) => (full.nodes[String(id)] as { isMultipleChoiceOption?: boolean }).isMultipleChoiceOption);
    expect(options.length).toBeGreaterThan(0);
    expect(ascendancyPointCount(options, committed)).toBe(0);
  });

  it('class base attributes match the full export', () => {
    const want = (full.classes as unknown as { name: string; base_str: number; base_dex: number; base_int: number }[]).map((c) => ({
      name: c.name,
      base_str: c.base_str,
      base_dex: c.base_dex,
      base_int: c.base_int,
    }));
    expect(committed.classes).toEqual(want);
    expect(want.length).toBeGreaterThan(5);
  });

  it('is small: under 250 KB raw', () => {
    expect(readFileSync(path.join(dir, 'lite.json')).length).toBeLessThan(250_000);
  });
});
