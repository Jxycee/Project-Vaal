import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Item } from '@poe2-toolkit/item-extractor';
import { slugify, normalizeItem, normalizeSkill, normalizeMod, toSearchEntry, stripBracketMarkup, stripXboxButtonTokens } from './normalize';

const fixture = (name: string) =>
  JSON.parse(readFileSync(path.join(__dirname, '__fixtures__', name), 'utf8'));

/** Stand-in for the single per-run timestamp scripts/sync-wiki.ts threads through. */
const SYNCED_AT = '2026-08-21T17:16:06.876Z';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Ice Nova')).toBe('ice-nova');
  });
  it('strips apostrophes rather than encoding them', () => {
    expect(slugify("Kaom's Heart")).toBe('kaoms-heart');
  });
  it('collapses runs of separators', () => {
    expect(slugify('Orb  of --Storms')).toBe('orb-of-storms');
  });
  it('trims leading and trailing hyphens', () => {
    expect(slugify(' -Blink- ')).toBe('blink');
  });
  it('strips a curly (typographic) apostrophe, not just a straight one', () => {
    expect(slugify('Kaom\u2019s Heart')).toBe('kaoms-heart');
  });
});

describe('stripBracketMarkup', () => {
  it('keeps the display half of a [Key|Display] tag', () => {
    expect(stripBracketMarkup('Improves the [Quality|quality] of a [MartialWeapon|martial weapon]'))
      .toBe('Improves the quality of a martial weapon');
  });

  it('keeps the key itself for a bare [Key] tag with no pipe', () => {
    expect(stripBracketMarkup('Creates a [Mirrored] copy of an item')).toBe('Creates a Mirrored copy of an item');
  });

  it('leaves plain text with no markup unchanged', () => {
    expect(stripBracketMarkup('Reforges a Rare item with new modifiers')).toBe('Reforges a Rare item with new modifiers');
  });

  it('strips multiple tags in one string', () => {
    expect(stripBracketMarkup('Upgrades a [Flask|flask] to a higher [ItemRarity|Magic] rarity'))
      .toBe('Upgrades a flask to a higher Magic rarity');
  });
});

describe('stripXboxButtonTokens', () => {
  it('replaces xbox_button_x with X', () => {
    expect(stripXboxButtonTokens('<<xbox_button_x>> to use, then <<xbox_button_a>> on martial weapon to apply it.'))
      .toBe('X to use, then A on martial weapon to apply it.');
  });

  it('leaves plain text with no button tokens unchanged', () => {
    expect(stripXboxButtonTokens('Right click this item to apply it.')).toBe('Right click this item to apply it.');
  });

  it('falls back to the raw key for an unrecognized button token instead of vanishing it', () => {
    expect(stripXboxButtonTokens('Press <<xbox_button_y>> to cancel.')).toBe('Press y to cancel.');
  });
});

