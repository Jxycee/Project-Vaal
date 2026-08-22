import { describe, it, expect } from 'vitest';
import { groupByCategory } from './categoryGroups';
import type { WikiSearchEntry } from './types';

const entry = (category: string, i: number): WikiSearchEntry => ({
  slug: `${category}-${i}`, name: `${category} ${i}`, kind: 'item', category, tags: [],
});

describe('groupByCategory', () => {
  it('counts entries per category', () => {
    const entries = [entry('Currency', 1), entry('Currency', 2), entry('Boots', 1)];
    expect(groupByCategory(entries)).toEqual([
      { category: 'Currency', count: 2 },
      { category: 'Boots', count: 1 },
    ]);
  });

  it('sorts by count descending, then category name ascending on ties', () => {
    const entries = [entry('Boots', 1), entry('Amulet', 1), entry('Currency', 1), entry('Currency', 2)];
    expect(groupByCategory(entries)).toEqual([
      { category: 'Currency', count: 2 },
      { category: 'Amulet', count: 1 },
      { category: 'Boots', count: 1 },
    ]);
  });

  it('returns an empty array for no entries', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
