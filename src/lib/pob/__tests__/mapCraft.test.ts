import { describe, expect, it } from 'vitest';
import { mapCraft, type CraftLookups, type CraftMod } from '../mapCraft';

// Failure modes first (AGENTS.md). mapCraft turns one PoB item's text into
// our ItemCraft. It keeps what it can match and names everything it cannot;
// it never guesses a mod, and never exceeds what the write gate accepts.

const mod = (slug: string, over: Partial<CraftMod> = {}): CraftMod => ({ slug, kind: 'prefix', rolls: [{ min: 120, max: 149 }], stats: ['+(120-149) to maximum Life'], ...over });

const LIFE = mod('increasedlife9');
const CRIT = mod('localcriticalstrikechance4', { kind: 'suffix', rolls: [{ min: 311, max: 380 }], stats: ['+(3-4)% to Critical Hit Chance'] });
const ADDED = mod('localaddedphysicaldamagetwohand7', { rolls: [{ min: 23, max: 35 }, { min: 39, max: 59 }], stats: ['Adds (23-35) to (39-59) Physical Damage'] });
const HYBRID = mod('lifeandarmour3', { rolls: [{ min: 20, max: 30 }, { min: 10, max: 15 }], stats: ['+(20-30) to maximum Life', '(10-15)% increased Armour'] });
const STR = mod('strength5', { kind: 'suffix', rolls: [{ min: 20, max: 24 }], stats: ['+(20-24) to Strength'] });

const lookups = (over: Partial<CraftLookups> = {}): CraftLookups => ({
  modById: (id) => [LIFE, CRIT, ADDED, HYBRID, STR].find((m) => m.slug === id.toLowerCase()) ?? null,
  candidates: [HYBRID, LIFE, CRIT, ADDED, STR],
  base: { implicitLines: ['+(5-7) to all Attributes'], uniqueLines: [] },
  runeSlugByName: (name) => (name === 'Greater Body Rune' ? 'greater-body-rune' : null),
  ...over,
});

const text = (...lines: string[]) => lines.join('\n');

describe('mapCraft — crafted items (PoB names the mods by id)', () => {
  const crafted = text(
    'Rarity: RARE',
    'Grim Hook',
    'Stellar Amulet',
    'Crafted: true',
    'Prefix: {range:1}IncreasedLife9',
    'Prefix: None',
    'Suffix: {range:0.951}LocalCriticalStrikeChance4',
    'Suffix: {range:0.5}NoSuchMod1',
    'Quality: 20',
    'Item Level: 82',
    'LevelReq: 60',
    'Implicits: 2',
    '{enchant}Allocates Mental Toughness',
    '{tags:attribute}{range:1}+(5-7) to all Attributes',
    '+149 to maximum Life',
    '+3.77% to Critical Hit Chance',
  );

  it('keeps each known id with its value at PoB’s range, rounded as PoB displays it', () => {
    const { craft } = mapCraft(crafted, false, lookups());
    expect(craft.prefixes).toEqual([{ slug: 'increasedlife9', values: [149] }]);
    expect(craft.suffixes).toEqual([{ slug: 'localcriticalstrikechance4', values: [377] }]);
  });

  it('names an id our data does not have, and an enchant it does not keep', () => {
    const { notes } = mapCraft(crafted, false, lookups());
    expect(notes.map((n) => n.message).join('\n')).toContain('NoSuchMod1');
    expect(notes.map((n) => n.message).join('\n')).toContain('Allocates Mental Toughness');
  });

  it('reads rarity, name, quality, item level and the implicit value', () => {
    const { craft } = mapCraft(crafted, false, lookups());
    expect(craft).toMatchObject({ rarity: 'rare', name: 'Grim Hook', quality: 20, itemLevel: 82, corrupted: false, implicitValues: [[7]] });
  });

  it('does not re-read the display lines of a crafted item as extra mods', () => {
    const { craft, notes } = mapCraft(crafted, false, lookups());
    expect(craft.prefixes).toHaveLength(1);
    expect(notes.some((n) => n.message.includes('+149 to maximum Life'))).toBe(false);
  });

  it('keeps at most six of a side, naming the rest — the write gate refuses more', () => {
    const many = text('Rarity: RARE', 'X', 'Stellar Amulet', 'Crafted: true', ...Array.from({ length: 7 }, () => 'Prefix: {range:1}IncreasedLife9'), 'Implicits: 0');
    const { craft, notes } = mapCraft(many, false, lookups());
    expect(craft.prefixes).toHaveLength(6);
    expect(notes.some((n) => n.message.includes('7 prefixes'))).toBe(true);
  });
});

