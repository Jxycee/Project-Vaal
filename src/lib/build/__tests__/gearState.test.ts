import { describe, it, expect } from 'vitest';
import { emptyGearState, isGearItem, parseGearState } from '../gearState';
import { GEAR_SLOTS } from '../gearSlots';
import type { GearItem } from '../gearSlots';

const boots: GearItem = { slug: 'wanderlust', name: 'Wanderlust', category: 'Boots', isUnique: true, iconUrl: null };

describe('emptyGearState', () => {
  it('has all 17 slots present and null, plus an empty jewels map', () => {
    const state = emptyGearState();
    expect(Object.keys(state)).toHaveLength(18);
    for (const slot of GEAR_SLOTS) {
      expect(state[slot]).toBeNull();
    }
    expect(state.jewels).toEqual({});
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
  it('returns an all-null state (and empty jewels) for non-object input (new build, missing column)', () => {
    for (const raw of [null, undefined, 'garbage', 42, []]) {
      const state = parseGearState(raw);
      for (const slot of GEAR_SLOTS) expect(state[slot]).toBeNull();
      expect(state.jewels).toEqual({});
    }
  });

  it('round-trips a well-formed stored object', () => {
    const state = parseGearState({ boots });
    expect(state.boots).toEqual(boots);
    // Every other slot still defaults to null rather than being absent.
    expect(state.head).toBeNull();
    expect(Object.keys(state)).toHaveLength(18);
  });

  it('drops unknown keys (e.g. a stale/renamed slot) without throwing', () => {
    const state = parseGearState({ boots, notASlot: boots });
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

  it('round-trips a well-formed jewels map, keyed by socket node id', () => {
    const state = parseGearState({ boots, jewels: { '12345': boots } });
    expect(state.boots).toEqual(boots);
    expect(state.jewels).toEqual({ '12345': boots });
  });

  it('drops a malformed jewels value (wrong top-level shape) to an empty map rather than crashing', () => {
    for (const badJewels of [[boots], 'garbage', 42, null]) {
      const state = parseGearState({ boots, jewels: badJewels });
      expect(state.boots).toEqual(boots);
      expect(state.jewels).toEqual({});
    }
  });

  it('drops one malformed jewel entry without blanking the others', () => {
    const state = parseGearState({ jewels: { '1': boots, '2': { name: 'onlyAName' } } });
    expect(state.jewels).toEqual({ '1': boots });
  });
});

// Slice 4: `craft` rides on gear-slot and jewel items. Old rows carry none and
// must read exactly as before; a stored craft is read defensively.
describe('parseGearState — item craft (Slice 4)', () => {
  const ring = { slug: 'amethyst-ring', name: 'Amethyst Ring', category: 'Ring', isUnique: false, iconUrl: null };

  it('reads an item with no craft exactly as before — no craft key appears', () => {
    const state = parseGearState({ ring1: ring });
    expect(state.ring1).toEqual(ring);
    expect(state.ring1).not.toHaveProperty('craft');
  });

  it('reads a stored craft on a gear slot and on a jewel', () => {
    const craft = { rarity: 'rare', prefixes: [{ slug: 'addedcolddamage1', values: [1, 3] }] };
    const state = parseGearState({ ring1: { ...ring, craft }, jewels: { '26725': { ...ring, slug: 'emerald', name: 'Emerald', category: 'Jewel', craft } } });
    expect(state.ring1?.craft?.rarity).toBe('rare');
    expect(state.ring1?.craft?.prefixes).toEqual([{ slug: 'addedcolddamage1', values: [1, 3] }]);
    expect(state.jewels['26725'].craft?.rarity).toBe('rare');
  });

  it('defaults a malformed craft instead of losing the item', () => {
    const state = parseGearState({ ring1: { ...ring, craft: 'garbage' } });
    expect(state.ring1?.name).toBe('Amethyst Ring');
    expect(state.ring1?.craft?.rarity).toBe('normal');
  });
});
