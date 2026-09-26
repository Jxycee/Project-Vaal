import { describe, expect, it } from 'vitest';
import { bestRolls, clampToRange, craftSummary, emptyCraft, MAX_ITEM_QUALITY, parseCraft, rangesIn, rollAt } from '../craft';

// Failure modes first (AGENTS.md). parseCraft READS stored jsonb: it must
// default every missing field and drop a malformed entry on its own, never
// the whole item — an old row simply has no `craft` at all.

describe('rangesIn — the "(a-b)" parser', () => {
  it('reads a single integer range, ignoring the sign and text around it', () => {
    expect(rangesIn('+(7-13)% to Chaos Resistance')).toEqual([{ min: 7, max: 13 }]);
  });

  it('reads two ranges on one line, in order', () => {
    expect(rangesIn('Adds (1-2) to (3-5) Cold damage to Attacks')).toEqual([
      { min: 1, max: 2 },
      { min: 3, max: 5 },
    ]);
  });

  it('reads decimals and negative bounds', () => {
    expect(rangesIn('(0.5-1.5)% of Life Regenerated')).toEqual([{ min: 0.5, max: 1.5 }]);
    expect(rangesIn('(-10--5)% to Fire Resistance')).toEqual([{ min: -10, max: -5 }]);
  });

  it('finds nothing in a fixed line or a bare number', () => {
    expect(rangesIn('50% of Physical Damage taken as Fire Damage')).toEqual([]);
    expect(rangesIn('25 to 35 Fire Thorns damage')).toEqual([]);
    expect(rangesIn('')).toEqual([]);
  });
});

describe('emptyCraft', () => {
  it('starts a unique as unique and anything else as normal, with nothing chosen', () => {
    expect(emptyCraft(true).rarity).toBe('unique');
    expect(emptyCraft(false)).toEqual({
      rarity: 'normal',
      name: null,
      itemLevel: null,
      quality: 0,
      corrupted: false,
      implicitValues: [],
      uniqueValues: [],
      prefixes: [],
      suffixes: [],
      runes: [],
    });
  });
});

describe('parseCraft — every way stored data can be wrong', () => {
  it('returns undefined for no craft at all, so old rows read exactly as before', () => {
    expect(parseCraft(undefined, false)).toBeUndefined();
    expect(parseCraft(null, false)).toBeUndefined();
  });

  it('falls back to the empty craft for a non-object', () => {
    expect(parseCraft('nope', false)).toEqual(emptyCraft(false));
    expect(parseCraft([], true)).toEqual(emptyCraft(true));
  });

  it('defaults each malformed field on its own and keeps the good ones', () => {
    const parsed = parseCraft(
      {
        rarity: 'legendary',
        name: 42,
        itemLevel: 250,
        quality: -3,
        corrupted: 'yes',
        prefixes: [{ slug: 'addedcolddamage1', values: [1, 3] }],
      },
      false,
    );
    expect(parsed).toMatchObject({
      rarity: 'normal',
      name: null,
      itemLevel: null,
      quality: 0,
      corrupted: false,
      prefixes: [{ slug: 'addedcolddamage1', values: [1, 3] }],
    });
  });

  it('clamps quality to 0–MAX_ITEM_QUALITY and truncates it', () => {
    expect(parseCraft({ quality: 99 }, false)!.quality).toBe(MAX_ITEM_QUALITY);
    expect(parseCraft({ quality: 7.9 }, false)!.quality).toBe(7);
  });

  it('drops one malformed affix without dropping its siblings', () => {
    const parsed = parseCraft(
      {
        suffixes: [
          { slug: 'strength1', values: [5] },
          { slug: 'strength2' },
          { slug: 7, values: [1] },
          { slug: 'dexterity1', values: [3, 'x', Number.NaN] },
        ],
      },
      false,
    );
    expect(parsed!.suffixes).toEqual([
      { slug: 'strength1', values: [5] },
      { slug: 'dexterity1', values: [3] },
    ]);
  });

  it('keeps value rows positionally, dropping only non-numbers inside a row', () => {
    const parsed = parseCraft({ implicitValues: [[9], 'bad', [1, 'x', 2]], uniqueValues: [[40], []] }, true);
    // A bad row becomes [] rather than disappearing, so row i still means line i.
    expect(parsed!.implicitValues).toEqual([[9], [], [1, 2]]);
    expect(parsed!.uniqueValues).toEqual([[40], []]);
  });

  it('keeps only string rune slugs, in order', () => {
    expect(parseCraft({ runes: ['adept-rune', 3, null, 'soul-core-of-tacati'] }, false)!.runes).toEqual([
      'adept-rune',
      'soul-core-of-tacati',
    ]);
  });
});

