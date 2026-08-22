import { describe, it, expect } from 'vitest';
import { buildMentionIndex } from './mentions';
import type { WikiSearchEntry } from './types';

const entry = (over: Partial<WikiSearchEntry>): WikiSearchEntry => ({
  slug: 'x', name: 'X', kind: 'item', category: 'c', tags: [], ...over,
});

describe('buildMentionIndex', () => {
  it('excludes single-word names for every kind, keeps multi-word ones', () => {
    const { targets } = buildMentionIndex([
      [entry({ name: 'Maim', kind: 'skill', slug: 'maim' })],
      [
        entry({ name: 'Spark', kind: 'item', slug: 'spark' }),
        entry({ name: 'Chaos Orb', kind: 'item', slug: 'chaos-orb' }),
      ],
      [
        entry({ name: 'Vaal', kind: 'mod', slug: 'vaal-mod' }),
        entry({ name: 'of the Brute', kind: 'mod', slug: 'strength1' }),
      ],
    ]);
    // Real user report: a mod's "chance to Maim on Hit" line linked to the
    // "Maim" support gem instead of naming the ailment it applies - a
    // single-word skill/item name is just as likely to collide with the
    // game's own status-effect vocabulary as a single-word mod name is.
    expect(targets.has('Maim')).toBe(false);
    expect(targets.has('Spark')).toBe(false);
    expect(targets.has('Vaal')).toBe(false);
    expect(targets.get('Chaos Orb')).toEqual({ kind: 'item', slug: 'chaos-orb' });
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
        entry({ name: 'Orb of Alchemy', kind: 'item', slug: 'orb-of-alchemy' }),
        entry({ name: 'Greater Orb of Alchemy', kind: 'item', slug: 'greater-orb-of-alchemy' }),
      ],
      [],
    ]);
    const parts = 'Use a Greater Orb of Alchemy.'.split(pattern);
    expect(parts).toEqual(['Use a ', 'Greater Orb of Alchemy', '.']);
    expect(targets.get(parts[1])).toEqual({ kind: 'item', slug: 'greater-orb-of-alchemy' });
  });

  it('produces a pattern matching nothing when there are no eligible names', () => {
    const { pattern } = buildMentionIndex([[], [], [entry({ name: 'Vaal', kind: 'mod', slug: 'x' })]]);
    expect('Vaal appears here'.split(pattern)).toEqual(['Vaal appears here']);
  });
});
