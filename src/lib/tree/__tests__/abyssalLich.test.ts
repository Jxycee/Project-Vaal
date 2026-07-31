import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { normalizeGggTree, type GggTreeJson } from '@poe2-toolkit/tree-core/ggg';

// Abyssal Lich ("Witch3b") has a name but no dedicated start node of its own —
// it reuses Lich's ("Witch3") exact graph via 13 per-node display overrides.
// tree-core's stock normalizeClass drops any ascendancy with no start node, so
// this exercises the tree-core patch (patches/@poe2-toolkit+tree-core+0.4.1.patch)
// that keeps it and resolves its graph/overrides from the base ascendancy.
const raw = JSON.parse(
  readFileSync(path.join(process.cwd(), 'public/data/tree/0.5.2/data.json'), 'utf-8'),
) as GggTreeJson;
const data = normalizeGggTree(raw, '0_5');
const witch = data.classes.find((c) => c.name === 'Witch');

describe('Abyssal Lich normalization (patched tree-core)', () => {
  it('appears in Witch’s ascendancy list', () => {
    const abyssal = witch?.ascendancies.find((a) => a.id === 'Abyssal Lich');
    expect(abyssal).toBeDefined();
  });

  it('shares Lich’s graph and hub position via graphId', () => {
    const abyssal = witch?.ascendancies.find((a) => a.id === 'Abyssal Lich');
    const lich = witch?.ascendancies.find((a) => a.id === 'Lich');
    expect(abyssal?.graphId).toBe('Lich');
    expect(abyssal?.worldAnchor).toEqual(lich?.worldAnchor);
  });

  it('has exactly 13 node overrides', () => {
    const abyssal = witch?.ascendancies.find((a) => a.id === 'Abyssal Lich');
    expect(Object.keys(abyssal?.nodeOverrides ?? {})).toHaveLength(13);
  });

  it('resolves the 3 headline overrides to their documented names', () => {
    const abyssal = witch?.ascendancies.find((a) => a.id === 'Abyssal Lich');
    const names = Object.values(abyssal?.nodeOverrides ?? {}).map((o) => o.name);
    expect(names).toEqual(
      expect.arrayContaining(['Steward of Kulemak', 'Unwilling Offering', 'Umbral Well']),
    );
  });

  it('leaves ordinary ascendancies (no overrides) untouched', () => {
    const lich = witch?.ascendancies.find((a) => a.id === 'Lich');
    expect(lich?.graphId).toBeUndefined();
    expect(lich?.nodeOverrides).toBeUndefined();
  });
});
