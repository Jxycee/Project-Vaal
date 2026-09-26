import { describe, expect, it } from 'vitest';
import type { ItemCraft } from '../../craft';
import { emptyCraft } from '../../craft';
import type { GearItem, GearSlot } from '../../gearSlots';
import { emptyGearState, type GearState } from '../../gearState';
import { socketLimitFor, validateCrafts, type BaseData, type CraftData, type ModData } from '../affixRules';

// Failure modes first (AGENTS.md). Every rule is a WARNING — nothing here
// blocks or drops (plans/2026-09-25-slice4-item-affixes.md, decisions 3–4).
// Data is injected: a key ABSENT from a map means "not loaded yet" (say
// nothing); a key mapped to null means "fetched, and it does not exist".

const mod = (over: Partial<ModData> = {}): ModData => ({
  kind: 'prefix',
  group: 'IncreasedLife',
  level: 1,
  domain: 'Item',
  rolls: [{ min: 10, max: 20 }],
  spawnWeights: [{ tag: 'ring', weight: 1 }, { tag: 'default', weight: 0 }],
  stats: [],
  ...over,
});

const ringBase: BaseData = { tags: ['default', 'ring'], modDomain: 'Item', implicitLines: ['+(7-13)% to Chaos Resistance'], uniqueLines: [] };

const ring = (craft: Partial<ItemCraft>, over: Partial<GearItem> = {}): GearItem => ({
  slug: 'amethyst-ring',
  name: 'Amethyst Ring',
  category: 'Ring',
  isUnique: false,
  iconUrl: null,
  craft: { ...emptyCraft(false), ...craft },
  ...over,
});

const data = (mods: Record<string, ModData | null> = {}, extra: Partial<CraftData> = {}): CraftData => ({
  mods: new Map(Object.entries(mods)),
  bases: new Map([['amethyst-ring', ringBase]]),
  runes: new Map(),
  ...extra,
});

const gear = (items: Partial<Record<GearSlot, GearItem>>): GearState => ({ ...emptyGearState(), ...items });
const codes = (g: GearState, d: CraftData) => validateCrafts(g, d).map((w) => w.code);

const p = (slug: string, values: number[] = [15]) => ({ slug, values });

describe('validateCrafts — affix counts per rarity', () => {
  const mods = { a: mod({ group: 'A' }), b: mod({ group: 'B' }), c: mod({ group: 'C' }), d: mod({ group: 'D' }) };

  it('allows a rare three prefixes and flags a fourth, on the ring row', () => {
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('a'), p('b'), p('c')] }) }), data(mods))).toEqual([]);
    const warnings = validateCrafts(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('a'), p('b'), p('c'), p('d')] }) }), data(mods));
    expect(warnings.map((w) => [w.code, w.target])).toEqual([['affix-over-limit', { kind: 'gear', slot: 'ring1' }]]);
    expect(warnings[0].message).toContain('4 prefixes');
  });

  it('allows a magic item one of each and flags a second prefix', () => {
    expect(codes(gear({ ring1: ring({ rarity: 'magic', prefixes: [p('a')], suffixes: [p('b')] }) }), data({ ...mods, b: mod({ kind: 'suffix', group: 'B' }) }))).toEqual([]);
    expect(codes(gear({ ring1: ring({ rarity: 'magic', prefixes: [p('a'), p('b')] }) }), data(mods))).toEqual(['affix-over-limit']);
  });

  it('flags any affix on a normal or a unique item', () => {
    expect(codes(gear({ ring1: ring({ rarity: 'normal', prefixes: [p('a')] }) }), data(mods))).toEqual(['affix-over-limit']);
    expect(codes(gear({ ring1: ring({ rarity: 'unique', prefixes: [p('a')] }, { isUnique: true }) }), data(mods))).toEqual(['affix-over-limit']);
  });

  it('holds a rare jewel to two of each', () => {
    const jewel = ring({ rarity: 'rare', prefixes: [p('a'), p('b'), p('c')] }, { slug: 'emerald', name: 'Emerald', category: 'Jewel' });
    const d = data(mods, { bases: new Map([['emerald', { tags: ['default', 'ring'], modDomain: 'Item', implicitLines: [], uniqueLines: [] }]]) });
    const warnings = validateCrafts({ ...emptyGearState(), jewels: { '26725': jewel } }, d);
    expect(warnings.map((w) => [w.code, w.target])).toEqual([['affix-over-limit', { kind: 'jewel', nodeId: '26725' }]]);
  });
});

