import { describe, expect, it } from 'vitest';
import { emptyCraft, type ItemCraft } from '../../craft';
import type { GearItem } from '../../gearSlots';
import { emptyGearState, type GearState } from '../../gearState';
import type { PassiveState } from '../../types';
import { collectContributions, NO_SPIRIT_NODE, type CollectData } from '../collect';

// Failure modes first (AGENTS.md). The collector decides WHAT counts; the
// engine only adds. So every "not counted" path must name its source — a
// number silently missing a contribution is the failure this guards against.

const NODES: Record<number, { name: string; stats: [string, number][]; attribute?: boolean }> = {
  1: { name: 'Life', stats: [['base_maximum_life', 10]] },
  2: { name: 'Set II Armour', stats: [['physical_damage_reduction_rating_+%', 20]] },
  3: { name: 'Attribute', stats: [['display_passive_attribute_text', 1]], attribute: true },
  4: { name: 'Attribute', stats: [['display_passive_attribute_text', 1]], attribute: true },
  5: { name: "Giant's Blood", stats: [['keystone_giants_blood', 1]] },
  6: { name: 'Lead me through Grace...', stats: [['cannot_gain_spirit_from_equipment', 1], ['+1_spirit_per_X_evasion_rating_on_body_armour', 20]] },
  7: { name: 'Offence', stats: [['attack_speed_+%', 5]] },
  [NO_SPIRIT_NODE]: { name: 'Embrace the Darkness', stats: [['base_darkness', 100]] },
  30: { name: 'Jewel Socket', stats: [] },
  40: { name: 'Step Like Mist', stats: [['base_dexterity_and_intelligence', 5], ['mana_regeneration_rate_+%', 15]] },
  41: { name: 'Attributes', stats: [['base_all_attributes', 5]] },
  42: { name: 'Eldritch Will', stats: [['maximum_life_mana_and_energy_shield_+%', 3]] },
  43: { name: 'Harmony Within', stats: [['oracle_maximum_life_+%_final', -15], ['oracle_maximum_mana_+%_final', -15]] },
  44: { name: 'Mysterious Lineage', stats: [['titan_maximum_life_+%_final', 15]] },
  45: { name: 'Ancient Aegis', stats: [['maximum_energy_shield_from_body_armour_+%', 60]] },
  46: { name: 'Illuminated Crown', stats: [['energy_shield_from_helmet_+%', 70]] },
  47: { name: 'Future Notable', stats: [['future_patch_maximum_life_+%_final', 9], ['future_patch_attack_speed_+%', 5]] },
  48: { name: 'Future Notable 2', stats: [['future_patch_maximum_life_+%_final', 4]] },
};

const ITEMS: Record<
  string,
  {
    armour: { armour: number; evasion: number; energyShield: number } | null;
    spirit: number;
    implicits?: [string, number, number][][];
    implicitLines?: string[];
    itemClass?: string | null;
    weapon?: boolean;
  }
> = {
  'plate-vest': { armour: { armour: 100, evasion: 0, energyShield: 0 }, spirit: 0, itemClass: 'Body Armour' },
  'iron-cap': { armour: { armour: 20, evasion: 0, energyShield: 0 }, spirit: 0, itemClass: 'Helmet' },
  longbow: { armour: null, spirit: 0, itemClass: 'Bow', weapon: true },
  'amethyst-ring': { armour: null, spirit: 0, implicits: [[['base_chaos_damage_resistance_%', 7, 13]]], implicitLines: ['+(7-13)% to Chaos Resistance'] },
  sceptre: { armour: null, spirit: 100 },
  emerald: { armour: null, spirit: 0 },
  'silk-robe': { armour: { armour: 0, evasion: 0, energyShield: 50 }, spirit: 0 },
};

const UNIQUES: Record<string, { baseSlug: string; lines: { text: string; stats: string[] | null }[] }> = {
  'Cloak of Flame': {
    baseSlug: 'silk-robe',
    lines: [
      { text: '+(30-50) to maximum Energy Shield', stats: ['local_energy_shield'] },
      { text: '+(30-50)% to Fire Resistance', stats: ['base_fire_damage_resistance_%'] },
      { text: '50% of Physical Damage taken as Fire Damage', stats: null },
      { text: '+(10-20) to maximum Life and Mana', stats: null },
    ],
  },
  // Our data lists each alternative roll of some uniques as its own line
  // (Sunsplinter: six "+N% to Maximum Fire Resistance" lines, one of which a
  // real item has). Summing them gave +87% maximum resistances.
  Sunsplinter: {
    baseSlug: 'plate-vest',
    lines: [
      { text: '+1% to Maximum Fire Resistance', stats: ['base_maximum_fire_damage_resistance_%'] },
      { text: '+3% to Maximum Fire Resistance', stats: ['base_maximum_fire_damage_resistance_%'] },
      { text: '+(20-30) to maximum Life', stats: ['base_maximum_life'] },
    ],
  },
};