describe('mapCraft — pasted items (text only)', () => {
  it('matches single-line mods and keeps their shown values when display and roll ranges agree', () => {
    const { craft, notes } = mapCraft(text('Rarity: RARE', 'X', 'Siege Crossbow', 'Implicits: 0', 'Adds 34 to 58 Physical Damage', '+22 to Strength'), false, lookups());
    expect(craft.prefixes).toEqual([{ slug: 'localaddedphysicaldamagetwohand7', values: [34, 58] }]);
    expect(craft.suffixes).toEqual([{ slug: 'strength5', values: [22] }]);
    expect(notes).toEqual([]);
  });

  it('matches a two-line hybrid mod as one affix, not two', () => {
    const { craft } = mapCraft(text('Rarity: RARE', 'X', 'Plate', 'Implicits: 0', '+25 to maximum Life', '12% increased Armour'), false, lookups());
    expect(craft.prefixes).toEqual([{ slug: 'lifeandarmour3', values: [25, 12] }]);
  });

  it('keeps a mod whose display units differ from its rolls at its best roll, and says so', () => {
    const { craft, notes } = mapCraft(text('Rarity: RARE', 'X', 'Crossbow', 'Implicits: 0', '+3.77% to Critical Hit Chance'), false, lookups());
    expect(craft.suffixes).toEqual([{ slug: 'localcriticalstrikechance4', values: [380] }]);
    expect(notes).toEqual([expect.objectContaining({ kind: 'inferred', message: expect.stringContaining('+3.77% to Critical Hit Chance') })]);
  });

  it('names a line no eligible mod matches, and keeps nothing for it', () => {
    const { craft, notes } = mapCraft(text('Rarity: RARE', 'X', 'Ring', 'Implicits: 0', '+999 to maximum Life'), false, lookups());
    expect(craft.prefixes).toEqual([]);
    expect(notes).toEqual([expect.objectContaining({ kind: 'dropped', message: expect.stringContaining('+999 to maximum Life') })]);
  });

  it('reads a corrupted flag wherever it appears', () => {
    expect(mapCraft(text('Rarity: RARE', 'X', 'Ring', 'Implicits: 0', '+22 to Strength', 'Corrupted'), false, lookups()).craft.corrupted).toBe(true);
  });
});

describe('mapCraft — uniques and runes', () => {
  const cloak = text(
    'Rarity: UNIQUE',
    'Cloak of Flame',
    'Silk Robe',
    'Quality: 20',
    'Rune: Greater Body Rune',
    'Rune: Greater Body Rune',
    'Rune: Mystery Rune',
    'Implicits: 1',
    '{enchant}{rune}+80 to maximum Life',
    '{range:0.5}+(30-50)% to Fire Resistance',
    '{range:0.25}(30-50)% reduced Ignite Duration on you',
    '40% of Physical Damage taken as Fire Damage',
  );
  const uniqueBase = { implicitLines: [], uniqueLines: ['+(30-50)% to Fire Resistance', '(30-50)% reduced Ignite Duration on you', '50% of Physical Damage taken as Fire Damage'] };

  it("reads a unique's ranged lines at their fractions, row per line of our data", () => {
    const { craft } = mapCraft(cloak, true, lookups({ base: uniqueBase }));
    expect(craft.rarity).toBe('unique');
    expect(craft.uniqueValues).toEqual([[40], [35], []]);
    expect(craft.prefixes).toEqual([]);
  });

  it("names a unique line that differs from this patch's data rather than forcing it", () => {
    const { notes } = mapCraft(cloak, true, lookups({ base: uniqueBase }));
    expect(notes.some((n) => n.message.includes('40% of Physical Damage taken as Fire Damage'))).toBe(true);
  });

  it('keeps runes it knows by name, in order, and names the one it does not', () => {
    const { craft, notes } = mapCraft(cloak, true, lookups({ base: uniqueBase }));
    expect(craft.runes).toEqual(['greater-body-rune', 'greater-body-rune']);
    expect(notes.some((n) => n.message.includes('Mystery Rune'))).toBe(true);
  });

  it("reads only the selected variant's lines, skipping the others", () => {
    const bracers = text(
      'Rarity: UNIQUE',
      'Blueflame Bracers',
      'Goldcast Cuffs',
      'Variant: Pre 0.1.1',
      'Variant: Current',
      'Selected Variant: 2',
      'Implicits: 0',
      '{variant:1}+10 to maximum Energy Shield',
      '{variant:2}+20 to maximum Energy Shield',
      '{range:0.5}+(10-20) to Intelligence',
    );
    const base = { implicitLines: [], uniqueLines: ['+20 to maximum Energy Shield', '+(10-20) to Intelligence'] };
    const { craft, notes } = mapCraft(bracers, true, lookups({ base }));
    expect(craft.uniqueValues).toEqual([[], [15]]);
    expect(notes).toEqual([]);
  });

  it('does not report the rune-granted {rune} line as a lost implicit', () => {
    const { notes } = mapCraft(cloak, true, lookups({ base: uniqueBase }));
    expect(notes.some((n) => n.message.includes('+80 to maximum Life'))).toBe(false);
  });
});
