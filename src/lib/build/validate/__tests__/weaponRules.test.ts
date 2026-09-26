import { describe, expect, it } from 'vitest';
import type { GearItem, GearSlot } from '../../gearSlots';
import { emptyGearState, type GearState } from '../../gearState';
import type { PassiveState } from '../../types';
import { GIANTS_BLOOD, INSTRUMENTS_OF_POWER, LORD_OF_THE_WILDS } from '../keystones';
import { offHandOccupiedBy, validateWeapons } from '../weaponRules';

// Failure modes first (AGENTS.md). One case per row of the rule table in
// plans/2026-09-24-slice3-structural-validation.md, positive and negative,
// and always per weapon set.

const it_ = (name: string, category: string, isUnique = false): GearItem => ({
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  category,
  isUnique,
  iconUrl: null,
});

const CROSSBOW = it_('Siege Crossbow', 'Crossbow');
const BOW = it_('Plain Bow', 'Bow');
const QUIVER = it_('Plain Quiver', 'Quiver');
const SHIELD = it_('Plain Shield', 'Shield');
const BUCKLER = it_('Plain Buckler', 'Buckler');
const DAGGER = it_('Plain Dagger', 'Dagger');
const SPEAR = it_('Plain Spear', 'Spear');
const WAND = it_('Plain Wand', 'Wand');
const SCEPTRE = it_('Plain Sceptre', 'Sceptre');
const UNIQUE_SCEPTRE = it_('Famous Sceptre', 'Sceptre', true);
const TALISMAN = it_('Plain Talisman', 'Talisman');
const STAFF = it_('Plain Staff', 'Staff');
const FOCII = it_('Famous Focus', 'Focii', true);
const TWO_HAND_AXE = it_('Plain Greataxe', 'Two Hand Axe');
const ONE_HAND_MACE = it_('Plain Mace', 'One Hand Mace');
const UNIQUE_MACE = it_('Famous Mace', 'Mace', true);

const EMPTY_TREE: PassiveState = { set1: [], set2: [], ascendancyNodes: [] };

function gear(items: Partial<Record<GearSlot, GearItem>>): GearState {
  return { ...emptyGearState(), ...items };
}

const codes = (g: GearState, tree: PassiveState = EMPTY_TREE) => validateWeapons(g, tree).map((w) => w.code);

describe('validateWeapons — two-handed occupancy', () => {
  it('warns about a shield beside a two-hander, on the off-hand, once', () => {
    const warnings = validateWeapons(gear({ weapon1_main: CROSSBOW, weapon1_off: SHIELD }), EMPTY_TREE);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatchObject({ code: 'two-handed-occupied', severity: 'warning', target: { kind: 'gear', slot: 'weapon1_off' } });
    expect(warnings[0].message).toContain('Siege Crossbow');
  });

  it('never lets a two-hander in set I warn about set II', () => {
    expect(codes(gear({ weapon1_main: CROSSBOW, weapon2_main: DAGGER, weapon2_off: SHIELD }))).toEqual([]);
  });

  it('counts Talisman as two-handed', () => {
    expect(codes(gear({ weapon2_main: TALISMAN, weapon2_off: SHIELD }))).toEqual(['two-handed-occupied']);
  });

  it('says nothing about an empty off-hand', () => {
    expect(codes(gear({ weapon1_main: CROSSBOW, weapon2_main: TWO_HAND_AXE }))).toEqual([]);
  });
});

describe('validateWeapons — quivers', () => {
  it('accepts a quiver with a bow', () => {
    expect(codes(gear({ weapon1_main: BOW, weapon1_off: QUIVER }))).toEqual([]);
  });

  it('refuses a quiver with a crossbow, a one-hander, or nothing', () => {
    expect(codes(gear({ weapon1_main: CROSSBOW, weapon1_off: QUIVER }))).toEqual(['quiver-needs-bow']);
    expect(codes(gear({ weapon1_main: DAGGER, weapon1_off: QUIVER }))).toEqual(['quiver-needs-bow']);
    expect(codes(gear({ weapon1_off: QUIVER }))).toEqual(['quiver-needs-bow']);
  });

  it('refuses anything but a quiver beside a bow', () => {
    expect(codes(gear({ weapon1_main: BOW, weapon1_off: SHIELD }))).toEqual(['two-handed-occupied']);
  });
});

