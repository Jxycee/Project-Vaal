import { describe, expect, it } from 'vitest';
import uniques from '@/lib/pob/data/uniques.json';
import { MIRROR_RING_NAMES } from '../collect';

// Kalandra's Touch ("Reflects opposite Ring") is recognised by name in collect.ts. This pins that name list to
// PoB2's own synced unique data, so a patch that adds a second mirror item (or renames this one) fails here
// instead of silently leaving the sheet short by a whole ring. The behaviour itself is proved end to end by
// ordinary-oracle.json in multiOracle.test.ts (its fire/cold/lightning resistances reproduce only with the
// reflected Soul Circle's +16% to all Elemental Resistances).
describe('mirror-ring uniques', () => {
  it('names exactly the uniques PoB2 gives the "Reflects opposite Ring" line', () => {
    const data = uniques as Record<string, { explicits?: string[] }>;
    const inPob = Object.entries(data)
      .filter(([, u]) => (u.explicits ?? []).some((l) => /^Reflects opposite Ring$/i.test(l)))
      .map(([name]) => name)
      .sort();
    expect(inPob.length).toBeGreaterThan(0);
    expect([...MIRROR_RING_NAMES].sort()).toEqual(inPob);
  });
});
