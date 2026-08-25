import { describe, it, expect } from 'vitest';
import { buildMentionIndex, resolveMentionTarget } from './mentions';
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

  it('registers a search-fallback target for a tiered family with no bare entry', () => {
    const { targets } = buildMentionIndex([
      [],
      [
        entry({ name: "Lesser Jeweller's Orb", kind: 'item', slug: 'lesser-jewellers-orb' }),
        entry({ name: "Greater Jeweller's Orb", kind: 'item', slug: 'greater-jewellers-orb' }),
      ],
      [],
    ]);
    expect(targets.get("Jeweller's Orb")).toEqual({ kind: 'item', query: "Jeweller's Orb" });
  });

  it('strips a "(Tier N)" suffix for the same family fallback, single-word base included', () => {
    const { targets } = buildMentionIndex([
      [],
      [
        entry({ name: 'Waystone (Tier 1)', kind: 'item', slug: 'waystone-tier-1' }),
        entry({ name: 'Waystone (Tier 2)', kind: 'item', slug: 'waystone-tier-2' }),
      ],
      [],
    ]);
    expect(targets.get('Waystone')).toEqual({ kind: 'item', query: 'Waystone' });
  });

  it('does not register a family fallback for a single tiered variant', () => {
    const { targets } = buildMentionIndex([
      [],
      [entry({ name: 'Lesser Eldritch Ember', kind: 'item', slug: 'lesser-eldritch-ember' })],
      [],
    ]);
    expect(targets.has('Eldritch Ember')).toBe(false);
  });

  it('never lets a family fallback shadow a real bare entry (Orb of Transmutation has one)', () => {
    const { targets } = buildMentionIndex([
      [],
      [
        entry({ name: 'Orb of Transmutation', kind: 'item', slug: 'orb-of-transmutation' }),
        entry({ name: 'Greater Orb of Transmutation', kind: 'item', slug: 'greater-orb-of-transmutation' }),
        entry({ name: 'Perfect Orb of Transmutation', kind: 'item', slug: 'perfect-orb-of-transmutation' }),
      ],
      [],
    ]);
    expect(targets.get('Orb of Transmutation')).toEqual({ kind: 'item', slug: 'orb-of-transmutation' });
  });

  it('matches a plural mention ("Chaos Orbs") whole, including the trailing s', () => {
    const { pattern } = buildMentionIndex([[], [entry({ name: 'Chaos Orb', kind: 'item', slug: 'chaos-orb' })], []]);
    expect('drop as Chaos Orbs instead'.split(pattern)).toEqual(['drop as ', 'Chaos Orbs', ' instead']);
  });

});

describe('resolveMentionTarget', () => {
  it('resolves an exact match directly', () => {
    const index = buildMentionIndex([[], [entry({ name: 'Chaos Orb', kind: 'item', slug: 'chaos-orb' })], []]);
    expect(resolveMentionTarget('Chaos Orb', index)).toEqual({ kind: 'item', slug: 'chaos-orb' });
  });

  it('falls back to the singular form for a plural match', () => {
    const index = buildMentionIndex([[], [entry({ name: 'Chaos Orb', kind: 'item', slug: 'chaos-orb' })], []]);
    expect(resolveMentionTarget('Chaos Orbs', index)).toEqual({ kind: 'item', slug: 'chaos-orb' });
  });

  it('resolves a plural mention of a tiered family to its search fallback', () => {
    const index = buildMentionIndex([
      [],
      [
        entry({ name: "Lesser Jeweller's Orb", kind: 'item', slug: 'lesser-jewellers-orb' }),
        entry({ name: "Greater Jeweller's Orb", kind: 'item', slug: 'greater-jewellers-orb' }),
      ],
      [],
    ]);
    expect(resolveMentionTarget("Jeweller's Orbs", index)).toEqual({ kind: 'item', query: "Jeweller's Orb" });
  });

  it('returns undefined for text with no target, plural or not', () => {
    const index = buildMentionIndex([[], [entry({ name: 'Chaos Orb', kind: 'item', slug: 'chaos-orb' })], []]);
    expect(resolveMentionTarget('Regrets', index)).toBeUndefined();
  });
});