describe('validateWeapons — one-handed main and dual wielding', () => {
  it('accepts shield, buckler, focus and sceptre off-hands', () => {
    for (const off of [SHIELD, BUCKLER, FOCII, SCEPTRE]) {
      expect(codes(gear({ weapon1_main: DAGGER, weapon1_off: off })), off.category).toEqual([]);
    }
  });

  it('accepts dual wielding one-handers, and an off-hand with an empty main hand', () => {
    expect(codes(gear({ weapon1_main: DAGGER, weapon1_off: DAGGER }))).toEqual([]);
    expect(codes(gear({ weapon1_off: DAGGER }))).toEqual([]);
  });

  it('refuses dual wielding behind a Wand or Sceptre main hand', () => {
    expect(codes(gear({ weapon1_main: WAND, weapon1_off: DAGGER }))).toEqual(['offhand-not-allowed']);
    expect(codes(gear({ weapon1_main: SCEPTRE, weapon1_off: ONE_HAND_MACE }))).toEqual(['offhand-not-allowed']);
  });

  it('still lets a Wand main hand carry a shield', () => {
    expect(codes(gear({ weapon1_main: WAND, weapon1_off: SHIELD }))).toEqual([]);
  });

  it('refuses a two-handed axe in the off-hand without Giant\'s Blood', () => {
    expect(codes(gear({ weapon1_main: DAGGER, weapon1_off: TWO_HAND_AXE }))).toEqual(['offhand-not-allowed']);
  });
});

describe("validateWeapons — keystone and ascendancy exceptions", () => {
  const withSet1 = (id: number): PassiveState => ({ set1: [id], set2: [], ascendancyNodes: [] });

  it("Giant's Blood lets a two-handed axe share a set with a shield or another two-handed axe", () => {
    const tree = withSet1(GIANTS_BLOOD);
    expect(codes(gear({ weapon1_main: TWO_HAND_AXE, weapon1_off: SHIELD }), tree)).toEqual([]);
    expect(codes(gear({ weapon1_main: TWO_HAND_AXE, weapon1_off: TWO_HAND_AXE }), tree)).toEqual([]);
  });

  it("Giant's Blood allocated only in set I does not excuse set II", () => {
    const tree = withSet1(GIANTS_BLOOD);
    expect(codes(gear({ weapon2_main: TWO_HAND_AXE, weapon2_off: SHIELD }), tree)).toEqual(['two-handed-occupied']);
  });

  it("Giant's Blood does not help a crossbow", () => {
    expect(codes(gear({ weapon1_main: CROSSBOW, weapon1_off: SHIELD }), withSet1(GIANTS_BLOOD))).toEqual(['two-handed-occupied']);
  });

  it('Lord of the Wilds lets a Talisman carry a non-unique Sceptre, and nothing else', () => {
    const tree = withSet1(LORD_OF_THE_WILDS);
    expect(codes(gear({ weapon1_main: TALISMAN, weapon1_off: SCEPTRE }), tree)).toEqual([]);
    expect(codes(gear({ weapon1_main: TALISMAN, weapon1_off: UNIQUE_SCEPTRE }), tree)).toEqual(['two-handed-occupied']);
    expect(codes(gear({ weapon1_main: TALISMAN, weapon1_off: SHIELD }), tree)).toEqual(['two-handed-occupied']);
    expect(codes(gear({ weapon1_main: TALISMAN, weapon1_off: SCEPTRE }))).toEqual(['two-handed-occupied']);
  });

  it('Instruments of Power, an ascendancy node, lets a Staff carry a focus in either set', () => {
    const tree: PassiveState = { set1: [], set2: [], ascendancyNodes: [INSTRUMENTS_OF_POWER] };
    expect(codes(gear({ weapon1_main: STAFF, weapon1_off: FOCII, weapon2_main: STAFF, weapon2_off: FOCII }), tree)).toEqual([]);
    expect(codes(gear({ weapon1_main: STAFF, weapon1_off: SHIELD }), tree)).toEqual(['two-handed-occupied']);
    expect(codes(gear({ weapon1_main: STAFF, weapon1_off: FOCII }))).toEqual(['two-handed-occupied']);
  });
});

