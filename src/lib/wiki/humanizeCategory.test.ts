import { describe, it, expect } from 'vitest';
import { humanizeCategory } from './humanizeCategory';

describe('humanizeCategory', () => {
  it('splits PascalCase into spaced words', () => {
    expect(humanizeCategory('StackableCurrency')).toBe('Stackable Currency');
    expect(humanizeCategory('UncutReservationGemStackable')).toBe('Uncut Reservation Gem Stackable');
  });

  it('replaces underscores with spaces', () => {
    expect(humanizeCategory('quality_currency')).toBe('quality currency');
  });

  it('handles a mix of underscores and PascalCase', () => {
    expect(humanizeCategory('ezomyte_basetype')).toBe('ezomyte basetype');
  });

  it('leaves already-readable text unchanged', () => {
    expect(humanizeCategory('Active Skill Gem')).toBe('Active Skill Gem');
    expect(humanizeCategory('Effect')).toBe('Effect');
    expect(humanizeCategory('Unused / Removed')).toBe('Unused / Removed');
  });

  it('does not split consecutive capitals (an acronym-shaped run)', () => {
    expect(humanizeCategory('NPCMaster')).toBe('NPCMaster');
  });

  it('keeps "AoE" intact instead of splitting it into "Ao E" - real regression caught live, the only tag/category in a live decode shaped like this', () => {
    expect(humanizeCategory('AoE')).toBe('AoE');
  });
});
