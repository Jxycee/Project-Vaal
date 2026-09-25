import { describe, expect, it } from 'vitest';
import { matchTemplate, stripTags } from '../craftText';

// Failure modes first (AGENTS.md). PoB writes an item's lines as clipboard
// text with `{…}` markup; our data writes the same lines as templates with
// "(a-b)" ranges. Matching must never accept a line that only LOOKS alike.

describe('stripTags', () => {
  it('removes every leading {…} tag PoB writes', () => {
    expect(stripTags('{tags:attribute}{range:1}+(5-7) to all Attributes')).toBe('+(5-7) to all Attributes');
    expect(stripTags('{enchant}{rune}+80 to maximum Life')).toBe('+80 to maximum Life');
    expect(stripTags('+149 to maximum Life')).toBe('+149 to maximum Life');
  });
});

describe('matchTemplate — every way a match could be wrong', () => {
  it('reads each ranged number, in order', () => {
    expect(matchTemplate('Adds 34 to 58 Physical Damage', 'Adds (23-35) to (39-59) Physical Damage')).toEqual([34, 58]);
    expect(matchTemplate('+149 to maximum Life', '+(120-149) to maximum Life')).toEqual([149]);
  });

  it('reads a line still written as a range (PoB ranged text) at its given fraction', () => {
    expect(matchTemplate('+(30-50)% to Fire Resistance', '+(30-50)% to Fire Resistance', 0.5)).toEqual([40]);
    expect(matchTemplate('+(5-7) to all Attributes', '+(5-7) to all Attributes', 1)).toEqual([7]);
  });

  it('refuses a number outside the template range', () => {
    expect(matchTemplate('+150 to maximum Life', '+(120-149) to maximum Life')).toBeNull();
    expect(matchTemplate('+119 to maximum Life', '+(120-149) to maximum Life')).toBeNull();
  });

  it('requires the fixed text and fixed numbers to match exactly', () => {
    expect(matchTemplate('+149 to maximum Mana', '+(120-149) to maximum Life')).toBeNull();
    expect(matchTemplate('45% of Physical Damage taken as Fire Damage', '50% of Physical Damage taken as Fire Damage')).toBeNull();
    expect(matchTemplate('50% of Physical Damage taken as Fire Damage', '50% of Physical Damage taken as Fire Damage')).toEqual([]);
  });

  it('does not match a prefix of a longer line, or a longer template', () => {
    expect(matchTemplate('+149 to maximum Life and Mana', '+(120-149) to maximum Life')).toBeNull();
    expect(matchTemplate('+149 to maximum', '+(120-149) to maximum Life')).toBeNull();
  });

  it('treats regex metacharacters in a template as plain text', () => {
    expect(matchTemplate('Gain 10% of Damage as Extra Fire Damage (Attacks)', 'Gain (8-12)% of Damage as Extra Fire Damage (Attacks)')).toEqual([10]);
  });

  it('reads decimals and negative ranges', () => {
    expect(matchTemplate('1.5% of Life Regenerated per second', '(1-2)% of Life Regenerated per second')).toEqual([1.5]);
    expect(matchTemplate('-7% to Cold Resistance', '(-10--5)% to Cold Resistance')).toEqual([-7]);
  });
});
