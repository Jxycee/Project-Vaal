import { describe, it, expect } from 'vitest';
import {
  GEAR_SLOTS,
  categoriesForSlot,
  isGearSlot,
  JEWEL_PSEUDO_SLOT,
  JEWEL_CATEGORIES,
} from '../gearSlots';
import type { GearSlot } from '../gearSlots';

describe('categoriesForSlot', () => {
  it('covers all 17 slots with a non-empty category list', () => {
    expect(GEAR_SLOTS).toHaveLength(17);
    for (const slot of GEAR_SLOTS) {
      const categories = categoriesForSlot(slot);
      expect(categories.length).toBeGreaterThan(0);
    }
  });

  it('maps the single-category armour/jewellery slots exactly', () => {
    expect(categoriesForSlot('head')).toEqual(['Helmet']);
    expect(categoriesForSlot('body')).toEqual(['Body Armour']);
    expect(categoriesForSlot('gloves')).toEqual(['Gloves']);
    expect(categoriesForSlot('boots')).toEqual(['Boots']);
    expect(categoriesForSlot('amulet')).toEqual(['Amulet']);
    expect(categoriesForSlot('ring1')).toEqual(['Ring']);
    expect(categoriesForSlot('ring2')).toEqual(['Ring']);
    expect(categoriesForSlot('belt')).toEqual(['Belt']);
  });

  // Regression cover for the 2026-09-20 defect: the original spec's
  // Appendix B omitted both categories below. Talisman missing left Druid
  // with no selectable weapon at all; Focii missing hid every unique focus
  // in the game (Focus alone is 51 bases, 0 uniques).
  it('includes Talisman in both weapon main-hand slots', () => {
    expect(categoriesForSlot('weapon1_main')).toContain('Talisman');
    expect(categoriesForSlot('weapon2_main')).toContain('Talisman');
  });

  it('includes Focii (not just Focus) in both weapon off-hand slots', () => {
    expect(categoriesForSlot('weapon1_off')).toContain('Focii');
    expect(categoriesForSlot('weapon1_off')).toContain('Focus');
    expect(categoriesForSlot('weapon2_off')).toContain('Focii');
    expect(categoriesForSlot('weapon2_off')).toContain('Focus');
  });

  it('weapon main slots carry every other original weapon category too', () => {
    const expected = [
      'One Hand Sword', 'Two Hand Sword', 'One Hand Axe', 'Two Hand Axe',
      'One Hand Mace', 'Two Hand Mace', 'Mace', 'Bow', 'Crossbow', 'Claw',
      'Dagger', 'Flail', 'Spear', 'Sceptre', 'Wand', 'Staff', 'Warstaff',
    ];
    for (const category of expected) {
      expect(categoriesForSlot('weapon1_main')).toContain(category);
      expect(categoriesForSlot('weapon2_main')).toContain(category);
    }
  });

  it('weapon off slots also carry Shield, Buckler and Quiver', () => {
    for (const category of ['Shield', 'Buckler', 'Quiver']) {
      expect(categoriesForSlot('weapon1_off')).toContain(category);
      expect(categoriesForSlot('weapon2_off')).toContain(category);
    }
  });

  // Flask slots: base and unique items live under different spellings of
  // the same category. Missing either spelling silently drops half the pool.
  it('flask1 (life) includes both LifeFlask spellings', () => {
    expect(categoriesForSlot('flask1')).toEqual(expect.arrayContaining(['LifeFlask', 'Life Flask']));
  });

  it('flask2 (mana) includes both ManaFlask spellings', () => {
    expect(categoriesForSlot('flask2')).toEqual(expect.arrayContaining(['ManaFlask', 'Mana Flask']));
  });

  // UtilityFlask holds charms, not flasks — charm slots need both categories
  // or they offer only the 12 unique charms and miss every base one.
  it('charm slots include both Charm and UtilityFlask', () => {
    for (const slot of ['charm1', 'charm2', 'charm3'] as GearSlot[]) {
      expect(categoriesForSlot(slot)).toEqual(expect.arrayContaining(['Charm', 'UtilityFlask']));
    }
  });
});

describe('isGearSlot', () => {
  it('accepts every one of the 17 slot keys', () => {
    for (const slot of GEAR_SLOTS) {
      expect(isGearSlot(slot)).toBe(true);
    }
  });

  it('rejects the jewel pseudo-slot and arbitrary strings', () => {
    expect(isGearSlot(JEWEL_PSEUDO_SLOT)).toBe(false);
    expect(isGearSlot('helmet')).toBe(false);
    expect(isGearSlot('')).toBe(false);
    expect(isGearSlot('Currency')).toBe(false);
  });
});

describe('jewel pseudo-slot', () => {
  it('is kept out of the 17-slot gear array', () => {
    expect((GEAR_SLOTS as readonly string[]).includes(JEWEL_PSEUDO_SLOT)).toBe(false);
  });

  it('maps to the Jewel category', () => {
    expect(JEWEL_CATEGORIES).toEqual(['Jewel']);
  });
});
