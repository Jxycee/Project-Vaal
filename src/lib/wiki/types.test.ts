import { describe, it, expect } from 'vitest';
import {
  isWikiSearchEntry,
  WIKI_DATA_VERSION,
  WIKI_PATCH_VERSION,
  ALL_WIKI_KINDS,
  WIKI_BASE_PATH,
  WIKI_KIND_LABEL,
} from './types';

describe('WikiSearchEntry', () => {
  it('accepts a well-formed entry', () => {
    expect(isWikiSearchEntry({
      slug: 'ice-nova',
      name: 'Ice Nova',
      kind: 'skill',
      category: 'Active Skill Gem',
      tags: ['Spell', 'AoE', 'Cold'],
      isUniqueItem: false,
    })).toBe(true);
  });

  it('rejects an entry missing a slug', () => {
    expect(isWikiSearchEntry({ name: 'X', kind: 'skill', category: 'c', tags: [], isUniqueItem: false })).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(isWikiSearchEntry({
      slug: 'x', name: 'X', kind: 'monster', category: 'c', tags: [], isUniqueItem: false,
    })).toBe(false);
  });

  it('rejects an entry missing isUniqueItem (e.g. a pre-migration localStorage record)', () => {
    expect(isWikiSearchEntry({
      slug: 'x', name: 'X', kind: 'item', category: 'c', tags: [],
    })).toBe(false);
  });

  it('exposes a dated data version string', () => {
    expect(WIKI_DATA_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('exposes a patch version string', () => {
    expect(WIKI_PATCH_VERSION).toMatch(/^\d+(\.\d+)+$/);
  });
});

describe('ALL_WIKI_KINDS', () => {
  it('matches every kind WIKI_BASE_PATH knows about — a 6th kind added to one but not the other would slip through silently otherwise', () => {
    expect([...ALL_WIKI_KINDS].sort()).toEqual(Object.keys(WIKI_BASE_PATH).sort());
  });

  it('has a WIKI_KIND_LABEL entry for every kind', () => {
    for (const kind of ALL_WIKI_KINDS) {
      expect(typeof WIKI_KIND_LABEL[kind]).toBe('string');
      expect(WIKI_KIND_LABEL[kind].length).toBeGreaterThan(0);
    }
  });
});
