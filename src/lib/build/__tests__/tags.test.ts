import { describe, it, expect } from 'vitest';
import { normalizeTag, normalizeTagList, MAX_TAGS_PER_BUILD } from '@/lib/build/tags';

describe('normalizeTag', () => {
  it('lowercases', () => {
    expect(normalizeTag('Minion')).toBe('minion');
  });

  it('trims leading/trailing whitespace', () => {
    expect(normalizeTag('  minion  ')).toBe('minion');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeTag('low   life')).toBe('low life');
  });

  it('returns null for empty-after-trim', () => {
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('')).toBeNull();
  });

  it('returns null for 33 characters', () => {
    expect(normalizeTag('a'.repeat(33))).toBeNull();
  });

  it('accepts exactly 32 characters (the live CHECK upper bound)', () => {
    expect(normalizeTag('a'.repeat(32))).toBe('a'.repeat(32));
  });

  it('accepts exactly 1 character (the live CHECK lower bound)', () => {
    expect(normalizeTag('a')).toBe('a');
  });
});

describe('normalizeTagList', () => {
  it('dedupes case-variants to one entry', () => {
    expect(normalizeTagList(['Minion', 'minion', 'MINION'])).toEqual(['minion']);
  });

  it('drops entries that fail normalizeTag', () => {
    expect(normalizeTagList(['minion', '', '   ', 'a'.repeat(33)])).toEqual(['minion']);
  });

  it('truncates at MAX_TAGS_PER_BUILD', () => {
    const raw = Array.from({ length: MAX_TAGS_PER_BUILD + 5 }, (_, i) => `tag${i}`);
    expect(normalizeTagList(raw)).toHaveLength(MAX_TAGS_PER_BUILD);
  });

  it('preserves order', () => {
    expect(normalizeTagList(['b', 'a', 'c'])).toEqual(['b', 'a', 'c']);
  });
});
