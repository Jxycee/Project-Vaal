import { describe, it, expect } from 'vitest';
import { emptyGearState, isGearItem, parseGearState } from '../gearState';
import { GEAR_SLOTS } from '../gearSlots';
import type { GearItem } from '../gearSlots';

const boots: GearItem = { slug: 'wanderlust', name: 'Wanderlust', category: 'Boots', isUnique: true, iconUrl: null };

describe('emptyGearState', () => {
  it('has all 17 slots present and null', () => {
    const state = emptyGearState();
    expect(Object.keys(state)).toHaveLength(17);
    for (const slot of GEAR_SLOTS) {
      expect(state[slot]).toBeNull();
    }
  });
});

describe('isGearItem', () => {
  it('accepts a well-formed item', () => {
    expect(isGearItem(boots)).toBe(true);
    expect(isGearItem({ ...boots, iconUrl: 'https://example.com/icon.png' })).toBe(true);
  });

  it('rejects malformed values', () => {
    expect(isGearItem(null)).toBe(false);
    expect(isGearItem(undefined)).toBe(false);
    expect(isGearItem('Wanderlust')).toBe(false);
    expect(isGearItem({ ...boots, isUnique: 'yes' })).toBe(false);
    expect(isGearItem({ ...boots, iconUrl: 123 })).toBe(false);
    expect(isGearItem({ name: 'Wanderlust' })).toBe(false);
  });
});

describe('parseGearState', () => {
  it('returns an all-null state for non-object input (new build, missing column)', () => {
    for (const raw of [null, undefined, 'garbage', 42, []]) {
      const state = parseGearState(raw);
      for (const slot of GEAR_SLOTS) expect(state[slot]).toBeNull();
    }
  });

  it('round-trips a well-formed stored object', () => {
    const state = parseGearState({ boots });
    expect(state.boots).toEqual(boots);
    // Every other slot still defaults to null rather than being absent.
    expect(state.head).toBeNull();
    expect(Object.keys(state)).toHaveLength(17);
  });

  it('drops unknown keys (e.g. a stale/renamed slot) without throwing', () => {
    const state = parseGearState({ boots, notASlot: boots, jewels: [boots] });
    expect(state.boots).toEqual(boots);
    expect((state as Record<string, unknown>).notASlot).toBeUndefined();
  });

  it('falls back one malformed slot to null without blanking the others', () => {
    const state = parseGearState({ boots, head: { name: 'onlyAName' } });
    expect(state.boots).toEqual(boots);
    expect(state.head).toBeNull();
  });

  it('accepts an explicit null for a slot', () => {
    const state = parseGearState({ boots: null });
    expect(state.boots).toBeNull();
  });
});
