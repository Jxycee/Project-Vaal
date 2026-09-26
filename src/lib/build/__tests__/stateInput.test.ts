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
    // The slug becomes part of a fetch path in every viewer's browser.
    ['path-shaped item slug', { body: item({ slug: '../../api/wiki/items' }) }],
    ['upper-case item slug', { body: item({ slug: 'Kaoms-Heart' }) }],
    ['path-shaped jewel slug', { jewels: { '1': item({ slug: '../x' }) } }],
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
    ['path-shaped skill slug', { loadouts: [loadout({ skill: item({ slug: '../x' }) })] }],
    ['path-shaped support slug', { loadouts: [loadout({ supports: [item({ slug: '../x' })] })] }],
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

  // Slice 5: attribute choices must survive the gate — projecting to the three
  // keys above would drop them silently with a 200, the Slice 4 trap again.
  it('keeps well-formed attribute choices', () => {
    const result = cleanPassiveStateInput({ set1: [10], set2: [10], ascendancyNodes: [], attributeChoices: { '10': 'dex' } });
    expect(result).toEqual({ ok: true, value: { set1: [10], set2: [10], ascendancyNodes: [], attributeChoices: { '10': 'dex' } } });
  });

  it.each([
    ['an unknown attribute', { '10': 'luck' }],
    ['a non-numeric node id', { abc: 'str' }],
    ['a non-object', ['str']],
    ['more choices than a tree has attribute nodes', Object.fromEntries(Array.from({ length: 301 }, (_, i) => [String(i), 'str']))],
  ])('refuses %s', (_label, attributeChoices) => {
    expect(cleanPassiveStateInput({ set1: [], set2: [], ascendancyNodes: [], attributeChoices }).ok).toBe(false);
  });
});

// Slice 4: the gate must KEEP a well-formed craft — cleanItem used to project
// every item to five fields, which would silently drop it with a 200 — and
// must refuse, not repair, anything malformed. Shape and bounds only: whether
// a mod slug exists is the validator's job, so a resync never makes a saved
// build unsavable (plans/2026-09-25-slice4-item-affixes.md).
describe('cleanGearStateInput — item craft (Slice 4)', () => {
  const craft = (overrides: Record<string, unknown> = {}) => ({
    rarity: 'rare',
    name: 'Grim Hook',
    itemLevel: 82,
    quality: 20,
    corrupted: false,
    implicitValues: [[9]],
    uniqueValues: [],
    prefixes: [{ slug: 'addedcolddamage1', values: [1, 3] }],
    suffixes: [{ slug: 'flaskbleedingandcorruptedbloodimmunityduringeffect-1', values: [] }],
    runes: ['adept-rune'],
    ...overrides,
  });
  const withCraft = (c: unknown) => ({ ...emptyGearState(), ring1: item({ slug: 'amethyst-ring', category: 'Ring', isUnique: false, craft: c }) });

  it('keeps a well-formed craft byte-for-byte, on a slot and on a jewel', () => {
    const result = cleanGearStateInput({ ...withCraft(craft()), jewels: { '26725': item({ craft: craft() }) } });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.ring1?.craft).toEqual(craft());
      expect(result.value.jewels['26725'].craft).toEqual(craft());
    }
  });

  it('still stores an item without a craft with no craft key', () => {
    const result = cleanGearStateInput({ ...emptyGearState(), ring1: item() });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.ring1).not.toHaveProperty('craft');
  });

  it.each([
    ['an unknown rarity', { rarity: 'legendary' }],
    ['a non-string name', { name: 5 }],
    ['an over-long name', { name: 'x'.repeat(201) }],
    ['item level 0', { itemLevel: 0 }],
    ['item level 101', { itemLevel: 101 }],
    ['a fractional item level', { itemLevel: 50.5 }],
    ['quality 21', { quality: 21 }],
    ['negative quality', { quality: -1 }],
    ['a non-boolean corrupted', { corrupted: 1 }],
    ['a non-finite value', { prefixes: [{ slug: 'addedcolddamage1', values: [Number.POSITIVE_INFINITY] }] }],
    ['a string value', { implicitValues: [['9']] }],
    ['a slug with a path in it', { prefixes: [{ slug: '../etc/passwd', values: [] }] }],
    ['an upper-case slug', { suffixes: [{ slug: 'Strength1', values: [] }] }],
    ['an extra key on an affix', { prefixes: [{ slug: 'addedcolddamage1', values: [], tier: 1 }] }],
    ['seven prefixes', { prefixes: Array.from({ length: 7 }, () => ({ slug: 'addedcolddamage1', values: [] })) }],
    ['nine values on one affix', { prefixes: [{ slug: 'addedcolddamage1', values: Array(9).fill(1) }] }],
    ['seventeen implicit rows', { implicitValues: Array.from({ length: 17 }, () => [1]) }],
    ['sixty-five unique rows', { uniqueValues: Array.from({ length: 65 }, () => [1]) }],
    ['seven runes', { runes: Array(7).fill('adept-rune') }],
    ['a rune slug with underscores', { runes: ['adept_rune'] }],
    ['an unknown top-level key', { enchant: 'x' }],
    ['a missing field', { corrupted: undefined }],
  ])('refuses a craft with %s', (_label, overrides) => {
    expect(cleanGearStateInput(withCraft(craft(overrides as Record<string, unknown>))).ok).toBe(false);
  });

  it('refuses a craft that is not an object', () => {
    expect(cleanGearStateInput(withCraft('rare')).ok).toBe(false);
    expect(cleanGearStateInput(withCraft([])).ok).toBe(false);
  });

  it('fits a fully crafted 17-slot build inside MAX_STATE_JSON_LENGTH', () => {
    const big = craft({
      prefixes: Array.from({ length: 6 }, (_, i) => ({ slug: `longmodslugnumber${i}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, values: [100, 200, 300] })),
      suffixes: Array.from({ length: 6 }, (_, i) => ({ slug: `longmodslugnumber${i}xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`, values: [100, 200, 300] })),
      implicitValues: Array.from({ length: 7 }, () => [10, 20]),
      runes: Array(6).fill('greater-rune-of-the-long-name'),
    });
    const state: Record<string, unknown> = { ...emptyGearState() };
    for (const slot of Object.keys(emptyGearState()).filter((k) => k !== 'jewels')) state[slot] = item({ craft: big });
    expect(JSON.stringify(state).length).toBeLessThan(MAX_STATE_JSON_LENGTH);
    expect(cleanGearStateInput(state).ok).toBe(true);
  });
});

describe('cleanGemStateInput — craft is gear-only', () => {
  it('refuses a gem carrying a craft', () => {
    const skill = item({ slug: 'fireball', category: 'Active Skill Gems', isUnique: false, craft: { rarity: 'normal' } });
    expect(cleanGemStateInput({ loadouts: [loadout({ skill })], primaryId: null }).ok).toBe(false);
  });
});