const MODS: Record<string, { stat: string; min: number; max: number }[]> = {
  'local-armour-inc': [{ stat: 'local_physical_damage_reduction_rating_+%', min: 40, max: 60 }],
  'local-armour-flat': [{ stat: 'local_base_physical_damage_reduction_rating', min: 20, max: 30 }],
  'global-life': [{ stat: 'base_maximum_life', min: 60, max: 70 }],
  'body-armour-pct': [{ stat: 'body_armour_+%', min: 30, max: 40 }],
};

// Runes as the wiki files them: lines per equipment category (soulCoreEffects).
const RUNES: Record<string, { name: string; effects: { category: string; lines: string[] }[] }> = {
  'greater-iron': {
    name: 'Greater Iron Rune',
    effects: [
      { category: 'Martial Weapon', lines: ['18% increased Physical Damage'] },
      { category: 'Wand or Staff', lines: ['30% increased Spell Damage'] },
      { category: 'Armour', lines: ['18% increased Armour, Evasion and Energy Shield'] },
    ],
  },
  adept: {
    name: 'Adept Rune',
    effects: [
      { category: 'All Equipment', lines: ['+9 to Dexterity'] },
      { category: 'Armour', lines: ['+13% to Fire Resistance', 'Bonded: +40 to maximum Life'] },
    ],
  },
  'cap-rune': { name: 'Cap Rune', effects: [{ category: 'Helmet', lines: ['+30 to maximum Mana'] }] },
  'archer-rune': { name: 'Archer Rune', effects: [{ category: 'Crossbow, Bow or Spear', lines: ['+10 to Spirit'] }] },
  'scaling-rune': { name: 'Scaling Rune', effects: [{ category: 'Helmet', lines: ['+# to maximum Life per # Armour on Equipped Helmet'.replace(/#/g, '5'), 'Gain 5 Life per Enemy Hit with Attacks'] }] },
  'odd-rune': { name: 'Odd Rune', effects: [{ category: 'Flying Cabbage', lines: ['+10 to maximum Life'] }] },
};

const data: CollectData = {
  node: (id) => NODES[id],
  rune: (slug) => RUNES[slug],
  item: (slug) => ITEMS[slug],
  mod: (slug) => MODS[slug],
  unique: (name) => UNIQUES[name],
};

const tree = (over: Partial<PassiveState> = {}): PassiveState => ({ set1: [], set2: [], ascendancyNodes: [], ...over });
const item = (slug: string, name: string, category: string, craft?: Partial<ItemCraft>, isUnique = false): GearItem => ({
  slug,
  name,
  category,
  isUnique,
  iconUrl: null,
  ...(craft ? { craft: { ...emptyCraft(isUnique), ...craft } } : {}),
});
const gear = (items: Partial<GearState> = {}): GearState => ({ ...emptyGearState(), ...items });
const run = (passive: PassiveState, g: GearState = gear(), level = 1, set: 1 | 2 = 1) => collectContributions({ passive, gear: g, level, set }, data);
const total = (r: ReturnType<typeof run>, pool: string, kind = 'flat') =>
  r.contributions.filter((c) => c.pool === pool && c.kind === kind).reduce((n, c) => n + c.value, 0);

describe('collectContributions — the tree', () => {
  it("counts the chosen set's nodes only, shared nodes in both", () => {
    const passive = tree({ set1: [1], set2: [1, 2] });
    expect(total(run(passive, gear(), 1, 1), 'armour', 'increased')).toBe(0);
    expect(total(run(passive, gear(), 1, 2), 'armour', 'increased')).toBe(20);
    expect(total(run(passive, gear(), 1, 2), 'life')).toBe(10);
  });

  it('gives a chosen generic attribute node +5 to its attribute, and names the unchosen ones', () => {
    const r = run(tree({ set1: [3, 4], attributeChoices: { '3': 'int' } }));
    expect(total(r, 'int')).toBe(5);
    expect(total(r, 'str') + total(r, 'dex')).toBe(0);
    expect(r.notCounted).toContain('1 "+5 to any Attribute" passive has no attribute chosen');
  });

  it("sets the Giant's Blood, cannot-gain-Spirit and no-Spirit flags from allocated nodes", () => {
    expect(run(tree({ set1: [5, 6, NO_SPIRIT_NODE] })).flags).toEqual({ giantsBlood: true, lordOfTheWilds: false, noSpirit: true, noSpiritFromEquipment: true });
    expect(run(tree({ set1: [1] })).flags).toEqual({ giantsBlood: false, lordOfTheWilds: false, noSpirit: false, noSpiritFromEquipment: false });
  });

  it('names a defence stat it does not model, by node; stays silent about offence', () => {
    const r = run(tree({ set1: [6, 7] }));
    expect(r.notCounted).toContain('Lead me through Grace...: Spirit from body armour Evasion');
    expect(r.notCounted.join(' ')).not.toContain('Offence');
  });
});

describe('collectContributions — stat ids the sheet needs (statTable.ts)', () => {
  it('splits a two-attribute and an all-attribute stat across their attributes (PoB2 ModParser.lua:168, 170)', () => {
    const r = run(tree({ set1: [40, 41] }));
    expect([total(r, 'str'), total(r, 'dex'), total(r, 'int')]).toEqual([5, 10, 10]);
  });

  it('adds one increase to Life, Mana and Energy Shield (PoB2 ModParser.lua:5339)', () => {
    const r = run(tree({ set1: [42] }));
    expect([total(r, 'life', 'increased'), total(r, 'mana', 'increased'), total(r, 'energyShield', 'increased')]).toEqual([3, 3, 3]);
  });

  it('reads "final" Life and Mana as more/less multipliers, not as increased', () => {
    const r = run(tree({ set1: [43, 44] }));
    expect(total(r, 'life', 'more')).toBe(0); // -15 + 15
    expect(r.contributions.filter((c) => c.pool === 'life' && c.kind === 'more').map((c) => c.value)).toEqual([-15, 15]);
    expect(r.contributions.filter((c) => c.pool === 'mana' && c.kind === 'more').map((c) => c.value)).toEqual([-15]);
    expect(total(r, 'life', 'increased')).toBe(0);
  });

  it("scopes 'from body armour' and 'from helmet' increases to that slot, and tags the item's own defence with its slot", () => {
    const r = run(tree({ set1: [45, 46] }), gear({ body: item('silk-robe', 'Silk Robe', 'Body Armour') }));
    expect(r.contributions).toContainEqual({ pool: 'energyShield', kind: 'increased', value: 60, source: 'Ancient Aegis', slot: 'body' });
    expect(r.contributions).toContainEqual({ pool: 'energyShield', kind: 'increased', value: 70, source: 'Illuminated Crown', slot: 'head' });
    expect(r.contributions).toContainEqual({ pool: 'energyShield', kind: 'flat', value: 50, source: 'Silk Robe', slot: 'body' });
  });
});

describe('collectContributions — unknown stat ids are named, not dropped', () => {
  it('lists an unmapped defence-looking id once, with every source that carries it', () => {
    const r = run(tree({ set1: [47, 48] }));
    expect(r.notCounted).toContain('Unrecognised stat future_patch_maximum_life_+%_final (Future Notable, Future Notable 2)');
    expect(r.notCounted.filter((n) => n.includes('future_patch_maximum_life'))).toHaveLength(1);
  });

  it('stays silent about an unmapped offence id, and about an id it maps', () => {
    const r = run(tree({ set1: [47, 7, 40] }));
    expect(r.notCounted.join(' ')).not.toContain('attack_speed');
    expect(r.notCounted.join(' ')).not.toContain('base_dexterity_and_intelligence');
    expect(r.notCounted.join(' ')).not.toContain('mana_regeneration'); // regeneration is not a sheet stat
  });
});

describe('collectContributions — gear', () => {
  it("computes an item's own Armour with its local mods and quality (PoB2 Item.lua:2586)", () => {
    const vest = item('plate-vest', 'Plate Vest', 'Body Armour', {
      rarity: 'rare',
      quality: 20,
      prefixes: [{ slug: 'local-armour-flat', values: [25] }, { slug: 'local-armour-inc', values: [50] }],
    });
    // round((100 + 25) x (1 + 50/100) x (1 + 20/100)) = round(225) = 225
    expect(total(run(tree(), gear({ body: vest })), 'armour')).toBe(225);
  });

  it('counts a plain base with no craft at its base defences', () => {
    expect(total(run(tree(), gear({ body: item('plate-vest', 'Plate Vest', 'Body Armour') })), 'armour')).toBe(100);
  });

  it('counts global affixes at their rolled value', () => {
    const ring = item('amethyst-ring', 'Amethyst Ring', 'Ring', { rarity: 'rare', prefixes: [{ slug: 'global-life', values: [66] }] });
    expect(total(run(tree(), gear({ ring1: ring })), 'life')).toBe(66);
  });

  it('counts implicits at their chosen value, or at mid-roll and says it assumed so', () => {
    const chosen = item('amethyst-ring', 'Amethyst Ring', 'Ring', { implicitValues: [[12]] });
    expect(total(run(tree(), gear({ ring1: chosen })), 'chaosRes')).toBe(12);
    const plain = item('amethyst-ring', 'Amethyst Ring', 'Ring');
    const r = run(tree(), gear({ ring1: plain }));
    expect(total(r, 'chaosRes')).toBe(10);
    expect(r.assumed).toContain('Amethyst Ring: implicit at mid-roll');
  });

  it("counts an item's base Spirit, unless the tree forbids Spirit from equipment", () => {
    const sceptre = item('sceptre', 'Rattling Sceptre', 'Sceptre');
    expect(total(run(tree(), gear({ weapon1_main: sceptre })), 'spirit')).toBe(100);
    expect(total(run(tree({ set1: [6] }), gear({ weapon1_main: sceptre })), 'spirit')).toBe(0);
  });

  it("counts only the chosen weapon set's weapons", () => {
    const sceptre = item('sceptre', 'Rattling Sceptre', 'Sceptre');
    expect(total(run(tree(), gear({ weapon2_main: sceptre }), 1, 1), 'spirit')).toBe(0);
    expect(total(run(tree(), gear({ weapon2_main: sceptre }), 1, 2), 'spirit')).toBe(100);
  });

  it('names what it cannot count: a unique, runes, an unknown mod, a stat it does not model', () => {
    const r = run(
      tree(),
      gear({
        body: item('plate-vest', 'Plate Vest', 'Body Armour', {
          rarity: 'rare',
          runes: ['adept-rune'],
          prefixes: [{ slug: 'ghost', values: [1] }, { slug: 'body-armour-pct', values: [35] }],
        }),
        head: item('crown', 'Crown of Eyes', 'Helmet', {}, true),
      }),
    );
    expect(r.notCounted).toEqual(
      expect.arrayContaining([
        'Crown of Eyes: unique — not in our data',
        'Plate Vest: 1 rune not counted',
        'Plate Vest: mod "ghost" is not in our data',
        'Plate Vest: increased Armour from body armour',
      ]),
    );
  });

  it("counts a jewel only while its socket is allocated in the chosen set", () => {
    const emerald = item('emerald', 'Emerald', 'Jewel', { rarity: 'rare', prefixes: [{ slug: 'global-life', values: [60] }] });
    const g = gear({ jewels: { '30': emerald } });
    expect(total(run(tree({ set1: [30] }), g), 'life')).toBe(60);
    expect(total(run(tree(), g), 'life')).toBe(0);
  });
});

describe('collectContributions — uniques (Slice 5, typed by wording)', () => {
  const cloak = (uniqueValues: number[][] = []) => item('cloak-of-flame', 'Cloak of Flame', 'Body Armour', { uniqueValues }, true);

  it("builds on its base's defences, with its local lines applied", () => {
    // Silk Robe 50 ES + local "+(30-50)" at the chosen 40 = 90.
    expect(total(run(tree(), gear({ body: cloak([[40], [45]]) })), 'energyShield')).toBe(90);
  });

  it('counts its global lines at the chosen value', () => {
    expect(total(run(tree(), gear({ body: cloak([[40], [45]]) })), 'fireRes')).toBe(45);
  });

  it('takes an unchosen roll at mid-roll, and says so', () => {
    const r = run(tree(), gear({ body: cloak() }));
    expect(total(r, 'fireRes')).toBe(40);
    expect(r.assumed).toContain('Cloak of Flame: unique rolls at mid-roll');
  });

  it('counts none of a unique\'s alternative rolls, and names them instead of guessing one', () => {
    const r = run(tree(), gear({ weapon1_off: item('sunsplinter', 'Sunsplinter', 'Shield', { uniqueValues: [[], [], [25]] }, true) }));
    expect(total(r, 'fireMax')).toBe(0);
    expect(total(r, 'life')).toBe(25);
    expect(r.notCounted).toContain(
      'Sunsplinter: rolls one of "+1% to Maximum Fire Resistance" / "+3% to Maximum Fire Resistance" — not counted',
    );
  });

  it('names an untyped line only when it touches a defence the sheet reports', () => {
    const r = run(tree(), gear({ body: cloak() }));
    expect(r.notCounted).toContain('Cloak of Flame: "+(10-20) to maximum Life and Mana" not counted');
    expect(r.notCounted.join(' ')).not.toContain('Physical Damage taken as Fire');
  });
});

describe('collectContributions — the campaign', () => {
  it("adds the level's fixed quest rewards, named by quest, and lists choice rewards", () => {
    const r = run(tree(), gear(), 100);
    expect(total(r, 'spirit')).toBe(100);
    expect(r.contributions.some((c) => c.source === 'Candlemass (Ogham Manor)')).toBe(true);
    expect(r.notCounted.some((n) => n.includes('Medallion (Valley of the Titans)'))).toBe(true);
  });
});

describe('collectContributions — runes (PoB2 Item.lua:2179-2198, 2378-2391)', () => {
  const vest = (runes: string[], extra: Partial<ItemCraft> = {}) => item('plate-vest', 'Plate Vest', 'Body Armour', { rarity: 'rare', runes, ...extra });

  it("adds an armour rune's increased defences to the item's LOCAL increase, additive with its mods, before quality", () => {
    const two = run(tree(), gear({ body: vest(['greater-iron', 'greater-iron']) }));
    // round(100 x (1 + 36/100)) = 136
    expect(total(two, 'armour')).toBe(136);
    const withMod = run(tree(), gear({ body: vest(['greater-iron', 'greater-iron'], { quality: 20, prefixes: [{ slug: 'local-armour-inc', values: [50] }] }) }));
    // round(100 x (1 + (50 + 36)/100) x 1.2) = round(223.2) = 223
    expect(total(withMod, 'armour')).toBe(223);
    expect(two.notCounted.join(' ')).not.toContain('rune');
  });

  it('applies the category the socketed item belongs to: a weapon gets the weapon line, which moves no defence', () => {
    const bow = item('longbow', 'Longbow', 'Bow', { rarity: 'rare', runes: ['greater-iron'] });
    const r = run(tree(), gear({ weapon1_main: bow }));
    expect(total(r, 'armour')).toBe(0);
    expect(r.notCounted).toEqual([]);
  });

  it('counts an "All Equipment" line on armour and on a weapon alike', () => {
    expect(total(run(tree(), gear({ body: vest(['adept']) })), 'dex')).toBe(9);
    expect(total(run(tree(), gear({ weapon1_main: item('longbow', 'Longbow', 'Bow', { rarity: 'rare', runes: ['adept'] }) })), 'dex')).toBe(9);
  });

  it('counts a global armour line at its value (resistance) and one rune per socket', () => {
    expect(total(run(tree(), gear({ body: vest(['adept', 'adept']) })), 'fireRes')).toBe(26);
  });

  it("never reads a Bonded line — PoB2 builds it for display only (Item.lua:2146)", () => {
    const r = run(tree(), gear({ body: vest(['adept']) }));
    expect(total(r, 'life')).toBe(0);
    expect(r.notCounted).toEqual([]);
  });

  it('keeps a helmet line to helmets, and splits a composite label like "Crossbow, Bow or Spear"', () => {
    expect(total(run(tree(), gear({ head: item('iron-cap', 'Iron Cap', 'Helmet', { rarity: 'rare', runes: ['cap-rune'] }) })), 'mana')).toBe(30);
    expect(total(run(tree(), gear({ body: vest(['cap-rune']) })), 'mana')).toBe(0);
    const bow = item('longbow', 'Longbow', 'Bow', { rarity: 'rare', runes: ['archer-rune'] });
    expect(total(run(tree(), gear({ weapon1_main: bow })), 'spirit')).toBe(10);
    expect(total(run(tree(), gear({ body: vest(['archer-rune']) })), 'spirit')).toBe(0);
  });

  it('names a defence-looking line it cannot model, stays silent about offence', () => {
    const r = run(tree(), gear({ head: item('iron-cap', 'Iron Cap', 'Helmet', { rarity: 'rare', runes: ['scaling-rune'] }) }));
    expect(r.notCounted).toEqual(['Iron Cap: rune line "+5 to maximum Life per 5 Armour on Equipped Helmet" not counted']);
  });

  it('names a rune whose category it does not recognise, and a rune absent from the data', () => {
    const r = run(tree(), gear({ body: vest(['odd-rune', 'no-such-rune']) }));
    expect(r.notCounted).toEqual(expect.arrayContaining(['Plate Vest: rune "Odd Rune" has an equipment category this builder does not recognise ("Flying Cabbage"), so it was not counted', 'Plate Vest: 1 rune not counted']));
    expect(total(r, 'life')).toBe(0);
  });
});
