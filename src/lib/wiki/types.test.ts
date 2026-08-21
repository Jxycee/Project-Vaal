import { describe, it, expect } from 'vitest';
import { isWikiSearchEntry, WIKI_DATA_VERSION, WIKI_PATCH_VERSION } from './types';

describe('WikiSearchEntry', () => {
  it('accepts a well-formed entry', () => {
    expect(isWikiSearchEntry({
      slug: 'ice-nova',
      name: 'Ice Nova',
      kind: 'skill',
      category: 'Active Skill Gem',
      tags: ['Spell', 'AoE', 'Cold'],
    })).toBe(true);
  });

  it('rejects an entry missing a slug', () => {
    expect(isWikiSearchEntry({ name: 'X', kind: 'skill', category: 'c', tags: [] })).toBe(false);
  });

  it('rejects an unknown kind', () => {
    expect(isWikiSearchEntry({
      slug: 'x', name: 'X', kind: 'monster', category: 'c', tags: [],
    })).toBe(false);
  });

  it('exposes a dated data version string', () => {
    expect(WIKI_DATA_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('exposes a patch version string', () => {
    expect(WIKI_PATCH_VERSION).toMatch(/^\d+(\.\d+)+$/);
  });
});
