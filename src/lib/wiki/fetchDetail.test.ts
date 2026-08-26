import { describe, it, expect } from 'vitest';
import { extractCardSnippet } from './fetchDetail';

describe('extractCardSnippet', () => {
  it('joins an item\'s flavourText array and reads its icon', () => {
    const result = extractCardSnippet('item', {
      iconUrl: '/icon.png',
      iconWidth: 64,
      iconHeight: 64,
      flavourText: ['Line one.', 'Line two.'],
      rarity: 'normal',
    });
    expect(result.iconUrl).toBe('/icon.png');
    expect(result.snippet).toBe('Line one. Line two.');
  });

  it('gives a unique item the unique accent color', () => {
    const result = extractCardSnippet('item', { rarity: 'unique' });
    expect(result.accent).toBe('var(--wiki-unique)');
  });

  it('gives a normal item the neutral border accent color', () => {
    const result = extractCardSnippet('item', { rarity: 'normal' });
    expect(result.accent).toBe('var(--border)');
  });

  it('reads a skill\'s description and gem-color accent, with no icon fallback needed', () => {
    const result = extractCardSnippet('skill', {
      iconUrl: '/gem.png',
      description: 'Conjures a wave of ice.',
      color: 'b',
    });
    expect(result.iconUrl).toBe('/gem.png');
    expect(result.snippet).toBe('Conjures a wave of ice.');
    expect(result.accent).toBe('var(--wiki-gem-b)');
  });

  it('falls back to white gem accent for an unrecognized skill color', () => {
    const result = extractCardSnippet('skill', { color: 'not-a-color' });
    expect(result.accent).toBe('var(--wiki-gem-w)');
  });

  it('has no icon for mods, effects, or maps, and uses their flat accent colors', () => {
    expect(extractCardSnippet('mod', { description: 'x' })).toMatchObject({ iconUrl: null, accent: 'var(--primary)' });
    expect(extractCardSnippet('effect', { description: 'x' })).toMatchObject({ iconUrl: null, accent: 'var(--wiki-effect)' });
    expect(extractCardSnippet('map', { description: 'x' })).toMatchObject({ iconUrl: null, accent: 'var(--wiki-map)' });
  });

  it('defaults to an empty snippet and null icon fields for malformed input', () => {
    const result = extractCardSnippet('item', null);
    expect(result).toEqual({ iconUrl: null, iconWidth: null, iconHeight: null, snippet: '', accent: 'var(--border)' });
  });
});
