import { describe, it, expect } from 'vitest';
import { itemAccentColor, skillAccentColor, MOD_ACCENT_COLOR } from './accent';

describe('itemAccentColor', () => {
  it('returns the unique accent for unique-rarity items', () => {
    expect(itemAccentColor('unique')).toBe('var(--wiki-unique)');
  });

  it('returns the neutral border token for normal-rarity items', () => {
    expect(itemAccentColor('normal')).toBe('var(--border)');
  });
});

describe('skillAccentColor', () => {
  it('maps each gem color letter to its own CSS variable', () => {
    expect(skillAccentColor('r')).toBe('var(--wiki-gem-r)');
    expect(skillAccentColor('g')).toBe('var(--wiki-gem-g)');
    expect(skillAccentColor('b')).toBe('var(--wiki-gem-b)');
    expect(skillAccentColor('w')).toBe('var(--wiki-gem-w)');
  });
});

describe('MOD_ACCENT_COLOR', () => {
  it('is the brand primary token', () => {
    expect(MOD_ACCENT_COLOR).toBe('var(--primary)');
  });
});