// Slice 4 Task 5: the editor clamps every value as it is typed (decision 2:
// "exact number, clamped") and starts a new affix at its best roll.
describe('clampToRange', () => {
  it('keeps a value inside, and pulls one outside to the nearer bound', () => {
    expect(clampToRange(15, { min: 10, max: 20 })).toBe(15);
    expect(clampToRange(25, { min: 10, max: 20 })).toBe(20);
    expect(clampToRange(3, { min: 10, max: 20 })).toBe(10);
  });

  it('handles a range written high-to-low, as negative ones are', () => {
    expect(clampToRange(-3, { min: -5, max: -10 })).toBe(-5);
    expect(clampToRange(-12, { min: -5, max: -10 })).toBe(-10);
  });

  it('falls back to the lower bound for a non-number', () => {
    expect(clampToRange(Number.NaN, { min: 10, max: 20 })).toBe(10);
  });
});

describe('bestRolls', () => {
  it("starts each roll at its max — the planner's usual target", () => {
    expect(bestRolls([{ min: 1, max: 1 }, { min: 2, max: 3 }])).toEqual([1, 3]);
  });

  it('takes the larger magnitude end of a negative range', () => {
    expect(bestRolls([{ min: -5, max: -10 }])).toEqual([-10]);
  });

  it('takes the top of a "reduced" roll as our data writes it (min -20, max -18), not its weakest end', () => {
    // "(18-20)% reduced Charges per use" is stored as rolls -20..-18; its best
    // roll is 20% reduced. Taking `max` started every such affix at 18%.
    expect(bestRolls([{ min: -20, max: -18 }])).toEqual([-20]);
  });
});

// PoB's {range:x} measures along the line AS DISPLAYED (itemLib.applyRange):
// "(18-20)% reduced" at 1 is "20% reduced". Our data stores that roll as
// -20..-18, so a fraction must run from -18 to -20, not from min to max.
describe('rollAt — a display-order fraction on a stored roll', () => {
  it('reads a positive roll from min to max, rounding an integer range', () => {
    expect(rollAt({ min: 120, max: 149 }, 1)).toBe(149);
    expect(rollAt({ min: 120, max: 149 }, 0)).toBe(120);
    expect(rollAt({ min: 311, max: 380 }, 0.951)).toBe(377);
  });

  it('reads a negative ("reduced") roll from its smaller to its larger magnitude, whichever way it is stored', () => {
    for (const roll of [{ min: -20, max: -18 }, { min: -18, max: -20 }]) {
      expect(rollAt(roll, 1)).toBe(-20);
      expect(rollAt(roll, 0)).toBe(-18);
      expect(rollAt(roll, 0.5)).toBe(-19);
    }
  });

  it('reads a range across zero from min to max (Ingenuity\'s "(-10-10)%")', () => {
    expect(rollAt({ min: -10, max: 10 }, 1)).toBe(10);
    expect(rollAt({ min: -10, max: 10 }, 0)).toBe(-10);
  });

  it('keeps a decimal range\'s precision', () => {
    expect(rollAt({ min: 0.5, max: 1.5 }, 0.25)).toBe(0.75);
  });

  it('is empty for a mod with no rolls', () => {
    expect(bestRolls([])).toEqual([]);
  });
});

describe('craftSummary — the one-line craft description both gear lists show', () => {
  it('names rarity and affix count, pluralised', () => {
    expect(craftSummary({ ...emptyCraft(false), rarity: 'magic', prefixes: [{ slug: 'a', values: [] }] })).toBe('magic · 1 affix');
    expect(craftSummary({ ...emptyCraft(false), rarity: 'normal' })).toBe('normal · 0 affixes');
  });

  it('adds runes and corruption only when present', () => {
    expect(
      craftSummary({ ...emptyCraft(false), rarity: 'rare', prefixes: [{ slug: 'a', values: [] }], suffixes: [{ slug: 'b', values: [] }, { slug: 'c', values: [] }], runes: ['r', 's'], corrupted: true }),
    ).toBe('rare · 3 affixes · 2 runes · corrupted');
    expect(craftSummary({ ...emptyCraft(true), runes: ['r'] })).toBe('unique · 0 affixes · 1 rune');
  });
});