describe('validateCrafts — which mod', () => {
  it('flags two affixes from the same group', () => {
    const d = data({ a: mod({ group: 'Life' }), b: mod({ group: 'Life' }) });
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('a'), p('b')] }) }), d)).toEqual(['affix-duplicate-group']);
  });

  it('flags a mod that does not exist, but says nothing about one still loading', () => {
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('ghost')] }) }), data({ ghost: null }))).toEqual(['affix-unknown']);
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('loading')] }) }), data({}))).toEqual([]);
  });

  it('flags a suffix stored as a prefix', () => {
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('s')] }) }), data({ s: mod({ kind: 'suffix' }) }))).toEqual(['affix-wrong-kind']);
  });

  it('flags a mod this base cannot roll: first-match weight 0, no matching tag, or another domain', () => {
    const blocked = mod({ spawnWeights: [{ tag: 'default', weight: 0 }, { tag: 'ring', weight: 1 }] });
    const unmatched = mod({ spawnWeights: [{ tag: 'boots', weight: 1 }] });
    const flask = mod({ domain: 'Flask' });
    for (const m of [blocked, unmatched, flask]) {
      expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('x')] }) }), data({ x: m }))).toEqual(['affix-not-eligible']);
    }
  });

  it("flags a tier above the item's level, and not when no item level is set", () => {
    const d = data({ x: mod({ level: 75 }) });
    expect(codes(gear({ ring1: ring({ rarity: 'rare', itemLevel: 60, prefixes: [p('x')] }) }), d)).toEqual(['affix-above-item-level']);
    expect(codes(gear({ ring1: ring({ rarity: 'rare', itemLevel: 75, prefixes: [p('x')] }) }), d)).toEqual([]);
    expect(codes(gear({ ring1: ring({ rarity: 'rare', itemLevel: null, prefixes: [p('x')] }) }), d)).toEqual([]);
  });
});

describe('validateCrafts — rolled values', () => {
  it('flags a value outside its roll, and a value count that does not match the rolls', () => {
    const d = data({ x: mod({ rolls: [{ min: 10, max: 20 }] }) });
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('x', [21])] }) }), d)).toEqual(['roll-out-of-range']);
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('x', [15, 3])] }) }), d)).toEqual(['roll-out-of-range']);
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('x', [10])] }) }), d)).toEqual([]);
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('x', [20])] }) }), d)).toEqual([]);
  });

  it('accepts a roll written high-to-low, as negative ranges are', () => {
    const d = data({ x: mod({ rolls: [{ min: -5, max: -10 }] }) });
    expect(codes(gear({ ring1: ring({ rarity: 'rare', prefixes: [p('x', [-7])] }) }), d)).toEqual([]);
  });

  it("checks implicit values against the base's own ranges; an unset row is fine", () => {
    expect(codes(gear({ ring1: ring({ implicitValues: [[14]] }) }), data())).toEqual(['roll-out-of-range']);
    expect(codes(gear({ ring1: ring({ implicitValues: [[13]] }) }), data())).toEqual([]);
    expect(codes(gear({ ring1: ring({ implicitValues: [[]] }) }), data())).toEqual([]);
    expect(codes(gear({ ring1: ring({ implicitValues: [[9], [1]] }) }), data())).toEqual(['roll-out-of-range']);
  });

  it("checks a unique's values against its own lines", () => {
    const cloak = ring({ rarity: 'unique', uniqueValues: [[60]] }, { slug: 'cloak-of-flame', name: 'Cloak of Flame', category: 'Body Armour', isUnique: true });
    const d = data({}, { bases: new Map([['cloak-of-flame', { tags: [], modDomain: 'Item', implicitLines: [], uniqueLines: ['+(30-50)% to Fire Resistance'] }]]) });
    expect(codes(gear({ body: cloak }), d)).toEqual(['roll-out-of-range']);
  });
});

