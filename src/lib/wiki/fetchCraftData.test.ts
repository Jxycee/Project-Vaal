import { describe, expect, it } from 'vitest';
import { extractBaseData, extractIsRune, extractModData } from './fetchCraftData';

// Failure modes first (AGENTS.md). Each extractor turns one wiki detail file
// into what the craft validator (build/validate/affixRules.ts) reads, and
// answers null — "does not exist" — for anything it cannot use, never a
// half-filled record.

describe('extractModData', () => {
  it('reads a prefix with its rolls and spawn weights', () => {
    expect(
      extractModData({
        slug: 'addedcolddamage1',
        generationType: 'Prefix',
        group: 'ColdDamage',
        level: 1,
        domain: 'Item',
        rolls: [{ stat: 'a', min: 1, max: 1 }, { stat: 'b', min: 2, max: 3 }],
        spawnWeights: [{ tag: 'ring', weight: 1 }],
      }),
    ).toEqual({
      kind: 'prefix',
      group: 'ColdDamage',
      level: 1,
      domain: 'Item',
      rolls: [{ min: 1, max: 1 }, { min: 2, max: 3 }],
      spawnWeights: [{ tag: 'ring', weight: 1 }],
    });
  });

  it("calls anything that is not a Prefix or Suffix 'other'", () => {
    expect(extractModData({ generationType: 'Unique', group: 'G', level: 1, domain: 'Item', rolls: [], spawnWeights: [] })?.kind).toBe('other');
  });

  it('drops malformed rolls and spawn weights one at a time', () => {
    const m = extractModData({
      generationType: 'Suffix',
      group: 'G',
      level: 1,
      domain: 'Item',
      rolls: [{ min: 1, max: 2 }, { min: 'x', max: 2 }, null],
      spawnWeights: [{ tag: 'ring', weight: 1 }, { tag: 5, weight: 1 }],
    });
    expect(m?.rolls).toEqual([{ min: 1, max: 2 }]);
    expect(m?.spawnWeights).toEqual([{ tag: 'ring', weight: 1 }]);
  });

  it('is null for a payload with no group or domain, or not an object', () => {
    for (const raw of [null, 'x', [], {}, { generationType: 'Prefix', domain: 'Item' }, { generationType: 'Prefix', group: 'G' }]) {
      expect(extractModData(raw)).toBeNull();
    }
  });
});

describe('extractBaseData', () => {
  it('reads tags, domain, implicit lines and unique lines', () => {
    expect(
      extractBaseData({
        tags: ['default', 'ring'],
        modDomain: 'Item',
        implicitMods: ['+(7-13)% to Chaos Resistance'],
        uniqueMods: { explicitMods: ['+(30-50)% to Fire Resistance', 7] },
      }),
    ).toEqual({ tags: ['default', 'ring'], modDomain: 'Item', implicitLines: ['+(7-13)% to Chaos Resistance'], uniqueLines: ['+(30-50)% to Fire Resistance'] });
  });

  it('defaults missing arrays and a missing domain rather than failing', () => {
    expect(extractBaseData({ kind: 'item' })).toEqual({ tags: [], modDomain: null, implicitLines: [], uniqueLines: [] });
  });

  it('is null for a non-object', () => {
    for (const raw of [null, 'x', []]) expect(extractBaseData(raw)).toBeNull();
  });
});

describe('extractIsRune', () => {
  it('is true only for a SoulCore item', () => {
    expect(extractIsRune({ category: 'SoulCore' })).toBe(true);
    expect(extractIsRune({ category: 'Ring' })).toBe(false);
    expect(extractIsRune(null)).toBe(false);
  });
});
