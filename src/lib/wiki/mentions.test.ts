import { describe, it, expect } from 'vitest';
import { buildMentionIndex } from './mentions';
import type { WikiSearchEntry } from './types';

const entry = (over: Partial<WikiSearchEntry>): WikiSearchEntry => ({
  slug: 'x', name: 'X', kind: 'item', category: 'c', tags: [], ...over,
});

describe('buildMentionIndex', () => {
  it('includes item and skill names regardless of word count', () => {
    const { targets } = buildMentionIndex([
      [entry({ name: 'Spark', kind: 'skill', slug: 'spark' })],
      [entry({ name: 'Chaos Orb', kind: 'item', slug: 'chaos-orb' })],
    ]);
    expect(targets.get('Spark')).toEqual({ kind: 'skill', slug: 'spark' });
    expect(targets.get('Chaos Orb')).toEqual({ kind: 'item', slug: 'chaos-orb' });
  });

  it('excludes single-word mod names but keeps multi-word ones', () => {
    const { targets } = buildMentionIndex([
      [],
      [],
      [
        entry({ name: 'Vaal', kind: 'mod', slug: 'vaal-mod' }),
        entry({ name: 'of the Brute', kind: 'mod', slug: 'strength1' }),
      ],
    ]);
    expect(targets.has('Vaal')).toBe(false);
    expect(targets.get('of the Brute')).toEqual({ kind: 'mod', slug: 'strength1' });
  });

  it('lets an earlier group win a name collision (skills before items)', () => {
    const { targets } = buildMentionIndex([
      [entry({ name: 'Ice Nova', kind: 'skill', slug: 'ice-nova' })],
      [entry({ name: 'Ice Nova', kind: 'item', slug: 'ice-nova' })],
    ]);
    expect(targets.get('Ice Nova')).toEqual({ kind: 'skill', slug: 'ice-nova' });
  });

  it('builds a pattern that captures whole-word matches only', () => {
    const { pattern } = buildMentionIndex([[], [entry({ name: 'Chaos Orb', kind: 'item', slug: 'chaos-orb' })], []]);
    expect('Use a Chaos Orb here.'.split(pattern)).toEqual(['Use a ', 'Chaos Orb', ' here.']);
    expect('Chaos Orbital thing'.split(pattern)).toEqual(['Chaos Orbital thing']);
  });

  it('prefers the longest name when one is a substring of another', () => {
    const { pattern, targets } = buildMentionIndex([
      [],
      [
        entry({ name: 'Scroll', kind: 'item', slug: 'scroll' }),
        entry({ name: 'Scroll of Wisdom', kind: 'item', slug: 'scroll-of-wisdom' }),
      ],
      [],
    ]);
    const parts = 'Use a Scroll of Wisdom.'.split(pattern);
    expect(parts).toEqual(['Use a ', 'Scroll of Wisdom', '.']);
    expect(targets.get(parts[1])).toEqual({ kind: 'item', slug: 'scroll-of-wisdom' });
  });

  it('produces a pattern matching nothing when there are no eligible names', () => {
    const { pattern } = buildMentionIndex([[], [], [entry({ name: 'Vaal', kind: 'mod', slug: 'x' })]]);
    expect('Vaal appears here'.split(pattern)).toEqual(['Vaal appears here']);
  });
});