describe('validateWeapons — unique maces whose base we know', () => {
  const HRIMNORS_HYMN: GearItem = { slug: 'hrimnors-hymn', name: "Hrimnor's Hymn", category: 'Mace', isUnique: true, iconUrl: null };
  const FROSTBREATH: GearItem = { slug: 'frostbreath', name: 'Frostbreath', category: 'Mace', isUnique: true, iconUrl: null };

  it('treats a two-handed unique mace as two-handed, with no "unknown" note', () => {
    const warnings = validateWeapons(gear({ weapon1_main: HRIMNORS_HYMN, weapon1_off: SHIELD }), EMPTY_TREE);
    expect(warnings.map((w) => [w.code, w.severity])).toEqual([['two-handed-occupied', 'warning']]);
    expect(offHandOccupiedBy(gear({ weapon1_main: HRIMNORS_HYMN }), EMPTY_TREE, 1)?.name).toBe("Hrimnor's Hymn");
  });

  it('treats a one-handed unique mace as one-handed, clean beside a shield and as an off-hand', () => {
    expect(validateWeapons(gear({ weapon1_main: FROSTBREATH, weapon1_off: SHIELD }), EMPTY_TREE)).toEqual([]);
    expect(validateWeapons(gear({ weapon1_main: DAGGER, weapon1_off: FROSTBREATH }), EMPTY_TREE)).toEqual([]);
  });

  it("lets Giant's Blood carry a two-handed unique mace in the off-hand, and warns without it", () => {
    expect(codes(gear({ weapon1_main: DAGGER, weapon1_off: HRIMNORS_HYMN }))).toEqual(['offhand-not-allowed']);
    const tree = { set1: [GIANTS_BLOOD], set2: [], ascendancyNodes: [] };
    expect(codes(gear({ weapon1_main: ONE_HAND_MACE, weapon1_off: HRIMNORS_HYMN }), tree)).toEqual([]);
  });
});

describe('validateWeapons — what it cannot know', () => {
  it('only notes a unique Mace main hand beside an off-hand, because its handedness is unknown', () => {
    const warnings = validateWeapons(gear({ weapon1_main: UNIQUE_MACE, weapon1_off: SHIELD }), EMPTY_TREE);
    expect(warnings.map((w) => [w.code, w.severity])).toEqual([['handedness-unknown', 'note']]);
  });

  it('leaves a slot holding a category that slot never takes to the slot-category check, not a pairing warning', () => {
    expect(codes(gear({ weapon1_main: DAGGER, weapon1_off: WAND }))).toEqual([]);
    expect(codes(gear({ weapon1_main: DAGGER, weapon1_off: SPEAR }))).toEqual([]);
    expect(codes(gear({ weapon1_main: SHIELD, weapon1_off: SHIELD }))).toEqual([]);
  });
});

describe('offHandOccupiedBy — the "occupied" display', () => {
  it('names the two-hander when no off-hand could be legal', () => {
    expect(offHandOccupiedBy(gear({ weapon1_main: CROSSBOW }), EMPTY_TREE, 1)?.name).toBe('Siege Crossbow');
  });

  it('is null for a bow (quiver), a one-hander, an empty main, or an exception that applies', () => {
    expect(offHandOccupiedBy(gear({ weapon1_main: BOW }), EMPTY_TREE, 1)).toBeNull();
    expect(offHandOccupiedBy(gear({ weapon1_main: DAGGER }), EMPTY_TREE, 1)).toBeNull();
    expect(offHandOccupiedBy(gear({}), EMPTY_TREE, 1)).toBeNull();
    expect(offHandOccupiedBy(gear({ weapon1_main: TWO_HAND_AXE }), { set1: [GIANTS_BLOOD], set2: [], ascendancyNodes: [] }, 1)).toBeNull();
    expect(offHandOccupiedBy(gear({ weapon1_main: UNIQUE_MACE }), EMPTY_TREE, 1)).toBeNull();
  });

  it('reads the requested set only', () => {
    expect(offHandOccupiedBy(gear({ weapon1_main: CROSSBOW }), EMPTY_TREE, 2)).toBeNull();
  });
});
