import { describe, expect, it } from 'vitest';
import {
  MAX_STATE_JSON_LENGTH,
  cleanGearStateInput,
  cleanGemStateInput,
  cleanPassiveStateInput,
  isAllowedIconUrl,
} from '@/lib/build/stateInput';
import { emptyGearState } from '@/lib/build/gearState';

const item = (overrides: Record<string, unknown> = {}) => ({
  slug: 'kaoms-heart',
  name: "Kaom's Heart",
  category: 'Body Armours',
  isUnique: true,
  iconUrl: '/data/wiki/2026-08-25/icons/items/kaoms-heart.png',
  ...overrides,
});

const loadout = (overrides: Record<string, unknown> = {}) => ({
  id: 'loadout-1',
  skill: item({ slug: 'fireball', category: 'Active Skill Gems', isUnique: false, iconUrl: '/data/wiki/2026-08-25/icons/skills/fireball.png' }),
  supports: [],
  sets: [1, 2],
  level: 20,
  quality: 0,
  ...overrides,
});

describe('isAllowedIconUrl', () => {
  it.each([
    '/data/wiki/2026-08-25/icons/items/kaoms-heart.png',
    '/data/wiki/2026-08-25/icons/skills/ice-nova.png',
    '/data/wiki/2026-08-21/icons/kaoms-heart.png', // older flat layout
  ])('accepts %j', (url) => expect(isAllowedIconUrl(url)).toBe(true));

  it.each([
    'https://attacker.example/p.gif',
    '//attacker.example/p.png',
    '/\\attacker.example/p.png',
    'javascript:alert(1)',
    '/data/wiki/2026-08-25/icons/items/../../../../evil.png',
    '/data/wiki/2026-08-25/icons/items/x.png?track=1',
    '/data/wiki/2026-08-25/icons/items/x.svg',
    '/data/tree/2026-08-25/icons/items/x.png',
    ' /data/wiki/2026-08-25/icons/items/x.png',
    '',
  ])('rejects %j', (url) => expect(isAllowedIconUrl(url)).toBe(false));
});

describe('cleanGearStateInput', () => {
  it('keeps a well-formed gear state, filling every slot', () => {
    const result = cleanGearStateInput({ body: item(), jewels: { '12345': item({ slug: 'a-jewel', category: 'Jewels' }) } });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.body).toEqual(item());
    expect(result.value.head).toBeNull();
    expect(Object.keys(result.value.jewels)).toEqual(['12345']);
  });

  it('round-trips the empty state the client sends', () => {
    expect(cleanGearStateInput(emptyGearState())).toEqual({ ok: true, value: emptyGearState() });
  });

  it('strips unknown properties from items', () => {
    const result = cleanGearStateInput({ body: item({ extra: 'x'.repeat(100) }) });
    expect(result.ok && 'extra' in (result.value.body as object)).toBe(false);
  });

  it.each([
    ['off-origin icon', { body: item({ iconUrl: 'https://attacker.example/p.gif' }) }],
    ['malformed item', { body: { name: 'Some Boots' } }],
    ['unknown slot', { cape: item() }],
    ['over-long name', { body: item({ name: 'x'.repeat(201) }) }],
    ['bad jewel key', { jewels: { 'not-a-node': item() } }],
    ['malformed jewel', { jewels: { '1': { slug: 'x' } } }],
    ['jewels not an object', { jewels: [item()] }],
    ['array', [item()]],
    ['null', null],
    ['oversized', { body: item({ extra: 'x'.repeat(MAX_STATE_JSON_LENGTH) }) }],
  ])('rejects %s', (_label, raw) => {
    expect(cleanGearStateInput(raw).ok).toBe(false);
  });
});

describe('cleanGemStateInput', () => {
  it('keeps a well-formed gem state', () => {
    const raw = { loadouts: [loadout()], primaryId: 'loadout-1' };
    const result = cleanGemStateInput(raw);
    expect(result).toEqual({ ok: true, value: raw });
  });

  it('accepts the empty state', () => {
    expect(cleanGemStateInput({ loadouts: [], primaryId: null })).toEqual({ ok: true, value: { loadouts: [], primaryId: null } });
  });

  it.each([
    ['off-origin skill icon', { loadouts: [loadout({ skill: item({ iconUrl: 'https://attacker.example/p.gif' }) })] }],
    ['off-origin support icon', { loadouts: [loadout({ supports: [item({ iconUrl: '//attacker.example/p.png' })] })] }],
    ['malformed skill', { loadouts: [loadout({ skill: { name: 'x' } })] }],
    ['malformed loadout', { loadouts: [{ skill: null }] }],
    ['dangling primaryId', { loadouts: [loadout()], primaryId: 'nope' }],
    ['over-long loadout id', { loadouts: [loadout({ id: 'x'.repeat(65) })] }],
    ['loadouts not an array', { loadouts: {} }],
  ])('rejects %s', (_label, raw) => {
    expect(cleanGemStateInput(raw).ok).toBe(false);
  });
});

describe('cleanPassiveStateInput', () => {
  it('keeps only the three known keys', () => {
    const result = cleanPassiveStateInput({ set1: [1], set2: [2], ascendancyNodes: [], extra: 1 });
    expect(result).toEqual({ ok: true, value: { set1: [1], set2: [2], ascendancyNodes: [] } });
  });

  it('rejects a missing key', () => {
    expect(cleanPassiveStateInput({ set1: [], set2: [] }).ok).toBe(false);
  });
});
