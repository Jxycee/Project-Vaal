import { describe, it, expect } from 'vitest';
import { extractMaxGemLevel } from './fetchGemScaling';

describe('extractMaxGemLevel', () => {
  it('returns the highest level in scaling', () => {
    const scaling = [{ level: 1 }, { level: 20 }, { level: 40 }, { level: 5 }];
    expect(extractMaxGemLevel({ scaling })).toBe(40);
  });

  it('returns 1 for a Spirit gem whose scaling maxes below 40', () => {
    expect(extractMaxGemLevel({ scaling: [{ level: 1 }, { level: 8 }, { level: 11 }, { level: 14 }] })).toBe(14);
  });

  it('falls back to 1 when scaling is missing', () => {
    expect(extractMaxGemLevel({})).toBe(1);
  });

  it('falls back to 1 when scaling is empty', () => {
    expect(extractMaxGemLevel({ scaling: [] })).toBe(1);
  });

  it('falls back to 1 for a Support Gem-shaped payload (no scaling entries with useful levels)', () => {
    expect(extractMaxGemLevel({ scaling: [{ level: 1 }] })).toBe(1);
  });

  it('ignores malformed scaling entries but keeps the well-formed ones', () => {
    expect(
      extractMaxGemLevel({ scaling: [{ level: 'nope' }, null, { notLevel: 5 }, { level: 30 }] }),
    ).toBe(30);
  });

  it('falls back to 1 for non-object input', () => {
    for (const raw of [null, undefined, 'garbage', 42, []]) {
      expect(extractMaxGemLevel(raw)).toBe(1);
    }
  });

  it('falls back to 1 when scaling is not an array', () => {
    expect(extractMaxGemLevel({ scaling: 'nope' })).toBe(1);
  });
});
