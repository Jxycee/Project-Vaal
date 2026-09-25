import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { NO_SPIRIT_NODE } from '../collect';

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
