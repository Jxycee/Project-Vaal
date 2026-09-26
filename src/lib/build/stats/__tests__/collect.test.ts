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
};

const ITEMS: Record<string, { armour: { armour: number; evasion: number; energyShield: number } | null; spirit: number; implicits?: [string, number, number][][] }> = {
  'plate-vest': { armour: { armour: 100, evasion: 0, energyShield: 0 }, spirit: 0 },
  'amethyst-ring': { armour: null, spirit: 0, implicits: [[['base_chaos_damage_resistance_%', 7, 13]]] },
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
};

const MODS: Record<string, { stat: string; min: number; max: number }[]> = {
  'local-armour-inc': [{ stat: 'local_physical_damage_reduction_rating_+%', min: 40, max: 60 }],
  'local-armour-flat': [{ stat: 'local_base_physical_damage_reduction_rating', min: 20, max: 30 }],
  'global-life': [{ stat: 'base_maximum_life', min: 60, max: 70 }],
  'body-armour-pct': [{ stat: 'body_armour_+%', min: 30, max: 40 }],
};

const data: CollectData = {
  node: (id) => NODES[id],
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
