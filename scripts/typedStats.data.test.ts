import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Real data: what `npm run sync:stats` wrote (patch 4.5.5.3, 2026-09-25).
// Every expected value was checked against the node's or base's own display
// text in our tree/wiki data before being pinned here.

const nodeStats = JSON.parse(readFileSync('public/data/tree/0.5.2/node-stats.json', 'utf8')) as {
  patch: string;
  nodes: Record<string, [string, number][]>;
};
const implicitStats = JSON.parse(readFileSync('public/data/wiki/2026-08-25/implicit-stats.json', 'utf8')) as {
  patch: string;
  bases: Record<string, [string, number, number][][]>;
};
const tree = JSON.parse(readFileSync('public/data/tree/0.5.2/data.json', 'utf8')) as { nodes: Record<string, unknown> };

describe('node-stats.json', () => {
  it('covers every numeric node of our tree, from the pinned patch', () => {
    const treeIds = Object.keys(tree.nodes).filter((k) => /^\d+$/.test(k));
    expect(treeIds).toHaveLength(5150);
    expect(Object.keys(nodeStats.nodes).sort()).toEqual(treeIds.sort());
    expect(nodeStats.patch).toBe('4.5.5.3');
  });

  it.each([
    ['5733', [['base_spirit', 10]]], // "+10 to Spirit"
    ['29162', [['spirit_+%', 8]]], // "8% increased Spirit"
    ['32349', [['keystone_giants_blood', 1]]], // Giant's Blood
  ])('node %s reads as its text says', (id, expected) => {
    expect(nodeStats.nodes[id]).toEqual(expected);
  });

  it('keeps all seven stats of the one node that has seven (51546, Way of the Mountain)', () => {
    expect(nodeStats.nodes['51546']).toHaveLength(7);
  });
});

describe('implicit-stats.json', () => {
  it.each([
    ['Amethyst Ring', [[['base_chaos_damage_resistance_%', 7, 13]]]], // "+(7-13)% to Chaos Resistance"
    ['Stellar Amulet', [[['additional_all_attributes', 5, 7]]]], // "+(5-7) to all Attributes"
  ])('%s carries its implicit typed', (base, expected) => {
    expect(implicitStats.bases[base]).toEqual(expected);
  });
});

describe('one stat vocabulary', () => {
  it('uses the same stat ids as our mod files — base_maximum_life on both the tree and IncreasedLife9', () => {
    const mod = JSON.parse(readFileSync('public/data/wiki/2026-08-25/mods/increasedlife9.json', 'utf8')) as { rolls: { stat: string }[] };
    expect(mod.rolls.map((r) => r.stat)).toEqual(['base_maximum_life']);
    const onTree = new Set(Object.values(nodeStats.nodes).flatMap((list) => list.map(([stat]) => stat)));
    expect(onTree.has('base_maximum_life')).toBe(true);
  });

  it('shares most of the defensive ids a mod can roll with the tree', () => {
    // Every stat id that appears in both mods and tree must be spelled the same
    // — a sanity check that there is overlap at all, not a coincidence of one id.
    const modStats = new Set<string>();
    for (const f of readdirSync('public/data/wiki/2026-08-25/mods')) {
      const m = JSON.parse(readFileSync(`public/data/wiki/2026-08-25/mods/${f}`, 'utf8')) as { rolls?: { stat: string }[] };
      for (const r of m.rolls ?? []) modStats.add(r.stat);
    }
    const onTree = new Set(Object.values(nodeStats.nodes).flatMap((list) => list.map(([stat]) => stat)));
    const shared = [...onTree].filter((s) => modStats.has(s));
    expect(shared.length).toBeGreaterThan(300);
    for (const id of ['maximum_life_+%', 'base_maximum_energy_shield', 'evasion_rating_+%', 'base_fire_damage_resistance_%']) {
      expect(modStats.has(id), id).toBe(true);
      expect(onTree.has(id), id).toBe(true);
    }
  });
});

describe('unique-stats.json', () => {
  const uniques = (JSON.parse(readFileSync('public/data/wiki/2026-08-25/unique-stats.json', 'utf8')) as {
    uniques: Record<string, { baseType: string; lines: (string[] | null)[] }>;
  }).uniques;

  // Checked by hand against each line's text in items/*.json, 2026-09-25.
  it('types Cloak of Flame: local ES, fire resistance, ignite duration; two lines it cannot', () => {
    expect(uniques['Cloak of Flame']).toEqual({
      baseType: 'Silk Robe',
      baseSlug: 'silk-robe',
      lines: [['local_energy_shield'], ['base_fire_damage_resistance_%'], ['base_self_ignite_duration_-%'], null, null],
    });
  });

  it('types Blueflame Bracers, with its flat ES as local because gloves are worn armour', () => {
    expect(uniques['Blueflame Bracers']).toEqual({
      baseType: 'Goldcast Cuffs',
      baseSlug: 'goldcast-cuffs',
      lines: [['local_energy_shield'], ['additional_intelligence'], ['base_fire_damage_resistance_%'], ['base_cold_damage_resistance_%'], null],
    });
  });

  it('gives every unique a base our item data has', () => {
    const items = new Set(readdirSync('public/data/wiki/2026-08-25/items').map((f) => (JSON.parse(readFileSync(`public/data/wiki/2026-08-25/items/${f}`, 'utf8')) as { name: string }).name));
    const missing = Object.entries(uniques).filter(([, u]) => u.baseType && !items.has(u.baseType)).map(([n]) => n);
    expect(missing).toEqual([]);
  });
});
