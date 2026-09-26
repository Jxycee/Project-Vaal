import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { emptyCraft, type ItemCraft } from '../../craft';
import { emptyGearState, type GearState } from '../../gearState';
import { collectContributions, NO_SPIRIT_NODE, type Collected } from '../collect';
import { makeCollectData, type RawCollectFiles } from '../collectData';

// Real data behind the collector's hard-coded facts (tree 0.5.2, node-stats
// from patch 4.5.5.3). If a resync changes any of these, this fails first.

const tree = (JSON.parse(readFileSync('public/data/tree/0.5.2/data.json', 'utf8')) as {
  nodes: Record<string, { name?: string; stats?: string[]; isGenericAttribute?: boolean }>;
}).nodes;
const nodeStats = (JSON.parse(readFileSync('public/data/tree/0.5.2/node-stats.json', 'utf8')) as { nodes: Record<string, [string, number][]> }).nodes;

describe('collector facts', () => {
  it('NO_SPIRIT_NODE is Embrace the Darkness, whose first line is "You have no Spirit"', () => {
    const node = tree[String(NO_SPIRIT_NODE)];
    expect(node.name).toBe('Embrace the Darkness');
    expect(node.stats?.[0]).toMatch(/^You have no \[Spirit\]/);
  });

  it('every generic attribute node grants +5, which the collector assumes', () => {
    const generic = Object.values(tree).filter((n) => n.isGenericAttribute);
    expect(generic).toHaveLength(293);
    expect(new Set(generic.map((n) => n.stats?.join('|')))).toEqual(new Set(['+5 to any [Attributes|Attribute]']));
  });

  it("the flags come from these keystones' typed stats", () => {
    expect(nodeStats['32349']).toEqual([['keystone_giants_blood', 1]]); // Giant's Blood
    expect(nodeStats['61942']).toEqual([['keystone_lord_of_the_wilds', 1]]); // Lord of the Wilds
    expect(nodeStats['8143'].map(([s]) => s)).toContain('cannot_gain_spirit_from_equipment'); // Lead me through Grace...
  });

  it("Lord of the Wilds' text really says 50% less Spirit", () => {
    expect(tree['61942'].stats?.join(' ')).toMatch(/50% less \[Spirit\]/);
  });
});

// ---- Implicits, through the real data files -------------------------------
// A unique carries its base's implicit; the collector used to drop every
// unique's implicit silently. And a base with a hidden fixed-stat implicit
// used to throw the user's chosen values away. Checked on real items.

const WIKI = 'public/data/wiki/2026-08-25';
const readJson = (path: string) => JSON.parse(readFileSync(path, 'utf8')) as unknown;
const realData = (slugs: string[]) =>
  makeCollectData({
    tree: { nodes: {} },
    nodeStats: { nodes: {} },
    implicitStats: readJson(`${WIKI}/implicit-stats.json`) as RawCollectFiles['implicitStats'],
    uniqueStats: readJson(`${WIKI}/unique-stats.json`) as RawCollectFiles['uniqueStats'],
    items: new Map(slugs.map((s) => [s, readJson(`${WIKI}/items/${s}.json`)])),
    mods: new Map(),
  });
const wear = (slot: keyof GearState, slug: string, name: string, craft: Partial<ItemCraft>, isUnique: boolean): GearState => ({
  ...emptyGearState(),
  [slot]: { slug, name, category: 'x', isUnique, iconUrl: null, craft: { ...emptyCraft(isUnique), ...craft } },
});
const flat = (r: Collected, pool: string) => r.contributions.filter((c) => c.pool === pool && c.kind === 'flat').reduce((n, c) => n + c.value, 0);
const passive = { set1: [], set2: [], ascendancyNodes: [] };

describe('implicits on real items', () => {
  it("The Taming counts its Prismatic Ring implicit at the chosen value", () => {
    const g = wear('ring1', 'the-taming', 'The Taming', { implicitValues: [[9]], uniqueValues: [[15]] }, true);
    const r = collectContributions({ passive, gear: g, level: 1, set: 1 }, realData(['the-taming', 'prismatic-ring']));
    // 9 from the implicit + 15 from "+(10-20)% to all Elemental Resistances".
    expect(flat(r, 'fireRes')).toBe(24);
    expect(flat(r, 'coldRes')).toBe(24);
  });

  it("The Coming Calamity counts Heroic Armour's Life implicit from its own fourth line", () => {
    const g = wear('body', 'the-coming-calamity', 'The Coming Calamity', { implicitValues: [[1], [1], [1], [75]] }, true);
    const r = collectContributions({ passive, gear: g, level: 1, set: 1 }, realData(['the-coming-calamity', 'heroic-armour']));
    expect(flat(r, 'life')).toBe(75);
    expect(r.assumed).not.toContain('The Coming Calamity: implicit at mid-roll');
  });

  it("Hunting Spear keeps the chosen Maim value despite its hidden spear-throw implicit", () => {
    const d = realData(['hunting-spear']);
    const lines = (readJson(`${WIKI}/items/hunting-spear.json`) as { implicitMods: string[] }).implicitMods;
    expect(lines).toEqual(['(15-25)% chance to Maim on Hit']);
    expect(d.item('hunting-spear')?.implicits).toHaveLength(2);
    const g = wear('weapon1_main', 'hunting-spear', 'Hunting Spear', { implicitValues: [[18]] }, false);
    const r = collectContributions({ passive, gear: g, level: 1, set: 1 }, d);
    expect(r.assumed).not.toContain('Hunting Spear: implicit at mid-roll');
  });
});
