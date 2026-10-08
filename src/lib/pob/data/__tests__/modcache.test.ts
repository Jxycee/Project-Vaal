/**
 * FAILURE MODES (written before the sync script):
 *  1. Lua parser mishandles nested tables / escaped quotes / math.huge and the
 *     script throws or silently truncates entries -> entry count collapses.
 *  2. Filter regex too loose (keeps LifeRegen, ManaCost, damage mods) or too
 *     tight (drops ColdResistMax / ElementalResist) -> wrong names in the file.
 *  3. Tags lost: a per-socket / per-gem-count line comes out as flat BASE and
 *     would be applied unscaled.
 *  4. Dropped counts do not add up (kept + dropped != total) -> silent loss.
 *  5. File bloat: unfiltered cache (1.6 MB Lua, ~10k lines) shipped as JSON.
 *  6. Parser itself: strings with escapes, negative numbers, math.huge.
 */
import { describe, expect, it } from 'vitest';
import data from '../modcache.json';
import meta from '../modcache.meta.json';
import { KEEP, parseLuaValue } from '../../../../../scripts/sync-pob-modcache';

type Entry = { mods: { name: string; type: string; value: unknown; tagType?: string; tagVar?: string; tagDiv?: number }[]; rest?: string };
const d = data as unknown as Record<string, Entry>;

describe('modcache.json', () => {
  it('is filtered to a sane size and counts add up', () => {
    const kept = Object.keys(d).length;
    expect(kept).toBeGreaterThan(800);
    expect(kept).toBeLessThan(3000);
    expect(meta.keptEntries).toBe(kept);
    expect(kept + meta.entries).toBe(meta.totalEntries);
    expect(meta.unparsed + meta.noRelevantMod).toBe(meta.entries);
    expect(meta.totalEntries).toBeGreaterThan(9000);
  });

  it('only contains allowed mod names', () => {
    for (const e of Object.values(d)) {
      expect(e.mods.length).toBeGreaterThan(0);
      for (const m of e.mods) expect(m.name).toMatch(KEEP);
    }
    const names = new Set(Object.values(d).flatMap((e) => e.mods.map((m) => m.name)));
    for (const n of ['Life', 'Mana', 'EnergyShield', 'Armour', 'Evasion', 'Str', 'Dex', 'Int', 'Spirit', 'FireResist', 'ColdResistMax', 'ElementalResist', 'ChaosResist']) {
      expect(names.has(n)).toBe(true);
    }
    expect(names.has('LifeRegen')).toBe(false);
  });

  it('parses flat life / attribute / resist lines', () => {
    expect(d['+10 to maximum Life'].mods).toEqual([{ name: 'Life', type: 'BASE', value: 10 }]);
    expect(d['+10 to Strength'].mods[0]).toMatchObject({ name: 'Str', type: 'BASE', value: 10 });
    expect(d['+10% to Fire Resistance'].mods[0]).toMatchObject({ name: 'FireResist', type: 'BASE', value: 10 });
  });

  it('keeps per-socket and per-stat tags (not flat)', () => {
    expect(d['+10 to Spirit per Socket filled'].mods[0]).toMatchObject({ name: 'Spirit', tagType: 'Multiplier' });
    expect(d['+10 to Spirit per Socket filled'].mods[0].tagVar).toContain('RunesSocketedIn');
    expect(d['+1 Life per 4 Dexterity'].mods[0]).toMatchObject({ name: 'Life', tagType: 'PerStat', tagDiv: 4 });
    expect(d['+1% to Maximum Cold Resistance per 3 Blue Support Gems Socketed'].mods[0]).toMatchObject({ name: 'ColdResistMax', tagDiv: 3 });
  });

  it('has INC types', () => {
    const inc = Object.values(d).filter((e) => e.mods.some((m) => m.name === 'Life' && m.type === 'INC'));
    expect(inc.length).toBeGreaterThan(5);
  });
});

describe('parseLuaValue', () => {
  it('handles nested tables, escapes, negatives and math.huge', () => {
    const [v] = parseLuaValue('{{[1]={[1]={type="X",var="a\\"b"},name="Life",value=-5}},nil}', 0);
    expect(v).toMatchObject([{ '1': { name: 'Life', value: -5, '1': { type: 'X', var: 'a"b' } } }, null]);
    const [h] = parseLuaValue('{limit=math.huge}', 0);
    expect(h).toEqual({ limit: 1e9 });
  });
});
