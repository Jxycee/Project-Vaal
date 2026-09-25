import { describe, expect, it } from 'vitest';
import { MAX_ASCENDANCY_POINTS } from '../../constants';
import type { GearItem } from '../../gearSlots';
import { emptyGearState, type GearState } from '../../gearState';
import type { PassiveState } from '../../types';
import { MAX_WEAPON_SET_POINTS, validateCheckpoint } from '../index';

// Failure modes first (AGENTS.md).

const item = (name: string, category: string): GearItem => ({ slug: name.toLowerCase().replace(/\s+/g, '-'), name, category, isUnique: false, iconUrl: null });
const EMPTY_TREE: PassiveState = { set1: [], set2: [], ascendancyNodes: [] };
const range = (from: number, count: number) => Array.from({ length: count }, (_, i) => from + i);

describe('validateCheckpoint — every way it could be wrong', () => {
  it('returns nothing for an empty checkpoint', () => {
    expect(validateCheckpoint({ passive: EMPTY_TREE, gear: emptyGearState() })).toEqual([]);
  });

  it('flags an item stored in a slot its category never fits, targeted at that slot', () => {
    const gear: GearState = { ...emptyGearState(), head: item('Plain Ring', 'Ring'), weapon1_off: item('Plain Wand', 'Wand') };
    const warnings = validateCheckpoint({ passive: EMPTY_TREE, gear });
    expect(warnings.map((w) => [w.code, w.target])).toEqual([
      ['slot-category-mismatch', { kind: 'gear', slot: 'head' }],
      ['slot-category-mismatch', { kind: 'gear', slot: 'weapon1_off' }],
    ]);
  });

  it('counts weapon-set points as the nodes in only one set: 24 is fine, 25 is over', () => {
    const shared = range(1, 50);
    const atCap: PassiveState = { set1: [...shared, ...range(100, MAX_WEAPON_SET_POINTS)], set2: shared, ascendancyNodes: [] };
    expect(validateCheckpoint({ passive: atCap, gear: emptyGearState() })).toEqual([]);

    const over: PassiveState = { set1: shared, set2: [...shared, ...range(200, MAX_WEAPON_SET_POINTS + 1)], ascendancyNodes: [] };
    const warnings = validateCheckpoint({ passive: over, gear: emptyGearState() });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: 'weapon-set-points-over', target: { kind: 'tree' } });
    expect(warnings[0].message).toContain('Set II');
    expect(warnings[0].message).toContain(`${MAX_WEAPON_SET_POINTS + 1}`);
  });

  it(`flags more than ${MAX_ASCENDANCY_POINTS} ascendancy points, and not exactly ${MAX_ASCENDANCY_POINTS}`, () => {
    const at = (n: number) => validateCheckpoint({ passive: { ...EMPTY_TREE, ascendancyNodes: range(1, n) }, gear: emptyGearState() });
    expect(at(MAX_ASCENDANCY_POINTS)).toEqual([]);
    expect(at(MAX_ASCENDANCY_POINTS + 1).map((w) => w.code)).toEqual(['ascendancy-points-over']);
  });

  it('orders tree warnings first, then gear in slot order, stably', () => {
    const gear: GearState = {
      ...emptyGearState(),
      weapon2_main: item('Siege Crossbow', 'Crossbow'),
      weapon2_off: item('Plain Shield', 'Shield'),
      belt: item('Plain Ring', 'Ring'),
    };
    const passive = { ...EMPTY_TREE, ascendancyNodes: range(1, MAX_ASCENDANCY_POINTS + 1) };
    const first = validateCheckpoint({ passive, gear });
    expect(first.map((w) => w.code)).toEqual(['ascendancy-points-over', 'slot-category-mismatch', 'two-handed-occupied']);
    expect(validateCheckpoint({ passive, gear })).toEqual(first);
  });
});

describe('validateCheckpoint — with craft data (Slice 4)', () => {
  const ring: GearItem = {
    slug: 'amethyst-ring',
    name: 'Amethyst Ring',
    category: 'Ring',
    isUnique: false,
    iconUrl: null,
    craft: { rarity: 'normal', name: null, itemLevel: null, quality: 0, corrupted: false, implicitValues: [], uniqueValues: [], prefixes: [{ slug: 'x', values: [] }], suffixes: [], runes: [] },
  };
  const craftData = { mods: new Map(), bases: new Map(), runes: new Map() };

  it('adds craft warnings in slot order, jewels after every gear slot', () => {
    const gear: GearState = { ...emptyGearState(), ring1: ring, belt: item('Plain Ring', 'Ring'), jewels: { '26725': { ...ring, category: 'Jewel' } } };
    const warnings = validateCheckpoint({ passive: EMPTY_TREE, gear, craftData });
    expect(warnings.map((w) => [w.code, w.target])).toEqual([
      ['affix-over-limit', { kind: 'gear', slot: 'ring1' }],
      ['slot-category-mismatch', { kind: 'gear', slot: 'belt' }],
      ['affix-over-limit', { kind: 'jewel', nodeId: '26725' }],
    ]);
  });

  it('skips craft checks entirely when no craft data is passed', () => {
    const gear: GearState = { ...emptyGearState(), ring1: ring };
    expect(validateCheckpoint({ passive: EMPTY_TREE, gear })).toEqual([]);
  });
});
