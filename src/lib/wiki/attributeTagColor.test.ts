import { describe, it, expect } from 'vitest';
import { attributeTagColor } from './attributeTagColor';

describe('attributeTagColor', () => {
  it('returns the matching color for a pure mod family', () => {
    expect(attributeTagColor('Strength')).toBe('var(--wiki-gem-r)');
    expect(attributeTagColor('Dexterity')).toBe('var(--wiki-gem-g)');
    expect(attributeTagColor('Intelligence')).toBe('var(--wiki-gem-b)');
  });

  it('returns the matching color for a pure item armour/shield tag', () => {
    expect(attributeTagColor('str_armour')).toBe('var(--wiki-gem-r)');
    expect(attributeTagColor('dex_shield')).toBe('var(--wiki-gem-g)');
  });

  it('returns a distinct blended color for a two-attribute hybrid tag', () => {
    expect(attributeTagColor('str_dex_armour')).toBe('var(--wiki-attr-str-dex)');
    expect(attributeTagColor('str_int_shield')).toBe('var(--wiki-attr-str-int)');
    expect(attributeTagColor('dex_int_armour')).toBe('var(--wiki-attr-dex-int)');
  });

  it('reuses the existing "universal" gem token for the all-three hybrid tag', () => {
    expect(attributeTagColor('str_dex_int_armour')).toBe('var(--wiki-gem-w)');
  });

  it('returns null for a non-attribute tag', () => {
    expect(attributeTagColor('quality_currency')).toBeNull();
    expect(attributeTagColor('two_hand_weapon')).toBeNull();
  });

  it('tints the Unique tag with the same accent unique items use on their detail page', () => {
    expect(attributeTagColor('Unique')).toBe('var(--wiki-unique)');
  });
});