describe('validateCrafts — runes', () => {
  it('flags more runes than the base has sockets, per PoB2 socketLimit', () => {
    const helm = (n: number) =>
      ring({ runes: Array(n).fill('adept-rune') }, { slug: 'paragon-greathelm', name: 'Paragon Greathelm', category: 'Helmet' });
    const d = data({}, { bases: new Map([['paragon-greathelm', { tags: ['helmet'], modDomain: 'Item', implicitLines: [], uniqueLines: [] }]]), runes: new Map([['adept-rune', true]]) });
    expect(codes(gear({ head: helm(3) }), d)).toEqual([]);
    expect(codes(gear({ head: helm(4) }), d)).toEqual(['runes-over-limit']);
  });

  it('says nothing about rune counts on jewellery, where PoB2 has no limit and marks runes as socketable', () => {
    expect(codes(gear({ ring1: ring({ runes: Array(6).fill('adept-rune') }) }), data({}, { runes: new Map([['adept-rune', true]]) }))).toEqual([]);
  });

  it('flags a rune that does not exist, but not one still loading', () => {
    expect(codes(gear({ ring1: ring({ runes: ['ghost-rune'] }) }), data({}, { runes: new Map([['ghost-rune', false]]) }))).toEqual(['rune-unknown']);
    expect(codes(gear({ ring1: ring({ runes: ['loading-rune'] }) }), data())).toEqual([]);
  });
});

describe('validateCrafts — what it must leave alone', () => {
  it('says nothing about items with no craft, or an empty state', () => {
    const plain: GearItem = { slug: 'amethyst-ring', name: 'Amethyst Ring', category: 'Ring', isUnique: false, iconUrl: null };
    expect(validateCrafts(gear({ ring1: plain }), data())).toEqual([]);
    expect(validateCrafts(emptyGearState(), data())).toEqual([]);
  });
});

describe('socketLimitFor — PoB2 socketLimit by base group', () => {
  it.each([
    ['Two Hand Sword', 4], ['Bow', 4], ['Crossbow', 4], ['Staff', 4], ['Warstaff', 4], ['Talisman', 4], ['Body Armour', 4],
    ['One Hand Axe', 3], ['Dagger', 3], ['Spear', 3], ['Sceptre', 3], ['Wand', 3], ['Shield', 3], ['Buckler', 3],
    ['Focus', 3], ['Focii', 3], ['Helmet', 3], ['Gloves', 3], ['Boots', 3],
    ['Ring', null], ['Amulet', null], ['Belt', null], ['Quiver', null], ['Jewel', null],
  ])('%s → %s', (category, limit) => {
    expect(socketLimitFor({ category, slug: 'x' })).toBe(limit);
  });

  it('reads a unique mace by its known base', () => {
    expect(socketLimitFor({ category: 'Mace', slug: 'hrimnors-hymn' })).toBe(4);
    expect(socketLimitFor({ category: 'Mace', slug: 'frostbreath' })).toBe(3);
    expect(socketLimitFor({ category: 'Mace', slug: 'unknown-mace' })).toBeNull();
  });
});

