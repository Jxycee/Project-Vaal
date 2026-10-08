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
    const { craft, notes } = mapCraft(text('Rarity: RARE', 'X', 'Ring', 'Implicits: 0', 'Grants a wish'), false, lookups());
    expect(craft.prefixes).toEqual([]);
    expect(notes).toEqual([expect.objectContaining({ kind: 'dropped', message: expect.stringContaining('Grants a wish') })]);
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

describe('mapCraft — one line that fits a prefix and a suffix', () => {
  // momentsZX's Amethyst Ring (handoff Appendix A): "Rarity of Items found"
  // twice — a suffix and a prefix share the same display text. PoB's text does
  // not say which is which, and an item cannot roll one group twice, so the
  // second is the other kind.
  const RARITY_SUFFIX = mod('itemfoundrarityincrease2', { kind: 'suffix', group: 'ItemFoundRarityIncrease', rolls: [{ min: 10, max: 14 }], stats: ['(10-14)% increased Rarity of Items found'] });
  const RARITY_PREFIX = mod('itemfoundrarityincreaseprefix2', { group: 'ItemFoundRarityIncreasePrefix', rolls: [{ min: 10, max: 14 }], stats: ['(10-14)% increased Rarity of Items found'] });
  const raw = text('Rarity: RARE', 'Mind Knot', 'Amethyst Ring', 'Implicits: 0', '12% increased Rarity of Items found', '13% increased Rarity of Items found');

  it('gives the second line the kind whose group is still free', () => {
    const { craft } = mapCraft(raw, false, lookups({ candidates: [RARITY_SUFFIX, RARITY_PREFIX] }));
    expect(craft.suffixes.map((m) => m.slug)).toEqual(['itemfoundrarityincrease2']);
    expect(craft.prefixes.map((m) => m.slug)).toEqual(['itemfoundrarityincreaseprefix2']);
  });

  it('prefers a kind with room: a full set of suffixes sends the line to a prefix', () => {
    const s = (n: string) => mod(n, { kind: 'suffix', group: n, rolls: [{ min: 1, max: 1 }], stats: [`+(1-1) to ${n}`] });
    const full = text('Rarity: RARE', 'X', 'Amethyst Ring', 'Implicits: 0', '+1 to A', '+1 to B', '+1 to C', '12% increased Rarity of Items found');
    const { craft } = mapCraft(full, false, lookups({ candidates: [s('A'), s('B'), s('C'), RARITY_SUFFIX, RARITY_PREFIX] }));
    expect(craft.suffixes).toHaveLength(3);
    expect(craft.prefixes.map((m) => m.slug)).toEqual(['itemfoundrarityincreaseprefix2']);
  });

  it('with nothing to disambiguate, keeps the first match as before', () => {
    const one = text('Rarity: RARE', 'X', 'Amethyst Ring', 'Implicits: 0', '12% increased Rarity of Items found');
    const { craft } = mapCraft(one, false, lookups({ candidates: [RARITY_SUFFIX, RARITY_PREFIX] }));
    expect(craft.suffixes.map((m) => m.slug)).toEqual(['itemfoundrarityincrease2']);
  });
});

