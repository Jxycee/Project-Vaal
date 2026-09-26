import { describe, expect, it } from 'vitest';
import { makeCollectData } from '../collectData';

// makeCollectData joins the raw data files into the lookups the collector
// uses. Failure modes first: a missing file's worth of data must read as
// "unknown" (undefined), never throw or invent values.

const raw = () => ({
  tree: { nodes: { '1': { name: 'Life', stats: ['+10 to maximum Life'] }, '2': { name: 'Attribute', isGenericAttribute: true, stats: ['+5 to any Attribute'] } } },
  nodeStats: { nodes: { '1': [['base_maximum_life', 10]] as [string, number][], '2': [['display_passive_attribute_text', 1]] as [string, number][] } },
  implicitStats: { bases: { 'Amethyst Ring': [[['base_chaos_damage_resistance_%', 7, 13]]] as [string, number, number][][] } },
  uniqueStats: { uniques: { 'Cloak of Flame': { baseType: 'Silk Robe', baseSlug: 'silk-robe', lines: [['local_energy_shield'], null] }, 'Baseless': { baseType: 'Gone', baseSlug: null, lines: [] } } },
  items: new Map<string, unknown>([
    ['amethyst-ring', { name: 'Amethyst Ring', armour: null, spirit: 0 }],
    ['silk-robe', { name: 'Silk Robe', armour: { armour: 0, evasion: 0, energyShield: 50 }, spirit: 0 }],
    ['cloak-of-flame', { name: 'Cloak of Flame', uniqueMods: { explicitMods: ['+(30-50) to maximum Energy Shield', 'Fire Thorns'] } }],
  ]),
  mods: new Map<string, unknown>([['increasedlife9', { rolls: [{ stat: 'base_maximum_life', min: 120, max: 149 }] }]]),
});

describe('makeCollectData', () => {
  it('joins a node to its name, typed stats and attribute flag', () => {
    const d = makeCollectData(raw());
    expect(d.node(1)).toEqual({ name: 'Life', stats: [['base_maximum_life', 10]], attribute: false });
    expect(d.node(2)?.attribute).toBe(true);
    expect(d.node(99)).toBeUndefined();
  });

  it('joins a base item to its defences, spirit and typed implicits by name', () => {
    expect(d().item('amethyst-ring')).toEqual({ armour: null, spirit: 0, implicits: [[['base_chaos_damage_resistance_%', 7, 13]]] });
    expect(d().item('nope')).toBeUndefined();
  });

  it("joins a unique's lines to their typed stats, and its base to a slug", () => {
    expect(d().unique('Cloak of Flame', 'cloak-of-flame')).toEqual({
      baseSlug: 'silk-robe',
      lines: [
        { text: '+(30-50) to maximum Energy Shield', stats: ['local_energy_shield'] },
        { text: 'Fire Thorns', stats: null },
      ],
    });
    expect(d().unique('Unknown Unique', 'unknown-unique')).toBeUndefined();
    expect(d().unique('Baseless', 'baseless')).toBeUndefined();
  });

  it("reads a mod's rolls", () => {
    expect(d().mod('increasedlife9')).toEqual([{ stat: 'base_maximum_life', min: 120, max: 149 }]);
    expect(d().mod('nope')).toBeUndefined();
  });

  it('treats a malformed item or mod file as unknown instead of throwing', () => {
    const bad = raw();
    bad.items.set('broken', 'not an object');
    bad.mods.set('broken', { rolls: 'nope' });
    const data = makeCollectData(bad);
    expect(data.item('broken')).toBeUndefined();
    expect(data.mod('broken')).toBeUndefined();
  });
});

const d = () => makeCollectData(raw());