describe('normalizeItem', () => {
  const raw = fixture('sample-item.json');

  it('produces a slug and kind from the real fixture', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(result.kind).toBe('item');
    expect(result.slug).toBe(slugify(raw.name));
    expect(result.name).toBe(raw.name);
  });

  it('carries requirements through as a flat strength/dexterity/intelligence object', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(result.requirements).toEqual({
      strength: raw.req.str,
      dexterity: raw.req.dex,
      intelligence: raw.req.int,
    });
  });

  it('passes the icon URL through unchanged when provided', () => {
    const result = normalizeItem(raw.name, raw, '/data/wiki/2026-08-21/icons/items/kaoms-heart.png', SYNCED_AT);
    expect(result.iconUrl).toBe('/data/wiki/2026-08-21/icons/items/kaoms-heart.png');
  });

  it('sets lastSynced to a real ISO timestamp', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(new Date(result.lastSynced).toISOString()).toBe(result.lastSynced);
  });

  it("stamps the caller's timestamp verbatim instead of reading the clock", () => {
    // The whole point of threading a per-run timestamp: two records from one
    // sync must be byte-identical to the previous sync's when the upstream
    // data has not changed. Reading the clock per record made every weekly
    // sync rewrite all ~9k detail files with a timestamp-only diff.
    const a = normalizeItem(raw.name, raw, null, SYNCED_AT);
    const b = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(a.lastSynced).toBe(SYNCED_AT);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('defaults description, directions, consoleDirections, and stackSize to null when no currency row is given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(result.description).toBeNull();
    expect(result.directions).toBeNull();
    expect(result.consoleDirections).toBeNull();
    expect(result.stackSize).toBeNull();
  });

  it('carries currency text through, stripped of bracket markup, when a currency row is given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 20,
      description: 'Improves the [Quality|quality] of a [MartialWeapon|martial weapon]',
      directions: 'Right click this item then left click a martial weapon to apply it.',
      xboxDirections: null,
    });
    expect(result.description).toBe('Improves the quality of a martial weapon');
    expect(result.directions).toBe('Right click this item then left click a martial weapon to apply it.');
    expect(result.stackSize).toBe(20);
  });

  it('carries consoleDirections through, stripped of xbox button tokens, when present', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 20,
      description: null,
      directions: 'Right click this item then left click a martial weapon to apply it.',
      xboxDirections: '<<xbox_button_x>> to use, then <<xbox_button_a>> on martial weapon to apply it.',
    });
    expect(result.consoleDirections).toBe('X to use, then A on martial weapon to apply it.');
  });

  it('passes stackSize through even when it is 1 (real value for non-stackable currency) rather than nulling it', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 1,
      description: null,
      directions: 'Right click this item then left click on the imprinted original item to restore its modifiers.',
      xboxDirections: null,
    });
    expect(result.stackSize).toBe(1);
    expect(result.description).toBeNull();
  });

  it('normalizes an empty-string description/directions/xboxDirections to null, matching the real table\'s "no text" convention', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 10,
      description: '',
      directions: '',
      xboxDirections: '',
    });
    expect(result.description).toBeNull();
    expect(result.directions).toBeNull();
    expect(result.consoleDirections).toBeNull();
  });

  it('defaults implicitMods to an empty array when none is given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(result.implicitMods).toEqual([]);
  });

  it('carries implicitMods through unchanged when given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, null, [
      'Bleeding you inflict deals Damage (10-20)% faster',
    ]);
    expect(result.implicitMods).toEqual(['Bleeding you inflict deals Damage (10-20)% faster']);
  });

  it('defaults flask to null when none is given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(result.flask).toBeNull();
  });

  it('carries flask stats through unchanged when given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, null, [], {
      lifeRecovery: 0,
      manaRecovery: 285,
      duration: 3.5,
    });
    expect(result.flask).toEqual({ lifeRecovery: 0, manaRecovery: 285, duration: 3.5 });
  });

  // sample-item.json ("Bramblejack") is a unique with no base-type link, so
  // its armour/weapon/req are genuinely null/zero for that item - the real
  // fixture can't exercise the armour- or weapon-populated branches of
  // normalizeItem. The two tests below are a disclosed, narrow exception to
  // "fixtures only": a hand-constructed Item-shaped object (not captured
  // data) built solely to cover those branches.
  describe('synthetic edge case: base item with armour and weapon rows', () => {
    const armouredBase: Item = {
      rarity: 'normal',
      icon: 'Art/2DItems/Armours/BodyArmours/BaseArmour.dds',
      itemClass: 'Body Armour',
      category: null,
      twoHanded: false,
      req: { str: 30, dex: 0, int: 0 },
      armour: {
        armour: 120, evasion: 0, energyShield: 0, ward: 0, block: 0,
      },
      weapon: null,
      spirit: 0,
      dropLevel: 10,
      flavourText: null,
      modDomain: 'Item',
      tags: ['armour', 'body_armour', 'str_armour', 'default'],
    };

    const weaponBase: Item = {
      rarity: 'normal',
      icon: 'Art/2DItems/Weapons/OneHandWeapons/Swords/BaseSword.dds',
      itemClass: 'One Hand Sword',
      category: null,
      twoHanded: false,
      req: { str: 20, dex: 15, int: 0 },
      armour: null,
      weapon: {
        damageMin: 5, damageMax: 12, critical: 500, attackTime: 1200, rangeMax: 11, reloadTime: 0,
      },
      spirit: 0,
      dropLevel: 5,
      flavourText: null,
      modDomain: 'Item',
      tags: ['weapon', 'one_hand_weapon', 'sword', 'default'],
    };

    it('carries the armour row through unchanged when populated', () => {
      const result = normalizeItem('Base Body Armour', armouredBase, null, SYNCED_AT);
      expect(result.armour).toEqual(armouredBase.armour);
      expect(result.weapon).toBeNull();
    });

    it('carries the weapon row through unchanged when populated', () => {
      const result = normalizeItem('Base Sword', weaponBase, null, SYNCED_AT);
      expect(result.weapon).toEqual(weaponBase.weapon);
      expect(result.armour).toBeNull();
    });
  });
});

