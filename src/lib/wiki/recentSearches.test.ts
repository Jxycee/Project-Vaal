import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { recordSearchedEntry, getHomeStrip } from './recentSearches';
import { UNUSED_OR_REMOVED_CATEGORY } from './normalize';
import type { WikiSearchEntry } from './types';

function entry(kind: WikiSearchEntry['kind'], slug: string, category = 'Test'): WikiSearchEntry {
  return { slug, name: slug, kind, category, tags: [] };
}

const pool: WikiSearchEntry[] = [
  entry('item', 'a-item'),
  entry('item', 'b-item'),
  entry('skill', 'c-skill'),
  entry('mod', 'd-mod'),
  entry('effect', 'e-effect'),
  entry('map', 'f-map', UNUSED_OR_REMOVED_CATEGORY),
];

/** Minimal in-memory Storage — Node has no real localStorage to stub onto. */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() { return store.size; },
  } as Storage;
}

beforeEach(() => {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', createMemoryStorage());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('recordSearchedEntry + getHomeStrip', () => {
  it('backfills all 4 slots with random picks when nothing has been searched yet', () => {
    const strip = getHomeStrip(pool);
    expect(strip).toHaveLength(4);
  });

  it('never includes an Unused / Removed entry in the random backfill', () => {
    for (let i = 0; i < 20; i++) {
      const strip = getHomeStrip(pool);
      expect(strip.some((e) => e.category === UNUSED_OR_REMOVED_CATEGORY)).toBe(false);
    }
  });

  it('puts real recorded entries first, then backfills the rest', () => {
    recordSearchedEntry(entry('item', 'a-item'));
    const strip = getHomeStrip(pool);
    expect(strip).toHaveLength(4);
    expect(strip[0]).toEqual(entry('item', 'a-item'));
  });

  it('dedupes by kind+slug — recording the same entry twice keeps one, moved to the front', () => {
    recordSearchedEntry(entry('item', 'a-item'));
    recordSearchedEntry(entry('skill', 'c-skill'));
    recordSearchedEntry(entry('item', 'a-item'));
    const strip = getHomeStrip(pool);
    expect(strip[0]).toEqual(entry('item', 'a-item'));
    expect(strip[1]).toEqual(entry('skill', 'c-skill'));
    expect(strip.filter((e) => e.slug === 'a-item')).toHaveLength(1);
  });

  it('caps recorded history at 4 — a 5th recording drops the oldest', () => {
    recordSearchedEntry(entry('item', 'a-item'));
    recordSearchedEntry(entry('item', 'b-item'));
    recordSearchedEntry(entry('skill', 'c-skill'));
    recordSearchedEntry(entry('mod', 'd-mod'));
    recordSearchedEntry(entry('effect', 'e-effect'));
    const strip = getHomeStrip(pool);
    expect(strip).toHaveLength(4);
    expect(strip.map((e) => e.slug)).toEqual(['e-effect', 'd-mod', 'c-skill', 'b-item']);
  });

  it('does not throw when localStorage throws (private browsing, quota, etc.)', () => {
    vi.stubGlobal('localStorage', {
      getItem() { throw new Error('unavailable'); },
      setItem() { throw new Error('unavailable'); },
    });
    expect(() => recordSearchedEntry(entry('item', 'a-item'))).not.toThrow();
    expect(() => getHomeStrip(pool)).not.toThrow();
  });

  it('treats a server-rendered environment (no window) as empty, not an error', () => {
    vi.stubGlobal('window', undefined);
    expect(() => recordSearchedEntry(entry('item', 'a-item'))).not.toThrow();
    expect(getHomeStrip(pool)).toHaveLength(4);
  });
});
