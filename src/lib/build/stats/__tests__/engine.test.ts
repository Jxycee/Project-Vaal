import { describe, expect, it } from 'vitest';
import { computeDefences, type Contribution, type EngineInput } from '../engine';

// Failure modes first (AGENTS.md). Every expectation is worked by hand from
// the PoB2 lines the engine cites, so a wrong formula fails here rather than
// on a real build where the error hides inside a big number.

const input = (over: Partial<EngineInput> = {}): EngineInput => ({
  level: 1,
  classBase: { str: 7, dex: 7, int: 15 },
  contributions: [],
  resistancePenalty: 0,
  flags: { giantsBlood: false, lordOfTheWilds: false, noSpirit: false },
  ...over,
});
const c = (pool: Contribution['pool'], value: number, kind: Contribution['kind'] = 'flat'): Contribution => ({ pool, kind, value, source: 'test' });

describe('computeDefences — a naked level-1 character', () => {
  it('has PoB2 base Life 28 + 2/Str, Mana 34 + 2/Int, Evasion 7, nothing else', () => {
    const d = computeDefences(input());
    // Life: 12 x 1 + 16 + 2 x 7 = 42. Mana: 4 x 1 + 30 + 2 x 15 = 64.
    expect(d.life).toBe(42);
    expect(d.mana).toBe(64);
    expect(d.evasion).toBe(7);
    expect(d.armour).toBe(0);
    expect(d.energyShield).toBe(0);
    expect(d.spirit).toBe(0);
    expect([d.str, d.dex, d.int]).toEqual([7, 7, 15]);
  });
});

describe('computeDefences — attributes feed Life and Mana', () => {
  it('adds flat attributes before the per-point bonus, and applies increased attributes', () => {
    const d = computeDefences(input({ contributions: [c('str', 13), c('str', 10, 'increased')] }));
    // Str: round((7 + 13) x 1.10) = 22. Life: 12 + 16 + 44 = 72.
    expect(d.str).toBe(22);
    expect(d.life).toBe(72);
  });

  it("halves Strength's Life under Giant's Blood", () => {
    const d = computeDefences(input({ flags: { giantsBlood: true, lordOfTheWilds: false, noSpirit: false } }));
    expect(d.life).toBe(12 + 16 + 7);
  });
});

describe('computeDefences — pools', () => {
  it('scales Life by the level and increased Life, rounding once at the end', () => {
    const d = computeDefences(input({ level: 90, contributions: [c('life', 100), c('life', 15, 'increased')] }));
    // (12 x 90 + 16 + 14 + 100) x 1.15 = 1210 x 1.15 = 1391.5 -> round -> 1392
    expect(d.life).toBe(1392);
  });

  it('adds global increased defences to flat item defences', () => {
    const d = computeDefences(input({ contributions: [c('armour', 400), c('armour', 50, 'increased'), c('energyShield', 120), c('energyShield', 25, 'increased')] }));
    expect(d.armour).toBe(600);
    expect(d.energyShield).toBe(150);
  });

  it('never lets a pool go negative', () => {
    const d = computeDefences(input({ contributions: [c('armour', 100), c('armour', -300, 'increased')] }));
    expect(d.armour).toBe(0);
  });
});

describe('computeDefences — resistances', () => {
  it('applies the campaign penalty to elemental resistances only, not chaos', () => {
    const d = computeDefences(input({ resistancePenalty: -60, contributions: [c('fireRes', 50), c('chaosRes', 10)] }));
    expect(d.fire).toEqual({ value: -10, max: 75, uncapped: -10 });
    expect(d.chaos).toEqual({ value: 10, max: 75, uncapped: 10 });
  });

  it('caps at 75, raises the cap with max resistance, and never past 90', () => {
    const d = computeDefences(input({ contributions: [c('coldRes', 120), c('coldMax', 3), c('lightningRes', 120), c('lightningMax', 30)] }));
    expect(d.cold).toEqual({ value: 78, max: 78, uncapped: 120 });
    expect(d.lightning).toEqual({ value: 90, max: 90, uncapped: 120 });
  });

  it('truncates fractional resistances, as PoB2 does', () => {
    expect(computeDefences(input({ contributions: [c('fireRes', 10.9)] })).fire.value).toBe(10);
  });
});

describe('computeDefences — Spirit', () => {
  it('sums flat Spirit and applies increased Spirit', () => {
    expect(computeDefences(input({ contributions: [c('spirit', 100), c('spirit', 10), c('spirit', 8, 'increased')] })).spirit).toBe(119);
  });

  it('halves it under Lord of the Wilds, and zeroes it under "You have no Spirit"', () => {
    const contributions = [c('spirit', 100)];
    expect(computeDefences(input({ contributions, flags: { giantsBlood: false, lordOfTheWilds: true, noSpirit: false } })).spirit).toBe(50);
    expect(computeDefences(input({ contributions, flags: { giantsBlood: false, lordOfTheWilds: false, noSpirit: true } })).spirit).toBe(0);
  });
});

describe('computeDefences — bad input', () => {
  it('clamps a level outside 1–100 instead of producing nonsense', () => {
    expect(computeDefences(input({ level: 0 })).life).toBe(42);
    expect(computeDefences(input({ level: 1000 })).life).toBe(12 * 100 + 16 + 14);
  });

  it('ignores a non-finite contribution rather than poisoning the total', () => {
    expect(computeDefences(input({ contributions: [c('life', Number.NaN), c('life', 10)] })).life).toBe(52);
  });
});