// Some bases' implicits change the craft rules themselves (checked on disk
// 2026-09-26): Dusk/Gloam/Penumbra/Tenebrous and a few other amulets and rings
// shift the prefix/suffix limits ("+1 Prefix Modifier allowed"), and the
// Grasping Mail bodies "Can roll Ring Modifiers". Ignoring them gave false
// over-limit warnings, missed real ones, and refused every ring mod on the
// Grasping Mail. PoB2 applies the limit shifts in Item.lua:1263-1267 and
// 1750-1767 (clamped per rarity).
describe('validateCrafts — base implicits that change the craft rules', () => {
  const base = (slug: string, implicitLines: string[], tags = ['default', 'amulet']): BaseData => ({ tags, modDomain: 'Item', implicitLines, uniqueLines: [] });
  const amulet = (slug: string, craft: Partial<ItemCraft>): GearItem => ({ slug, name: slug, category: 'Amulet', isUnique: false, iconUrl: null, craft: { ...emptyCraft(false), ...craft } });
  const pre = (g: string) => mod({ group: g, spawnWeights: [{ tag: 'amulet', weight: 1 }] });
  const suf = (g: string) => mod({ kind: 'suffix', group: g, spawnWeights: [{ tag: 'amulet', weight: 1 }] });
  const mods = { p1: pre('P1'), p2: pre('P2'), p3: pre('P3'), p4: pre('P4'), p5: pre('P5'), s1: suf('S1'), s2: suf('S2'), s3: suf('S3') };
  const withBase = (slug: string, lines: string[]) => data(mods, { bases: new Map([[slug, base(slug, lines)]]) });
  const DUSK = ['+1 Prefix Modifier allowed', '-1 Suffix Modifier allowed'];
  const PENUMBRA = ['+2 Prefix Modifiers allowed', '-2 Suffix Modifiers allowed'];

  it('lets a rare Dusk Amulet take four prefixes, and holds it to two suffixes', () => {
    const d = withBase('dusk-amulet', DUSK);
    expect(codes(gear({ amulet: amulet('dusk-amulet', { rarity: 'rare', prefixes: [p('p1'), p('p2'), p('p3'), p('p4')], suffixes: [p('s1'), p('s2')] }) }), d)).toEqual([]);
    const over = validateCrafts(gear({ amulet: amulet('dusk-amulet', { rarity: 'rare', suffixes: [p('s1'), p('s2'), p('s3')] }) }), d);
    expect(over.map((w) => w.code)).toEqual(['affix-over-limit']);
    expect(over[0].message).toContain('can have 2');
  });

  it('holds a rare Penumbra Amulet to one suffix and lets it take five prefixes', () => {
    const d = withBase('penumbra-amulet', PENUMBRA);
    expect(codes(gear({ amulet: amulet('penumbra-amulet', { rarity: 'rare', prefixes: [p('p1'), p('p2'), p('p3'), p('p4'), p('p5')], suffixes: [p('s1')] }) }), d)).toEqual([]);
    expect(codes(gear({ amulet: amulet('penumbra-amulet', { rarity: 'rare', suffixes: [p('s1'), p('s2')] }) }), d)).toEqual(['affix-over-limit']);
  });

  it('shifts a magic item\'s limits too, clamped to 0-2 per side', () => {
    const d = withBase('dusk-amulet', DUSK);
    expect(codes(gear({ amulet: amulet('dusk-amulet', { rarity: 'magic', prefixes: [p('p1'), p('p2')] }) }), d)).toEqual([]);
    expect(codes(gear({ amulet: amulet('dusk-amulet', { rarity: 'magic', suffixes: [p('s1')] }) }), d)).toEqual(['affix-over-limit']);
  });

  it('lets a base that "Can roll Ring Modifiers" roll a ring mod', () => {
    const mail: GearItem = { slug: 'grasping-mail', name: 'Grasping Mail', category: 'Body Armour', isUnique: false, iconUrl: null, craft: { ...emptyCraft(false), rarity: 'rare', prefixes: [p('ringonly')] } };
    const d = data({ ringonly: mod() }, { bases: new Map([['grasping-mail', base('grasping-mail', ['Can roll Ring Modifiers'], ['default', 'armour', 'body_armour'])]]) });
    expect(codes(gear({ body: mail }), d)).toEqual([]);
  });
});