describe('mapCraft — one printed line that is two mods added together', () => {
  // momentsZX's helmet (handoff Appendix A, checked 2026-10-05 against PoB's own
  // "Evasion: 728" header: it reproduces only at 126% local increase): the game
  // sums one stat across mods, so a pure "(80-100)% Evasion and ES" and a hybrid
  // "(33-38)% Evasion and ES + (27-32) Mana" print ONE 126% line, with the
  // hybrid's mana on its own line elsewhere. No single tier reaches 126.
  const PURE = mod('pureees', { group: 'LocalEES', rolls: [{ min: 80, max: 100 }], stats: ['(80-100)% increased Evasion and Energy Shield'] });
  const HYB = mod('hybees', { group: 'LocalEESMana', rolls: [{ min: 33, max: 38 }, { min: 27, max: 32 }], stats: ['(33-38)% increased Evasion and Energy Shield', '+(27-32) to maximum Mana'] });
  const MANA = mod('plainmana', { group: 'IncreasedMana', rolls: [{ min: 25, max: 34 }], stats: ['+(25-34) to maximum Mana'] });
  const FLAT = mod('flatbase', { group: 'LocalBase', rolls: [{ min: 70, max: 80 }], stats: ['+(70-80) to Evasion Rating'] });
  const helmet = (...lines: string[]) => text('Rarity: RARE', 'X', 'Grinning Mask', 'Implicits: 0', ...lines);
  const L = (candidates: CraftMod[]) => lookups({ candidates });

  it('reads 126% + 28 Mana as the hybrid (with that Mana) plus the pure mod, not a lone Mana mod', () => {
    const { craft, notes } = mapCraft(helmet('126% increased Evasion and Energy Shield', '+77 to Evasion Rating', '+28 to maximum Mana'), false, L([MANA, HYB, PURE, FLAT]));
    const hyb = craft.prefixes.find((m) => m.slug === 'hybees')!;
    const pure = craft.prefixes.find((m) => m.slug === 'pureees')!;
    expect(hyb.values[1]).toBe(28);
    expect(hyb.values[0] + pure.values[0]).toBe(126);
    expect(hyb.values[0]).toBeGreaterThanOrEqual(33);
    expect(hyb.values[0]).toBeLessThanOrEqual(38);
    expect(craft.prefixes.map((m) => m.slug)).not.toContain('plainmana');
    expect(craft.prefixes.map((m) => m.slug)).toContain('flatbase');
    expect(notes.filter((n) => n.kind === 'inferred' && n.message.includes('126%'))).toHaveLength(1);
  });

  it('does not split a line one tier can print — 90% is the pure mod alone, and the Mana stays its own mod', () => {
    const { craft } = mapCraft(helmet('90% increased Evasion and Energy Shield', '+28 to maximum Mana'), false, L([MANA, HYB, PURE]));
    expect(craft.prefixes.map((m) => m.slug)).toEqual(['pureees', 'plainmana']);
  });

  it('refuses a split whose two mods share a group (an item rolls one mod per group)', () => {
    const SAME = mod('pureees2', { group: 'LocalEESMana', rolls: [{ min: 80, max: 100 }], stats: ['(80-100)% increased Evasion and Energy Shield'] });
    const { craft } = mapCraft(helmet('126% increased Evasion and Energy Shield', '+28 to maximum Mana'), false, L([MANA, HYB, SAME]));
    expect(craft.prefixes.map((m) => m.slug)).not.toContain('hybees');
  });

  it('refuses a split when no pure tier can cover what the hybrid leaves (150 > 38 + 100)', () => {
    const { craft, notes } = mapCraft(helmet('150% increased Evasion and Energy Shield', '+28 to maximum Mana'), false, L([MANA, HYB, PURE]));
    expect(craft.prefixes.map((m) => m.slug)).not.toContain('hybees');
    expect(notes.some((n) => n.message.includes('150%'))).toBe(true);
  });
});

