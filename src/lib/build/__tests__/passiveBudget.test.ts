import { describe, it, expect } from 'vitest';
import { derivePassiveBudget, QUEST_PASSIVE_POINTS } from '../passiveBudget';

describe('derivePassiveBudget', () => {
  it('matches the old hardcoded 123 at level 100', () => {
    expect(derivePassiveBudget(100)).toBe(123);
  });

  it('is 24 (quest-only) at level 1', () => {
    expect(derivePassiveBudget(1)).toBe(QUEST_PASSIVE_POINTS);
  });

  it('derives a mid-level budget', () => {
    expect(derivePassiveBudget(40)).toBe(63); // (40 - 1) + 24
  });

  it('clamps a level above 100 down to 100', () => {
    expect(derivePassiveBudget(150)).toBe(123);
  });

  it('clamps a level below 1 up to 1', () => {
    expect(derivePassiveBudget(0)).toBe(QUEST_PASSIVE_POINTS);
    expect(derivePassiveBudget(-5)).toBe(QUEST_PASSIVE_POINTS);
  });

  it('truncates a fractional level', () => {
    expect(derivePassiveBudget(40.9)).toBe(63);
  });

  it('falls back to level 1 for a non-finite level', () => {
    expect(derivePassiveBudget(NaN)).toBe(QUEST_PASSIVE_POINTS);
  });
});
