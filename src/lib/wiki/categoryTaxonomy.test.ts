import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { groupByTaxonomy, ITEM_CATEGORY_GROUPS } from './categoryTaxonomy';
import { groupByCategory } from './categoryGroups';
import { WIKI_DATA_VERSION } from './types';
import type { WikiSearchEntry } from './types';

const entry = (category: string, i: number): WikiSearchEntry => ({
  slug: `${category}-${i}`, name: `${category} ${i}`, kind: 'item', category, tags: [],
});

describe('groupByTaxonomy', () => {
  const taxonomy = {
    Armour: ['Boots', 'Helmet'],
    Weapons: ['Bow'],
  };

  it('buckets categories into their taxonomy section with a summed total', () => {
    const groups = groupByCategory([
      entry('Boots', 1), entry('Boots', 2), entry('Helmet', 1), entry('Bow', 1),
    ]);
    const sections = groupByTaxonomy(groups, taxonomy);
    const armour = sections.find((s) => s.label === 'Armour');
    expect(armour).toEqual({
      label: 'Armour',
      total: 3,
      categories: [
        { category: 'Boots', count: 2 },
        { category: 'Helmet', count: 1 },
      ],
    });
  });

  it('puts an unrecognized category into an "Other" fallback section', () => {
    const groups = groupByCategory([entry('MysteryCategory', 1)]);
    const sections = groupByTaxonomy(groups, taxonomy);
    expect(sections).toEqual([
      { label: 'Other', total: 1, categories: [{ category: 'MysteryCategory', count: 1 }] },
    ]);
  });

  it('sorts sections by total count descending, then label ascending on ties', () => {
    const groups = groupByCategory([
      entry('Boots', 1), entry('Helmet', 1), // Armour: 2
      entry('Bow', 1), entry('Bow', 2), entry('Bow', 3), // Weapons: 3
    ]);
    const sections = groupByTaxonomy(groups, taxonomy);
    expect(sections.map((s) => s.label)).toEqual(['Weapons', 'Armour']);
  });

  it('returns an empty array for no entries', () => {
    expect(groupByTaxonomy([], taxonomy)).toEqual([]);
  });
});

describe('ITEM_CATEGORY_GROUPS', () => {
  it('covers every real synced item category with no duplicates', () => {
    const dir = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION, 'items');
    const files = readdirSync(dir);
    const realCategories = new Set<string>();
    for (const f of files) {
      const item = JSON.parse(readFileSync(path.join(dir, f), 'utf8'));
      realCategories.add(item.category);
    }

    const assigned = Object.values(ITEM_CATEGORY_GROUPS).flat();
    const assignedSet = new Set(assigned);
    expect(assigned.length).toBe(assignedSet.size); // no duplicates across groups

    const missing = [...realCategories].filter((c) => !assignedSet.has(c));
    expect(missing).toEqual([]);
  });
});
