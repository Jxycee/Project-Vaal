import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { normalizeGggTree, type GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { ascendancyLabel } from '../ascendancyNames';
import { TREE_VERSION } from '../version';

// Written before ascendancyNames.ts, as the list of ways the label can go
// wrong. builds.ascendancy can hold TWO vocabularies (verified 2026-09-26):
// the editor saves tree-core's normalized id, which is the display name
// ("Infernalist"), while the PoB importer saved GGG's raw id ("Witch1") until
// that day. A label has to read both.
//
// Failure modes:
//  1. The static table drifts from the vendored tree export (a patch renames
//     or adds an ascendancy) and a raw id shows as "Witch1" again.
//  2. An editor-saved value (already a display name) is mangled or replaced
//     by the class name.
//  3. A raw id GGG ships with a null name (Ranger2, Druid3 in 0.5.2) renders
//     as "null" or as the raw id.
//  4. No ascendancy (null, '') renders as "null"/blank instead of the class.
//  5. An Object.prototype key ('__proto__', 'toString', 'constructor') read
//     from a plain-object table returns a function or object, not a string.
//  6. A value neither vocabulary knows (a future patch's name saved by a
//     newer editor) is thrown away instead of shown as stored.

const raw = JSON.parse(
  readFileSync(path.join(process.cwd(), 'public', 'data', 'tree', TREE_VERSION, 'data.json'), 'utf-8'),
) as GggTreeJson & { classes: Array<{ name: string; ascendancies?: Array<{ id: string; name: string | null }> }> };

const rawAscendancies = raw.classes.flatMap((cls) => (cls.ascendancies ?? []).map((a) => ({ cls: cls.name, ...a })));

describe('ascendancyLabel', () => {
  it('has something to check (the export carries ascendancies)', () => {
    expect(rawAscendancies.length).toBeGreaterThan(20);
    expect(rawAscendancies.filter((a) => a.name === null).length).toBeGreaterThan(0);
  });

  it('1. maps every named raw id in the vendored export to its display name', () => {
    const named = rawAscendancies.filter((a) => a.name);
    expect(named.length).toBeGreaterThan(20);
    for (const a of named) expect(ascendancyLabel(a.cls, a.id), a.id).toBe(a.name);
  });

  it('2. leaves every id the editor actually saves (tree-core normalized) as it is', () => {
    const data = normalizeGggTree(raw, '0_5');
    const saved = data.classes.flatMap((c) => c.ascendancies.map((a) => ({ cls: c.name, id: a.id })));
    expect(saved.length).toBeGreaterThan(20);
    for (const a of saved) expect(ascendancyLabel(a.cls, a.id), a.id).toBe(a.id);
  });

  it('3. shows the class for a raw id whose name GGG left null', () => {
    const unnamed = rawAscendancies.filter((a) => a.name === null);
    for (const a of unnamed) expect(ascendancyLabel(a.cls, a.id), a.id).toBe(a.cls);
  });

  it('4. shows the class when there is no ascendancy', () => {
    expect(ascendancyLabel('Witch', null)).toBe('Witch');
    expect(ascendancyLabel('Witch', '')).toBe('Witch');
    expect(ascendancyLabel('Witch', undefined)).toBe('Witch');
  });

  it('5. returns a string for Object.prototype keys', () => {
    for (const key of ['__proto__', 'toString', 'constructor', 'hasOwnProperty']) {
      expect(ascendancyLabel('Witch', key)).toBe(key);
    }
  });

  it('6. shows a value neither vocabulary knows exactly as stored', () => {
    expect(ascendancyLabel('Witch', 'Some Future Ascendancy')).toBe('Some Future Ascendancy');
  });

  it('never returns a raw GGG id for any ascendancy in the export', () => {
    for (const a of rawAscendancies) expect(ascendancyLabel(a.cls, a.id)).not.toMatch(/^[A-Z][a-z]+\d+b?$/);
  });
});
