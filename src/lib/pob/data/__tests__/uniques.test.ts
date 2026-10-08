// Failure modes (written before the generator):
//  1. The wiki lists only some of a unique's mods (Morior Invictus: 1 of 4).
//     A parser that stops at the first mod line, or drops {variant:N}-gated
//     lines, would reproduce that gap. Morior's per-Socket mods must be here.
//  2. Mod text keeps its {tags:..} / {variant:..} / {range:..} prefixes, so
//     lines never match anything downstream. No line may contain braces.
//  3. Header lines (Variant:, League:, Requires Level) leak into the mod list,
//     or "Implicits: N" is miscounted so implicits and explicits swap.
//  4. A base line split per variant ("{variant:1}Ironclad Vestments") is read
//     as the base "{variant:1}..." or as a header, eating the Variant: lines.
//  5. Two uniques sharing a name (Grand Spectrum on three bases) overwrite
//     each other and one silently vanishes.
//  6. An empty or truncated download (a file 404s and is skipped) shrinks the
//     set: the count floor catches it.
import { describe, expect, it } from 'vitest';
import uniques from '../uniques.json';
import { parseBlock } from '../../../../../scripts/sync-pob-uniques';

type U = {
  base: string;
  bases?: string[];
  level?: number;
  league?: string;
  implicits: string[];
  explicits: string[];
  variants?: string[];
  iv?: Record<number, number[]>;
  ev?: Record<number, number[]>;
};
const data = uniques as unknown as Record<string, U>;
const names = Object.keys(data);

describe('PoB uniques', () => {
  it('has the full set, not a truncated download', () => {
    expect(names.length).toBeGreaterThan(400);
    for (const n of names) {
      expect(data[n].base.length).toBeGreaterThan(0);
      // Tabula Rasa genuinely has no mods (just sockets and a base).
      if (n !== 'Tabula Rasa') expect(data[n].explicits.length + data[n].implicits.length, n).toBeGreaterThan(0);
    }
  });

  it('Morior Invictus carries the mods the wiki lacks', () => {
    const m = data['Morior Invictus'];
    expect(m.base).toBe('Grand Regalia');
    expect(m.explicits).toContain('+(50-60) to maximum Mana per Socket filled');
    expect(m.explicits).toContain('+(10-14) to Spirit per Socket filled');
    expect(m.explicits).toContain('+(10-13)% to Chaos Resistance per Socket filled');
    expect(m.explicits.length).toBeGreaterThan(20);
    expect(m.variants?.length).toBe(m.explicits.length);
  });

  it('splits implicits from explicits by the Implicits: count', () => {
    const a = data['Andvarius'];
    expect(a.base).toBe('Gold Ring');
    expect(a.implicits).toEqual(['(6-15)% increased Rarity of Items found']);
    expect(a.explicits).toEqual([
      '(50-70)% increased Rarity of Items found',
      '+10 to Dexterity',
      '-20% to all Elemental Resistances',
    ]);
  });

  it('keeps level and league, and keeps headers out of mod text', () => {
    expect(data["Berek's Grip"].level).toBe(42);
    expect(data["Berek's Grip"].league).toBe('Runes of Aldur');
    for (const n of names) {
      for (const l of [...data[n].implicits, ...data[n].explicits]) {
        expect(l, n).not.toMatch(/[{}]/);
        expect(l, n).not.toMatch(/^(Variant|League|Requires Level|Implicits):/);
      }
    }
  });

  it('reads a per-variant base line and still sees the Variant: list', () => {
    const v = data["Voll's Protector"];
    expect(v.bases).toEqual(['Ironclad Vestments', 'Plated Vestments']);
    expect(v.base).toBe('Plated Vestments');
    expect(v.variants).toEqual(['Pre 0.1.1', 'Pre 0.4.0', 'Current']);
    expect(v.ev?.[3]).toEqual([2, 3]);
  });

  it('keeps same-named uniques on different bases', () => {
    expect(data['Grand Spectrum']).toBeDefined();
    expect(data['Grand Spectrum (Emerald)']).toBeDefined();
    expect(data['Grand Spectrum (Sapphire)']).toBeDefined();
    expect(new Set(['Grand Spectrum', 'Grand Spectrum (Emerald)', 'Grand Spectrum (Sapphire)'].map((k) => data[k].base)).size).toBe(3);
  });

  it('reads Variant: headers that come before the base line (Oaksworn)', () => {
    const o = data['Oaksworn'];
    expect(o.base).toBe('Sigil Crest Shield');
    expect(o.variants).toEqual(['Pre 0.2.0', 'Pre 0.3.0', 'Current']);
    expect(o.implicits).toEqual([]);
    expect(o.explicits[0]).toBe('(40-60)% increased Block chance');
  });

  it('parser: variant-gated mods are cleaned and indexed, wrapped header lines survive', () => {
    const p = parseBlock('Test Thing\nIron Ring\nVariant: Old\nVariant: New\nImplicits: 1\n{tags:fire}+5 to Strength\n{variant:1}{range:0.5}10% more Foo\n{variant:2}20% more Foo');
    expect(p?.unique.implicits).toEqual(['+5 to Strength']);
    expect(p?.unique.explicits).toEqual(['10% more Foo', '20% more Foo']);
    expect(p?.unique.ev).toEqual({ 0: [1], 1: [2] });
    expect(p?.unique.variants).toEqual(['Old', 'New']);
  });
});
