import { describe, it, expect } from 'vitest';
import {
  parseFinderFilters,
  serializeFinderFilters,
  EMPTY_FINDER_FILTERS,
} from '@/lib/build/finderFilters';

describe('parseFinderFilters', () => {
  it('reads known keys', () => {
    expect(parseFinderFilters({ class: 'Witch', league: 'Standard' })).toEqual({
      class: 'Witch',
      league: 'Standard',
      skill: null,
      tag: null,
    });
  });

  it('drops unknown keys', () => {
    expect(parseFinderFilters({ tab: 'public', bogus: 'x' } as Record<string, string>)).toEqual(
      EMPTY_FINDER_FILTERS,
    );
  });

  it('handles an array-valued searchParam by taking the first entry', () => {
    expect(parseFinderFilters({ class: ['Witch', 'Ranger'] })).toEqual({
      ...EMPTY_FINDER_FILTERS,
      class: 'Witch',
    });
  });

  it('treats an empty string the same as absent', () => {
    expect(parseFinderFilters({ class: '' })).toEqual(EMPTY_FINDER_FILTERS);
  });

  it('returns the empty filter object for no params', () => {
    expect(parseFinderFilters({})).toEqual(EMPTY_FINDER_FILTERS);
  });
});

describe('serializeFinderFilters', () => {
  it('serialises an empty filter to no query string', () => {
    expect(serializeFinderFilters(EMPTY_FINDER_FILTERS)).toBe('');
  });

  it('serialises a populated filter', () => {
    const qs = serializeFinderFilters({ class: 'Witch', league: 'Standard', skill: null, tag: null });
    expect(qs).toBe('?class=Witch&league=Standard');
  });
});

describe('round trip', () => {
  it('parse(serialize(filters)) preserves the original filters', () => {
    const filters = { class: 'Witch', league: 'Standard', skill: 'Herald of Ash', tag: 'minion' };
    const qs = serializeFinderFilters(filters);
    const params = new URLSearchParams(qs);
    const roundTripped = parseFinderFilters(Object.fromEntries(params.entries()));
    expect(roundTripped).toEqual(filters);
  });
});
