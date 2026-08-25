import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Item } from '@poe2-toolkit/item-extractor';
import { slugify, normalizeItem, normalizeSkill, normalizeMod, normalizeEffect, toSearchEntry, stripBracketMarkup, stripXboxButtonTokens, extractConsoleButtons, stripPobSourceMarkup, parsePobUniqueBlock, parsePobUniqueFile, enrichKeywordLines } from './normalize';

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

describe('enrichKeywordLines', () => {
  it('appends the matching definition, bracket markup stripped, to a bare mod line', () => {
    const definitions = new Map([
      ['Legacy of Gold', "Legacy of Gold is a [MagesLegacy|Mage's Legacy] which grants 45% increased [ItemRarity|Rarity of Items] found."],
    ]);
    expect(enrichKeywordLines(['Legacy of Gold'], definitions)).toEqual([
      "Legacy of Gold — Legacy of Gold is a Mage's Legacy which grants 45% increased Rarity of Items found.",
    ]);
  });

  it('leaves a line with no matching term unchanged', () => {
    const definitions = new Map([['Legacy of Gold', 'Some definition.']]);
    expect(enrichKeywordLines(['+(40-60) to Strength'], definitions)).toEqual(['+(40-60) to Strength']);
  });

  it('requires a whole-line match, not a substring - a numeric line naming the same term stays untouched', () => {
    const definitions = new Map([['Strength', 'Strength is an Attribute...']]);
    expect(enrichKeywordLines(['+(40-60) to Strength'], definitions)).toEqual(['+(40-60) to Strength']);
  });

  it('passes every line through unchanged when given no definitions', () => {
    expect(enrichKeywordLines(['Legacy of Gold', 'Legacy of Ruby'], new Map())).toEqual(['Legacy of Gold', 'Legacy of Ruby']);
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

  it('defaults soulCoreEffects to null when the caller passes none', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT);
    expect(result.soulCoreEffects).toBeNull();
  });

  it('carries soulCoreEffects through unchanged when the caller passes some (a Rune item)', () => {
    const effects = [{ category: 'Armour', lines: ['+45% to Fire Resistance'] }];
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, null, [], null, null, new Map(), effects);
    expect(result.soulCoreEffects).toEqual(effects);
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

  it('also strips bracket markup from consoleDirections, same as directions', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 10,
      description: null,
      directions: 'A stack of 10 shards becomes an Orb of Alchemy',
      xboxDirections: 'A stack of 10 shards becomes an [OrbOfAlchemy|Orb of Alchemy]',
    });
    expect(result.consoleDirections).toBe('A stack of 10 shards becomes an Orb of Alchemy');
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

  it('populates consoleButtons when click phrases line up 1:1 with xbox button tokens', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 20,
      description: null,
      directions: 'Right click this item then left click a martial weapon to apply it.',
      xboxDirections: '<<xbox_button_x>> to use, then <<xbox_button_a>> on martial weapon to apply it.',
    });
    expect(result.consoleButtons).toEqual(['x', 'a']);
  });

  it('leaves consoleButtons null when there is no xbox row at all', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, {
      stackSize: 20,
      description: null,
      directions: 'Right click this item then left click a martial weapon to apply it.',
      xboxDirections: null,
    });
    expect(result.consoleButtons).toBeNull();
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

  it('defaults uniqueMods to null and leaves implicitMods as given when no PoB entry is passed', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, null, ['a GGPK implicit']);
    expect(result.uniqueMods).toBeNull();
    expect(result.implicitMods).toEqual(['a GGPK implicit']);
  });

  it('populates uniqueMods and overrides implicitMods from a PoB entry when given', () => {
    const result = normalizeItem(raw.name, raw, null, SYNCED_AT, null, ['a GGPK implicit'], null, {
      name: raw.name,
      baseType: 'Jade Amulet',
      requiresLevel: 55,
      dropSource: 'Drops from Xesht, We That Are One in Twisted Domain',
      implicitMods: ['+(10-15) to Dexterity'],
      explicitMods: ['+(50-100)% to Lightning Resistance'],
    });
    expect(result.implicitMods).toEqual(['+(10-15) to Dexterity']);
    expect(result.uniqueMods).toEqual({
      baseType: 'Jade Amulet',
      requiresLevel: 55,
      dropSource: 'Drops from Xesht, We That Are One in Twisted Domain',
      explicitMods: ['+(50-100)% to Lightning Resistance'],
    });
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

describe('extractConsoleButtons', () => {
  it('returns null when either string is missing', () => {
    expect(extractConsoleButtons(null, '<<xbox_button_x>> to use.')).toBeNull();
    expect(extractConsoleButtons('Right click this item.', null)).toBeNull();
  });

  it('returns null when directions has no click phrasing to substitute', () => {
    expect(extractConsoleButtons('Consumes itself on use.', '<<xbox_button_x>> to use.')).toBeNull();
  });

  it('returns null when the click-phrase count and button-token count disagree', () => {
    // Real case: a Beast recipe's console text describes interacting with menagerie
    // signs instead of prompting any button at all.
    expect(
      extractConsoleButtons(
        'Right click on this item then left click on a Beast in your Menagerie to itemise the Beast.',
        "You can use these to itemise beasts by interacting with the signs outside the beasts' cages in the menagerie.",
      ),
    ).toBeNull();
  });

  it('returns the ordered button letters when counts match', () => {
    expect(
      extractConsoleButtons(
        'Right click this item then left click a martial weapon to apply it.',
        '<<xbox_button_x>> to use, then <<xbox_button_a>> on martial weapon to apply it.',
      ),
    ).toEqual(['x', 'a']);
  });
});

describe('stripPobSourceMarkup', () => {
  it('strips unique{} and normal{} cross-reference markup to plain text', () => {
    expect(stripPobSourceMarkup('Drops from unique{Xesht, We That Are One} in normal{Twisted Domain}'))
      .toBe('Drops from Xesht, We That Are One in Twisted Domain');
  });

  it('passes plain text through unchanged when there is no markup', () => {
    expect(stripPobSourceMarkup('Drops from Act 1 bosses')).toBe('Drops from Act 1 bosses');
  });
});

describe('parsePobUniqueBlock', () => {
  it('splits implicit and explicit mods using the Implicits: count', () => {
    const entry = parsePobUniqueBlock(`
The Anvil
Bloodstone Amulet
Implicits: 1
+(30-40) to maximum Life
10% reduced Movement Speed
(25-50)% increased Armour
`);
    expect(entry?.name).toBe('The Anvil');
    expect(entry?.baseType).toBe('Bloodstone Amulet');
    expect(entry?.implicitMods).toEqual(['+(30-40) to maximum Life']);
    expect(entry?.explicitMods).toEqual(['10% reduced Movement Speed', '(25-50)% increased Armour']);
  });

  it('captures Requires Level and a markup-stripped Source line', () => {
    const entry = parsePobUniqueBlock(`
Choir of the Storm
Jade Amulet
Source: Drops from unique{Xesht, We That Are One} in normal{Twisted Domain}
Requires Level 55
Implicits: 1
+(10-15) to Dexterity
+(50-100)% to Lightning Resistance
`);
    expect(entry?.requiresLevel).toBe(55);
    expect(entry?.dropSource).toBe('Drops from Xesht, We That Are One in Twisted Domain');
  });

  it('keeps only the "Current" variant\'s tagged lines, plus untagged lines unconditionally', () => {
    const entry = parsePobUniqueBlock(`
The Brass Dome
Champion Cuirass
Variant: Pre 0.1.1
Variant: Current
{variant:1}(300-400)% increased Armour
{variant:2}(500-600)% increased Armour
+(200-300) to Stun Threshold
`);
    expect(entry?.explicitMods).toEqual([
      '(500-600)% increased Armour',
      '+(200-300) to Stun Threshold',
    ]);
  });

  it('keeps every variant\'s lines when variants exist but none is labeled "Current" (alternate-form items)', () => {
    const entry = parsePobUniqueBlock(`
Atziri's Splendour
Sacrificial Regalia
Variant: Helmet
Variant: Gloves
{variant:1}gains bonuses as though it was also a Helmet
{variant:2}gains bonuses as though it was also Gloves
`);
    expect(entry?.explicitMods).toEqual([
      'gains bonuses as though it was also a Helmet',
      'gains bonuses as though it was also Gloves',
    ]);
  });

  it('honors a multi-index {variant:N,M} tag', () => {
    const entry = parsePobUniqueBlock(`
Blackbraid
Fur Plate
Variant: Pre 0.1.1
Variant: Pre 0.3.0
Variant: Current
{variant:2,3}+(40-60) to Armour
{variant:1,2}+100% of Armour also applies to Elemental Damage
`);
    expect(entry?.explicitMods).toEqual(['+(40-60) to Armour']);
  });

  it('returns null for an empty block', () => {
    expect(parsePobUniqueBlock('   \n  \n')).toBeNull();
  });

  it('treats a metadata line immediately after the name as absent base type, not swallowed', () => {
    const entry = parsePobUniqueBlock(`
Some Relic
Requires Level 10
No true Base Line
`);
    expect(entry?.baseType).toBeNull();
    expect(entry?.requiresLevel).toBe(10);
  });

  it('strips the "alt variant" bookkeeping lines a second, independent variant axis uses (Mageblood shape) - never real mod text', () => {
    const entry = parsePobUniqueBlock(`
Mageblood
Utility Belt
Has Alt Variant: true
Has Alt Variant Two: true
Has Alt Variant Three: true
Selected Variant: 1
Selected Alt Variant: 2
Selected Alt Variant Two: 3
Selected Alt Variant Three: 4
Allow Duplicate Variants: true
Variant: Legacy of Gold
Variant: Legacy of Ruby
Implicits: 1
Has (1-3) Charm Slot
{variant:1}Legacy of Gold
{variant:2}Legacy of Ruby
`);
    expect(entry?.implicitMods).toEqual(['Has (1-3) Charm Slot']);
    expect(entry?.explicitMods).toEqual(['Legacy of Gold', 'Legacy of Ruby']);
  });
});

describe('parsePobUniqueFile', () => {
  it('parses every [[ ]] block and ignores comment lines between them', () => {
    const entries = parsePobUniqueFile(`
-- Amulet
[[
The Anvil
Bloodstone Amulet
Implicits: 1
+(30-40) to maximum Life
]],[[
Astramentis
Stellar Amulet
Implicits: 1
+(5-7) to all Attributes
]],
`);
    expect(entries.map((e) => e.name)).toEqual(['The Anvil', 'Astramentis']);
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

  it('passes a named domain through unchanged', () => {
    const result = normalizeMod(raw.id, raw, SYNCED_AT);
    expect(result.domain).toBe('Item');
  });

  it('relabels the unnamed ModDomains enum slots "6" and "8" to their real, verified meaning', () => {
    expect(normalizeMod('x', { ...raw, domain: '6' }, SYNCED_AT).domain).toBe('Map');
    expect(normalizeMod('x', { ...raw, domain: '8' }, SYNCED_AT).domain).toBe('Sanctum');
  });

  it('enriches a bare stats line via keywordDefinitions, same as a unique item mod line', () => {
    const definitions = new Map([["Legacy of Gold", "Legacy of Gold is a Mage's Legacy which grants 45% increased Rarity of Items found."]]);
    const result = normalizeMod('x', { ...raw, stats: ['Legacy of Gold'] }, SYNCED_AT, definitions);
    expect(result.stats).toEqual(["Legacy of Gold — Legacy of Gold is a Mage's Legacy which grants 45% increased Rarity of Items found."]);
  });

  it('leaves stats unchanged when no keywordDefinitions are given', () => {
    const result = normalizeMod('x', { ...raw, stats: ['+10 to Life'] }, SYNCED_AT);
    expect(result.stats).toEqual(['+10 to Life']);
  });
});

describe('normalizeEffect', () => {
  it('slugs from name, strips bracket markup from the description, and always categorizes as "Effect"', () => {
    const result = normalizeEffect(
      { id: 'maim', name: 'Maimed', description: 'Reduced [Evasion] and movement speed [Slow|Slowed].' },
      SYNCED_AT,
    );
    expect(result.kind).toBe('effect');
    expect(result.slug).toBe('maimed');
    expect(result.name).toBe('Maimed');
    expect(result.category).toBe('Effect');
    expect(result.description).toBe('Reduced Evasion and movement speed Slowed.');
    expect(result.lastSynced).toBe(SYNCED_AT);
  });
});

describe('toSearchEntry', () => {
  it('drops detail-only fields from an item', () => {
    const raw = fixture('sample-item.json');
    const entry = toSearchEntry(normalizeItem(raw.name, raw, null, SYNCED_AT));
    expect(Object.keys(entry).sort()).toEqual(['category', 'kind', 'name', 'slug', 'tags']);
  });

  it('drops the near-universal, zero-signal "default" tag from an item\'s search tags, keeps the rest', () => {
    const raw = fixture('sample-item.json');
    const detail = normalizeItem(raw.name, { ...raw, tags: ['default', 'armour', 'str_armour'] }, null, SYNCED_AT);
    expect(toSearchEntry(detail).tags).toEqual(['armour', 'str_armour']);
  });

  it('drops a tag that reads identically to the entry\'s own category ("body_armour" on a Body Armour item)', () => {
    const raw = fixture('sample-item.json'); // category: "Body Armour"
    const detail = normalizeItem(raw.name, { ...raw, tags: ['armour', 'body_armour'] }, null, SYNCED_AT);
    expect(toSearchEntry(detail).tags).toEqual(['armour']);
  });

  it('drops the bare "onehand"/"twohand" tag when the fuller "one_hand_weapon"/"two_hand_weapon" tag is also present, keeps a lone one', () => {
    const raw = fixture('sample-item.json');
    const both = normalizeItem(raw.name, { ...raw, tags: ['one_hand_weapon', 'onehand', 'weapon'] }, null, SYNCED_AT);
    expect(toSearchEntry(both).tags).toEqual(['one_hand_weapon', 'weapon']);
    const loneTwohand = normalizeItem(raw.name, { ...raw, tags: ['twohand', 'weapon'] }, null, SYNCED_AT);
    expect(toSearchEntry(loneTwohand).tags).toEqual(['twohand', 'weapon']);
  });

  it('strips all tags from a currency item except incursion_currency', () => {
    const raw = fixture('sample-item.json');
    const detail = normalizeItem(raw.name, { ...raw, itemClass: 'StackableCurrency', category: 'StackableCurrency', tags: ['default', 'quality_currency', 'catalyst'] }, null, SYNCED_AT);
    expect(toSearchEntry(detail).tags).toEqual([]);
    const withIncursion = normalizeItem(raw.name, { ...raw, itemClass: 'StackableCurrency', category: 'StackableCurrency', tags: ['quality_currency', 'incursion_currency'] }, null, SYNCED_AT);
    expect(toSearchEntry(withIncursion).tags).toEqual(['incursion_currency']);
  });

  it('promotes an essence-tagged currency item to its own "Essence" category', () => {
    const raw = fixture('sample-item.json');
    const detail = normalizeItem('Essence of Abrasion', { ...raw, itemClass: 'StackableCurrency', category: 'StackableCurrency', tags: ['default', 'essence'] }, null, SYNCED_AT);
    const entry = toSearchEntry(detail);
    expect(entry.category).toBe('Essence');
    expect(entry.tags).toEqual([]);
    // the detail record itself keeps its real raw category - only the search-index entry changes
    expect(detail.category).toBe('StackableCurrency');
  });

  it('leaves a non-currency item\'s tags untouched by the currency-stripping rule', () => {
    const raw = fixture('sample-item.json'); // category: "Body Armour"
    const detail = normalizeItem(raw.name, { ...raw, tags: ['catalyst', 'quality_currency'] }, null, SYNCED_AT);
    expect(toSearchEntry(detail).tags).toEqual(['catalyst', 'quality_currency']);
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

  it('reassigns a "[DNT-UNUSED]"-named item to the Unused / Removed category, keeping its real category on the detail record', () => {
    const raw = fixture('sample-item.json');
    const detail = normalizeItem('[DNT-UNUSED] Axe Chop', { ...raw }, null, SYNCED_AT);
    expect(detail.category).not.toBe('Unused / Removed'); // detail record itself is untouched
    expect(toSearchEntry(detail).category).toBe('Unused / Removed');
  });

  it('reassigns an exact "Removed Skill" name the same way', () => {
    const raw = fixture('sample-item.json');
    const detail = normalizeItem('Removed Skill', { ...raw }, null, SYNCED_AT);
    expect(toSearchEntry(detail).category).toBe('Unused / Removed');
  });

  it('reassigns a "[UNUSED]"-named item too (no "DNT" needed - real data has both prefix shapes)', () => {
    const raw = fixture('sample-item.json');
    const detail = normalizeItem('[UNUSED] Heist Test Weapon', { ...raw }, null, SYNCED_AT);
    expect(toSearchEntry(detail).category).toBe('Unused / Removed');
  });

  it('reassigns an explicitly-listed internal-state effect name (Grace Period, the Test-suffixed QA effects)', () => {
    for (const name of ['Grace Period', 'Cutscene in Progress', 'Block Test', 'Spiral Test Cheat']) {
      const detail = normalizeEffect({ id: 'x', name, description: 'x' }, SYNCED_AT);
      expect(toSearchEntry(detail).category).toBe('Unused / Removed');
    }
  });

  it('does not reassign a "Test"-named item - real content ("Test of Strength Barya", a Trial of the Sekhemas room) would false-positive if this were a cross-kind pattern', () => {
    const raw = fixture('sample-item.json');
    const detail = normalizeItem('Test of Strength Barya', { ...raw }, null, SYNCED_AT);
    expect(toSearchEntry(detail).category).toBe(detail.category);
  });

  it('does not reassign a name that merely contains "DNT" or "Removed" without the exact marker shape', () => {
    const raw = fixture('sample-item.json');
    const notDnt = normalizeItem('Adnthea\'s Ring', { ...raw }, null, SYNCED_AT);
    const notRemoved = normalizeItem('Removed Skillful Strike', { ...raw }, null, SYNCED_AT);
    expect(toSearchEntry(notDnt).category).toBe(notDnt.category);
    expect(toSearchEntry(notRemoved).category).toBe(notRemoved.category);
  });

  it('reassigns an item whose category is an "_OLD"-suffixed legacy class, even with a normal name', () => {
    const raw = fixture('sample-item.json');
    const detail = normalizeItem('Uncut Skill Gem', { ...raw, itemClass: 'UncutSkillGem_OLD' }, null, SYNCED_AT);
    expect(toSearchEntry(detail).category).toBe('Unused / Removed');
  });

  it('does not reassign an "_OLD"-suffixed category for a non-item kind (the rule is item-only)', () => {
    const modRaw = fixture('sample-mod.json');
    const detail = normalizeMod('x', { ...modRaw, generationType: 'Suffix_OLD' }, SYNCED_AT);
    expect(detail.category).toBe('Suffix_OLD');
    expect(toSearchEntry(detail).category).toBe('Suffix_OLD');
  });
});
