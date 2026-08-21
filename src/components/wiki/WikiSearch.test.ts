import { describe, it, expect } from 'vitest';
import { filterEntries } from './WikiSearch';

const entries = [
  { slug: 'ice-nova', name: 'Ice Nova', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Cold'] },
  { slug: 'orb-of-storms', name: 'Orb of Storms', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Lightning'] },
  { slug: 'blink', name: 'Blink', kind: 'skill' as const, category: 'Active Skill Gem', tags: ['Travel'] },
];

describe('filterEntries', () => {
  it('returns everything for an empty query', () => {
    expect(filterEntries(entries, '')).toHaveLength(3);
  });
  it('matches on name', () => {
    expect(filterEntries(entries, 'ice').map((e) => e.slug)).toContain('ice-nova');
  });
  it('tolerates a typo', () => {
    expect(filterEntries(entries, 'ise nva').map((e) => e.slug)).toContain('ice-nova');
  });
  it('returns an empty array for no match', () => {
    expect(filterEntries(entries, 'zzzzqqq')).toHaveLength(0);
  });
});