describe('normalizeSkill', () => {
  const raw = fixture('sample-gem.json');

  it('produces a slug and kind from the real fixture', () => {
    const result = normalizeSkill(raw.key, raw.gem, raw.requirement, raw.scaling, null, SYNCED_AT);
    expect(result.kind).toBe('skill');
    expect(result.slug).toBe(slugify(raw.gem.name));
    expect(result.gemType).toBe(raw.gem.kind);
  });

  it('defaults scaling to an empty array when the fixture has none', () => {
    const result = normalizeSkill(raw.key, raw.gem, null, null, null, SYNCED_AT);
    expect(result.scaling).toEqual([]);
  });

  it('falls back to the gem-level requirement when no per-level requirement curve exists', () => {
    const result = normalizeSkill(raw.key, raw.gem, null, null, null, SYNCED_AT);
    expect(result.requirement.level).toBe(raw.gem.req.level);
  });

  it('reads the level-1 attribute requirement from the per-level curve when present', () => {
    const result = normalizeSkill(raw.key, raw.gem, raw.requirement, raw.scaling, null, SYNCED_AT);
    const level1 = raw.requirement.levels['1'];
    expect(result.requirement).toEqual({
      strength: level1.str,
      dexterity: level1.dex,
      intelligence: level1.int,
      level: level1.requiredLevel,
    });
  });
});

describe('normalizeMod', () => {
  const raw = fixture('sample-mod.json');

  it('produces a slug from the mod id, not a display name (mods can be unnamed)', () => {
    const result = normalizeMod(raw.id, raw, SYNCED_AT);
    expect(result.kind).toBe('mod');
    expect(result.slug).toBe(slugify(raw.id));
  });

  it('carries rolls and spawnWeights through unchanged', () => {
    const result = normalizeMod(raw.id, raw, SYNCED_AT);
    expect(result.rolls).toEqual(raw.rolls);
    expect(result.spawnWeights).toEqual(raw.spawnWeights);
  });
});

describe('toSearchEntry', () => {
  it('drops detail-only fields from an item', () => {
    const raw = fixture('sample-item.json');
    const entry = toSearchEntry(normalizeItem(raw.name, raw, null, SYNCED_AT));
    expect(Object.keys(entry).sort()).toEqual(['category', 'kind', 'name', 'slug', 'tags']);
  });

  it('drops detail-only fields from a mod', () => {
    const raw = fixture('sample-mod.json');
    const entry = toSearchEntry(normalizeMod(raw.id, raw, SYNCED_AT));
    expect(Object.keys(entry).sort()).toEqual(['category', 'kind', 'name', 'slug', 'tags']);
  });

  it('uses families as the search tags for a mod', () => {
    const raw = fixture('sample-mod.json');
    const entry = toSearchEntry(normalizeMod(raw.id, raw, SYNCED_AT));
    expect(entry.tags).toEqual(raw.families);
  });
});