describe('mapCraft — a value above every roll this base has', () => {
  // momentsZX's amulet: "53% increased maximum Energy Shield" (top tier 45-50) and
  // "36% increased Global Armour, Evasion and Energy Shield" (essence 20-30). Both
  // sit ~1.2x the top of their tier, with in-range resistances beside them — a
  // quality-style scaling on defence mods that we do not model. The shown number is
  // the real one (the in-game sheet only reproduces with it), so a line stats/lineMods.ts
  // can read is kept as written in craft.verbatim, not clamped to the tier; a line it
  // cannot read is kept at the closest legal roll. Either way it is said, never silent.
  const ES = (n: number, a: number, b: number) => mod(`es${n}`, { group: 'GlobalES', rolls: [{ min: a, max: b }], stats: [`(${a}-${b})% increased maximum Energy Shield`] });
  const amulet = (...lines: string[]) => text('Rarity: RARE', 'X', 'Gold Amulet', 'Implicits: 0', ...lines);

  it('keeps a readable line as written instead of clamping it to the top tier', () => {
    const { craft, notes } = mapCraft(amulet('53% increased maximum Energy Shield'), false, lookups({ candidates: [ES(6, 39, 44), ES(7, 45, 50)] }));
    expect(craft.prefixes).toEqual([]);
    expect(craft.verbatim).toEqual(['53% increased maximum Energy Shield']);
    const note = notes.find((n) => n.message.includes('53%'));
    expect(note?.kind).toBe('inferred');
    expect(note?.message).toContain('as written');
  });

  it('still clamps an above-tier line it has no reading for', () => {
    const near = mod('near', { group: 'G2', rolls: [{ min: 20, max: 30 }], stats: ['(20-30)% increased Fancy Thing'] });
    const { craft } = mapCraft(amulet('36% increased Fancy Thing'), false, lookups({ candidates: [near] }));
    expect(craft.prefixes).toEqual([{ slug: 'near', values: [30] }]);
    expect(craft.verbatim).toBeUndefined();
  });

  it('picks the tier whose range is nearest, not the first', () => {
    const near = mod('near', { group: 'G2', rolls: [{ min: 20, max: 30 }], stats: ['(20-30)% increased Global Defences'] });
    const far = mod('far', { group: 'G1', rolls: [{ min: 15, max: 25 }], stats: ['(15-25)% increased Global Defences'] });
    const { craft } = mapCraft(amulet('36% increased Global Defences'), false, lookups({ candidates: [far, near] }));
    expect(craft.prefixes).toEqual([{ slug: 'near', values: [30] }]);
  });

  it('never turns a value BELOW every roll into a tier mod; a readable line is kept as written', () => {
    const { craft, notes } = mapCraft(amulet('5% increased maximum Energy Shield'), false, lookups({ candidates: [ES(7, 45, 50)] }));
    expect(craft.prefixes).toEqual([]);
    expect(craft.verbatim).toEqual(['5% increased maximum Energy Shield']);
    expect(notes.some((n) => n.kind === 'inferred' && n.message.includes('5%'))).toBe(true);
  });

  it('drops a value below every roll when the line is not one it can read', () => {
    const near = mod('near', { group: 'G2', rolls: [{ min: 20, max: 30 }], stats: ['(20-30)% increased Fancy Thing'] });
    const { craft, notes } = mapCraft(amulet('5% increased Fancy Thing'), false, lookups({ candidates: [near] }));
    expect(craft.prefixes).toEqual([]);
    expect(craft.verbatim).toBeUndefined();
    expect(notes.some((n) => n.kind === 'dropped' && n.message.includes('5%'))).toBe(true);
  });
});

describe('mapCraft — quality above what we store', () => {
  it('keeps quality 22 (real items exceed 20) without a note', () => {
    const { craft, notes } = mapCraft(text('Rarity: RARE', 'X', 'Grinning Mask', 'Quality: 22', 'Implicits: 0'), false, lookups());
    expect(craft.quality).toBe(22);
    expect(notes.some((n) => n.message.toLowerCase().includes('quality'))).toBe(false);
  });
  it('clamps quality 31 to the 30 cap and says so', () => {
    const { craft, notes } = mapCraft(text('Rarity: RARE', 'X', 'Grinning Mask', 'Quality: 31', 'Implicits: 0'), false, lookups());
    expect(craft.quality).toBe(30);
    expect(notes.some((n) => n.message.includes('31') && n.message.toLowerCase().includes('quality'))).toBe(true);
  });
  it('says nothing about quality 20', () => {
    const { notes } = mapCraft(text('Rarity: RARE', 'X', 'Grinning Mask', 'Quality: 20', 'Implicits: 0'), false, lookups());
    expect(notes.some((n) => n.message.toLowerCase().includes('quality'))).toBe(false);
  });
});
