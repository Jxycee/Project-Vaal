import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractMaxGemLevel, extractReservationScaling, fetchMaxGemLevel } from './fetchGemScaling';

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

// Slice 3: the reservation half of a skill's scaling, for the reserved-Spirit
// total. Failure modes first — a malformed payload must read as "no data"
// (null), never as "reserves nothing" (an empty or zero list).
describe('extractReservationScaling', () => {
  it('keeps level and reservation from each well-formed entry, null reservation included', () => {
    expect(
      extractReservationScaling({ scaling: [{ level: 1, reservation: 30, cost: null }, { level: 2, reservation: null }] }),
    ).toEqual([
      { level: 1, reservation: 30 },
      { level: 2, reservation: null },
    ]);
  });

  it('treats a missing or non-numeric reservation as null, not as a number', () => {
    expect(extractReservationScaling({ scaling: [{ level: 1 }, { level: 2, reservation: '30' }] })).toEqual([
      { level: 1, reservation: null },
      { level: 2, reservation: null },
    ]);
  });

  it('drops entries without a numeric level', () => {
    expect(extractReservationScaling({ scaling: [{ reservation: 30 }, null, { level: 3, reservation: 10 }] })).toEqual([
      { level: 3, reservation: 10 },
    ]);
  });

  it('returns null — no data — for a payload with no usable scaling at all', () => {
    for (const raw of [null, undefined, 'garbage', 42, [], {}, { scaling: 'nope' }, { scaling: [] }, { scaling: [{ nope: 1 }] }]) {
      expect(extractReservationScaling(raw)).toBeNull();
    }
  });
});

// A failed load used to answer 1, and every caller took 1 as the gem's real
// cap: swapping a skill on a flaky connection clamped its level to 1 and saved
// that, and the level input then refused anything above 1 (review 2026-09-26).
// "Could not load" is now null, which callers treat as "do not clamp".
describe('fetchMaxGemLevel — a failed load is unknown, not a cap of 1', () => {
  const answer = (init: { status?: number; type?: string; body?: string; throws?: boolean }) =>
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        if (init.throws) throw new TypeError('Failed to fetch');
        return new Response(init.body ?? '{}', { status: init.status ?? 200, headers: { 'content-type': init.type ?? 'application/json' } });
      }),
    );
  afterEach(() => vi.unstubAllGlobals());

  it('reads the cap from a loaded file', async () => {
    answer({ body: JSON.stringify({ scaling: [{ level: 1 }, { level: 20 }] }) });
    expect(await fetchMaxGemLevel('fireball')).toBe(20);
  });

  it('is null for an error status, a non-JSON answer (the /login redirect), or a network failure', async () => {
    answer({ status: 500 });
    expect(await fetchMaxGemLevel('fireball')).toBeNull();
    answer({ type: 'text/html', body: '<html>login</html>' });
    expect(await fetchMaxGemLevel('fireball')).toBeNull();
    answer({ throws: true });
    expect(await fetchMaxGemLevel('fireball')).toBeNull();
  });
});
