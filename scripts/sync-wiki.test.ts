import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { buildStatIndex } from '@poe2-toolkit/ggpk';
import path from 'node:path';
import {
  validateSyncResult,
  ddsPathToIconKey,
  dedupeSlug,
  findPreviousVersionDir,
  findPreviousCount,
  joinCurrencyByName,
  joinImplicitModsByName,
  joinFlaskStatsByName,
  readEffectRows,
  loadCommunitySourceOverrides,
  applyCommunitySource,
  readKeywordDefinitions,
  attachKeywordDefinitions,
  joinSoulCoresByName,
} from './sync-wiki';

const entry = (slug: string) => ({
  slug, name: slug, kind: 'skill' as const, category: 'Active Skill Gem', tags: [],
});

describe('validateSyncResult', () => {
  it('passes when the count is stable', () => {
    expect(() => validateSyncResult([entry('a'), entry('b')], 2)).not.toThrow();
  });

  it('throws on an empty result', () => {
    expect(() => validateSyncResult([], 100)).toThrow(/empty/i);
  });

  it('throws when the count drops more than 10 percent', () => {
    const entries = Array.from({ length: 80 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100)).toThrow(/dropped/i);
  });

  it('allows growth without complaint', () => {
    const entries = Array.from({ length: 200 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100)).not.toThrow();
  });

  it('throws on duplicate slugs', () => {
    expect(() => validateSyncResult([entry('a'), entry('a')], 2)).toThrow(/duplicate/i);
  });

  it('skips the drop check on a first run', () => {
    expect(() => validateSyncResult([entry('a')], 0)).not.toThrow();
  });

  it('names the escape hatch in the drop error so the operator can find it', () => {
    const entries = Array.from({ length: 80 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100)).toThrow(/--allow-shrink/);
  });

  it('waives the drop check when the shrink is declared intentional', () => {
    const entries = Array.from({ length: 80 }, (_, i) => entry(`s${i}`));
    expect(() => validateSyncResult(entries, 100, { allowShrink: true })).not.toThrow();
  });

  it('still refuses an empty result even with allowShrink', () => {
    // allowShrink waives the drop check only — an empty extract is never
    // an intentional filter outcome, it is a broken pipeline.
    expect(() => validateSyncResult([], 100, { allowShrink: true })).toThrow(/empty/i);
  });

  it('still refuses duplicate slugs even with allowShrink', () => {
    expect(() => validateSyncResult([entry('a'), entry('a')], 2, { allowShrink: true }))
      .toThrow(/duplicate/i);
  });
});

describe('ddsPathToIconKey', () => {
  it('replaces the dds extension with png, case-insensitively', () => {
    expect(ddsPathToIconKey('Art/2DArt/SkillIcons/SorceressIceNova.dds')).toBe('Art/2DArt/SkillIcons/SorceressIceNova.png');
  });
  it('leaves a path with no dds extension unchanged', () => {
    expect(ddsPathToIconKey('Art/2DArt/SkillIcons/SorceressIceNova')).toBe('Art/2DArt/SkillIcons/SorceressIceNova');
  });
});

describe('findPreviousVersionDir / findPreviousCount', () => {
  let root: string;

  const writeIndex = (version: string, kind: string, count: number) => {
    const dir = path.join(root, version);
    mkdirSync(dir, { recursive: true });
    const entries = Array.from({ length: count }, (_, i) => entry(`${kind}-${i}`));
    writeFileSync(path.join(dir, `${kind}-index.json`), JSON.stringify({ entries }));
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-sync-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('picks the most recent PRIOR version directory when the version was hand-bumped', () => {
    // Two real prior syncs on disk plus a freshly-created (empty)
    // current-version dir - what a hand-bumped WIKI_DATA_VERSION looks like.
    writeIndex('2026-08-01', 'skill', 5);
    writeIndex('2026-08-14', 'skill', 8);
    mkdirSync(path.join(root, '2026-08-21'), { recursive: true }); // current version, no index file yet

    expect(findPreviousVersionDir(root, '2026-08-21')).toBe(path.join(root, '2026-08-14'));
    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(8);
  });

  it('counts the CURRENT version directory when the sync re-runs against it (the weekly-CI case)', () => {
    // The realistic scenario, and the one two earlier revisions of this code
    // both got wrong: nothing bumps WIKI_DATA_VERSION between syncs, so the
    // weekly workflow re-runs against the same directory it wrote last time.
    // That directory holds the only previous count there is - if it is not
    // counted, the drop guard is inert in exactly the automated path it was
    // written to protect.
    writeIndex('2026-08-21', 'skill', 1118);

    expect(findPreviousVersionDir(root, '2026-08-21')).toBeNull();
    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(1118);
  });

  it('makes the drop guard actually fire on a truncated re-run against the current version', () => {
    // End-to-end on the same case: a re-run that returns a fraction of last
    // week's gems must throw rather than silently overwrite good data.
    writeIndex('2026-08-21', 'skill', 1118);
    const truncated = Array.from({ length: 40 }, (_, i) => entry(`s${i}`));

    expect(() =>
      validateSyncResult(truncated, findPreviousCount(root, '2026-08-21', 'skill')),
    ).toThrow(/dropped/i);
  });

  it('prefers whichever of the current or prior directory has the higher count', () => {
    // A partially-written or truncated current directory must not be able to
    // lower the bar the guard checks against.
    writeIndex('2026-08-14', 'skill', 1118);
    writeIndex('2026-08-21', 'skill', 3);

    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(1118);
  });

  it('returns 0 / null when the current version directory exists but is empty', () => {
    mkdirSync(path.join(root, '2026-08-21'), { recursive: true });
    expect(findPreviousVersionDir(root, '2026-08-21')).toBeNull();
    expect(findPreviousCount(root, '2026-08-21', 'skill')).toBe(0);
  });

  it('returns 0 / null on a genuine first-ever sync (wiki root does not exist yet)', () => {
    const missingRoot = path.join(root, 'does-not-exist');
    expect(findPreviousVersionDir(missingRoot, '2026-08-21')).toBeNull();
    expect(findPreviousCount(missingRoot, '2026-08-21', 'skill')).toBe(0);
  });

  it('returns 0 when the prior version directory exists but has no index file for this kind', () => {
    writeIndex('2026-08-14', 'skill', 8); // only skill, no mod
    expect(findPreviousCount(root, '2026-08-21', 'mod')).toBe(0);
  });
});

describe('dedupeSlug', () => {
  it('returns the base slug unchanged on first use', () => {
    const used = new Set<string>();
    expect(dedupeSlug('herald-of-ash', 'SkillGemHeraldOfAsh', used)).toBe('herald-of-ash');
    expect(used.has('herald-of-ash')).toBe(true);
  });

  it('appends a camelCase-split disambiguator on collision', () => {
    const used = new Set<string>(['herald-of-ash']);
    expect(dedupeSlug('herald-of-ash', 'UniqueSkillGemHeraldOfAsh', used))
      .toBe('herald-of-ash-unique-skill-gem-herald-of-ash');
  });

  it('falls back to a numeric suffix if the disambiguated slug also collides', () => {
    const used = new Set<string>(['x', 'x-y']);
    expect(dedupeSlug('x', 'y', used)).toBe('x-y-2');
  });

  it('never returns a slug already in the used set', () => {
    const used = new Set<string>();
    const a = dedupeSlug('sword-slash', 'SkillGemPlayerDefault1HSword', used);
    const b = dedupeSlug('sword-slash', 'SkillGemPlayerDefault2HSword', used);
    const c = dedupeSlug('sword-slash', 'SkillGemPlayerDefaultSwordSword', used);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe('joinCurrencyByName', () => {
  let root: string;

  const writeTables = (baseItemTypes: object[], currencyItems: object[]) => {
    const dir = path.join(root, 'tables', 'English');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'BaseItemTypes.json'), JSON.stringify(baseItemTypes));
    writeFileSync(path.join(dir, 'CurrencyItems.json'), JSON.stringify(currencyItems));
    return dir;
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-currency-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('joins a CurrencyItems row to its BaseItemTypes name by row index', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Currency/CurrencyWeaponQuality', Name: "Blacksmith's Whetstone" }],
      [{
        _index: 15, BaseItemType: 0, StackSize: 20,
        Directions: 'Right click this item then left click a martial weapon to apply it.',
        Description: 'Improves the [Quality|quality] of a [MartialWeapon|martial weapon]',
        XBoxDirections: '<<xbox_button_x>> to use, then <<xbox_button_a>> on martial weapon to apply it.',
      }],
    );

    const result = joinCurrencyByName(dir);

    expect(result.get("Blacksmith's Whetstone")).toEqual({
      stackSize: 20,
      description: 'Improves the [Quality|quality] of a [MartialWeapon|martial weapon]',
      directions: 'Right click this item then left click a martial weapon to apply it.',
      xboxDirections: '<<xbox_button_x>> to use, then <<xbox_button_a>> on martial weapon to apply it.',
    });
  });

  it('leaves bracket markup un-stripped — that is normalizeItem/stripBracketMarkup\'s job, not the join\'s', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Currency/CurrencyMirroredItem', Name: 'Mirror of Kalandra' }],
      [{ _index: 5, BaseItemType: 0, StackSize: 1, Directions: null, Description: 'Creates a [Mirrored] copy of an item', XBoxDirections: null }],
    );

    expect(joinCurrencyByName(dir).get('Mirror of Kalandra')?.description).toBe('Creates a [Mirrored] copy of an item');
  });

  it('returns an empty map when a name has no matching currency row', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Gear/Sword', Name: 'Rusted Sword' }],
      [],
    );

    expect(joinCurrencyByName(dir).size).toBe(0);
  });

  it('keeps the first row on a name collision, same convention as ItemData itself', () => {
    const dir = writeTables(
      [
        { _index: 0, Id: 'Metadata/Items/Currency/A', Name: 'Duplicate Name' },
        { _index: 1, Id: 'Metadata/Items/Currency/B', Name: 'Duplicate Name' },
      ],
      [
        { _index: 0, BaseItemType: 0, StackSize: 10, Directions: null, Description: 'first', XBoxDirections: null },
        { _index: 1, BaseItemType: 1, StackSize: 99, Directions: null, Description: 'second', XBoxDirections: null },
      ],
    );

    expect(joinCurrencyByName(dir).get('Duplicate Name')?.description).toBe('first');
  });
});

describe('joinImplicitModsByName', () => {
  let root: string;

  const writeTables = (baseItemTypes: object[], mods: object[]) => {
    const dir = path.join(root, 'tables', 'English');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'BaseItemTypes.json'), JSON.stringify(baseItemTypes));
    writeFileSync(path.join(dir, 'Mods.json'), JSON.stringify(mods));
    return dir;
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-implicit-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('joins a base\'s Implicit_Mods indices to their rendered stat text by name', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Weapons/OneHandSpears/FourSpear7', Name: 'Barbed Spear', Implicit_Mods: [5] }],
      [{ _index: 5, Id: 'SpearImplicitFasterBleed1' }],
    );
    const modData = { SpearImplicitFasterBleed1: { stats: ['Bleeding you inflict deals Damage (10-20)% faster'] } };

    expect(joinImplicitModsByName(dir, modData).get('Barbed Spear'))
      .toEqual(['Bleeding you inflict deals Damage (10-20)% faster']);
  });

  it('flattens stats across multiple implicit mods on one base', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/X', Name: 'Two-Implicit Base', Implicit_Mods: [1, 2] }],
      [{ _index: 1, Id: 'ModA' }, { _index: 2, Id: 'ModB' }],
    );
    const modData = {
      ModA: { stats: ['First implicit line'] },
      ModB: { stats: ['Second implicit line'] },
    };

    expect(joinImplicitModsByName(dir, modData).get('Two-Implicit Base'))
      .toEqual(['First implicit line', 'Second implicit line']);
  });

  it('drops a base whose implicit mod has no rendered stat line (e.g. a skill-granting flag mod)', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/X', Name: 'Flag-Only Base', Implicit_Mods: [3] }],
      [{ _index: 3, Id: 'DisplayOnlyMod' }],
    );
    const modData = { DisplayOnlyMod: { stats: [] } };

    expect(joinImplicitModsByName(dir, modData).has('Flag-Only Base')).toBe(false);
  });

  it('does not include a base with an empty Implicit_Mods array', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/X', Name: 'No Implicits Base', Implicit_Mods: [] }],
      [],
    );

    expect(joinImplicitModsByName(dir, {}).has('No Implicits Base')).toBe(false);
  });

  it('keeps the first base on a name collision, same convention as joinCurrencyByName', () => {
    const dir = writeTables(
      [
        { _index: 0, Id: 'Metadata/Items/A', Name: 'Duplicate Name', Implicit_Mods: [1] },
        { _index: 1, Id: 'Metadata/Items/B', Name: 'Duplicate Name', Implicit_Mods: [2] },
      ],
      [{ _index: 1, Id: 'ModA' }, { _index: 2, Id: 'ModB' }],
    );
    const modData = { ModA: { stats: ['first'] }, ModB: { stats: ['second'] } };

    expect(joinImplicitModsByName(dir, modData).get('Duplicate Name')).toEqual(['first']);
  });
});

describe('joinFlaskStatsByName', () => {
  let root: string;

  const writeTables = (baseItemTypes: object[], flasks: object[]) => {
    const dir = path.join(root, 'tables', 'English');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'BaseItemTypes.json'), JSON.stringify(baseItemTypes));
    writeFileSync(path.join(dir, 'Flasks.json'), JSON.stringify(flasks));
    return dir;
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-flask-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('joins a Flasks row to its BaseItemTypes name, converting RecoveryTime to real seconds', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Flasks/FlaskUniqueMana2', Name: 'Transcendent Mana Flask' }],
      [{ _index: 16, BaseItemType: 0, LifePerUse: 0, ManaPerUse: 285, RecoveryTime: 35 }],
    );

    expect(joinFlaskStatsByName(dir).get('Transcendent Mana Flask')).toEqual({
      lifeRecovery: 0,
      manaRecovery: 285,
      duration: 3.5,
    });
  });

  it('returns an empty map when a name has no matching flask row', () => {
    const dir = writeTables(
      [{ _index: 0, Id: 'Metadata/Items/Currency/X', Name: 'Chaos Orb' }],
      [],
    );

    expect(joinFlaskStatsByName(dir).size).toBe(0);
  });

  it('keeps the first row on a name collision, same convention as joinCurrencyByName', () => {
    const dir = writeTables(
      [
        { _index: 0, Id: 'Metadata/Items/A', Name: 'Duplicate Name' },
        { _index: 1, Id: 'Metadata/Items/B', Name: 'Duplicate Name' },
      ],
      [
        { _index: 0, BaseItemType: 0, LifePerUse: 50, ManaPerUse: 0, RecoveryTime: 30 },
        { _index: 1, BaseItemType: 1, LifePerUse: 999, ManaPerUse: 0, RecoveryTime: 99 },
      ],
    );

    expect(joinFlaskStatsByName(dir).get('Duplicate Name')).toEqual({
      lifeRecovery: 50,
      manaRecovery: 0,
      duration: 3,
    });
  });
});

describe('readEffectRows', () => {
  let root: string;

  const writeTable = (buffDefinitions: object[]) => {
    const dir = path.join(root, 'tables', 'English');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'BuffDefinitions.json'), JSON.stringify(buffDefinitions));
    return dir;
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-effect-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('keeps a row with both a real Name and Description', () => {
    const dir = writeTable([
      { _index: 0, Id: 'maim', Name: 'Maimed', Description: 'Reduced [Evasion] and movement speed [Slow|Slowed].' },
    ]);

    expect(readEffectRows(dir)).toEqual([
      { id: 'maim', name: 'Maimed', description: 'Reduced [Evasion] and movement speed [Slow|Slowed].' },
    ]);
  });

  it('drops rows with no Name, no Description, or neither — internal hook rows with no usable definition', () => {
    const dir = writeTable([
      { _index: 0, Id: 'have_killed_a_maimed_enemy_recently', Name: '', Description: '' },
      { _index: 1, Id: 'no_description', Name: 'Something', Description: '' },
      { _index: 2, Id: 'no_name', Name: '', Description: 'Something happens.' },
      { _index: 3, Id: 'bleeding', Name: 'Bleeding', Description: 'Debuff inflicts damage over time.' },
    ]);

    expect(readEffectRows(dir)).toEqual([
      { id: 'bleeding', name: 'Bleeding', description: 'Debuff inflicts damage over time.' },
    ]);
  });

  it('keeps the first row on a name collision, same convention as joinCurrencyByName', () => {
    const dir = writeTable([
      { _index: 0, Id: 'righteous_fire', Name: 'Righteous Fire', Description: 'You take burning damage.' },
      { _index: 1, Id: 'righteous_fire_aura', Name: 'Righteous Fire', Description: 'You are near someone using Righteous Fire.' },
    ]);

    expect(readEffectRows(dir)).toEqual([
      { id: 'righteous_fire', name: 'Righteous Fire', description: 'You take burning damage.' },
    ]);
  });

  it('returns an empty array when the table has no usable rows', () => {
    const dir = writeTable([{ _index: 0, Id: 'x', Name: '', Description: '' }]);
    expect(readEffectRows(dir)).toEqual([]);
  });
});

describe('readKeywordDefinitions', () => {
  let root: string;

  const writeTable = (keywordPopups: object[]) => {
    const dir = path.join(root, 'tables', 'English');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'KeywordPopups.json'), JSON.stringify(keywordPopups));
    return dir;
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-keyword-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('keys by Term, keeping the raw (unstripped) Definition', () => {
    const dir = writeTable([
      { _index: 798, Id: 'LegacyOfGold', Term: 'Legacy of Gold', Definition: "Legacy of Gold is a [MagesLegacy|Mage's Legacy] which grants 45% increased [ItemRarity|Rarity of Items] found." },
    ]);
    expect(readKeywordDefinitions(dir)).toEqual(new Map([
      ['Legacy of Gold', "Legacy of Gold is a [MagesLegacy|Mage's Legacy] which grants 45% increased [ItemRarity|Rarity of Items] found."],
    ]));
  });

  it('skips a row with an empty Definition (placeholder/test rows in the real table)', () => {
    const dir = writeTable([
      { _index: 6, Id: 'test2', Term: 'Test custom content', Definition: '' },
    ]);
    expect(readKeywordDefinitions(dir)).toEqual(new Map());
  });

  it('keeps the first row on a Term collision, same convention as every other by-name join here', () => {
    const dir = writeTable([
      { _index: 0, Id: 'A', Term: 'Charms', Definition: 'First definition.' },
      { _index: 1, Id: 'B', Term: 'Charms', Definition: 'Second definition.' },
    ]);
    expect(readKeywordDefinitions(dir)).toEqual(new Map([['Charms', 'First definition.']]));
  });
});

describe('loadCommunitySourceOverrides', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-community-source-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('returns an empty object when the file does not exist', () => {
    expect(loadCommunitySourceOverrides(path.join(root, 'missing.json'))).toEqual({});
  });

  it('parses a real overrides file', () => {
    const file = path.join(root, 'overrides.json');
    writeFileSync(file, JSON.stringify({
      mod: { 'some-mod-slug': { text: 'Explanation.', sourceUrl: 'https://poe2db.tw/us/Some_Page' } },
    }));
    expect(loadCommunitySourceOverrides(file)).toEqual({
      mod: { 'some-mod-slug': { text: 'Explanation.', sourceUrl: 'https://poe2db.tw/us/Some_Page' } },
    });
  });
});

describe('applyCommunitySource', () => {
  it('attaches a matching override by slug', () => {
    const details: { slug: string; communitySource?: { text: string; sourceUrl: string } | null }[] =
      [{ slug: 'atziris-influence-mod' }, { slug: 'other-mod' }];
    const result = applyCommunitySource('mod', details, {
      mod: { 'atziris-influence-mod': { text: 'Explanation.', sourceUrl: 'https://poe2db.tw/us/X' } },
    });
    expect(result[0].communitySource).toEqual({ text: 'Explanation.', sourceUrl: 'https://poe2db.tw/us/X' });
    expect(result[1].communitySource).toBeUndefined();
  });

  it('returns the same array reference when this kind has no overrides', () => {
    const details = [{ slug: 'a' }];
    expect(applyCommunitySource('mod', details, {})).toBe(details);
    expect(applyCommunitySource('mod', details, { mod: {} })).toBe(details);
  });

  it('does not mutate entries with no override', () => {
    const details = [{ slug: 'a' }, { slug: 'b' }];
    const result = applyCommunitySource('mod', details, { mod: { b: { text: 'x', sourceUrl: 'y' } } });
    expect(result[0]).toBe(details[0]);
    expect(result[1]).not.toBe(details[1]);
  });
});

describe('attachKeywordDefinitions', () => {
  it('attaches the stripped definition when the entry name matches a term exactly', () => {
    const details: { name: string; keywordDefinition?: string | null }[] =
      [{ name: 'Bleeding' }, { name: 'Something Else' }];
    const result = attachKeywordDefinitions(details, new Map([
      ['Bleeding', 'Bleeding is an [Ailments|Ailment] that deals [Physical|Physical] damage over time.'],
    ]));
    expect(result[0].keywordDefinition).toBe('Bleeding is an Ailment that deals Physical damage over time.');
    expect(result[1].keywordDefinition).toBeUndefined();
  });

  it('returns the same array reference when there are no keyword definitions at all', () => {
    const details = [{ name: 'Bleeding' }];
    expect(attachKeywordDefinitions(details, new Map())).toBe(details);
  });

  it('does not mutate entries with no matching term', () => {
    const details = [{ name: 'Bleeding' }, { name: 'Nothing Matches' }];
    const result = attachKeywordDefinitions(details, new Map([['Bleeding', 'x']]));
    expect(result[1]).toBe(details[1]);
    expect(result[0]).not.toBe(details[0]);
  });
});

describe('joinSoulCoresByName', () => {
  let root: string;

  // A real, minimally-valid stat_descriptions.csd snippet (see
  // node_modules/@poe2-toolkit/ggpk/dist/statDescriptions.js's own format
  // comment) - exercises the actual GGG rendering engine end to end rather
  // than stubbing it, since StatIndex's internals are documented as opaque.
  const statIndex = buildStatIndex(`description
	1 base_fire_damage_resistance_%
	1
		# "+{0}% to Fire Resistance"
	lang "French"
		# "French text"
description
	2 local_minimum_added_fire_damage local_maximum_added_fire_damage
	1
		# # "Adds {0} to {1} Fire Damage"
	lang "French"
		# # "French text"
`);

  const writeTables = (baseItemTypes: object[], soulCores: object[], soulCoreStats: object[], statCategories: object[], stats: object[]) => {
    const dir = path.join(root, 'tables', 'English');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'BaseItemTypes.json'), JSON.stringify(baseItemTypes));
    writeFileSync(path.join(dir, 'SoulCores.json'), JSON.stringify(soulCores));
    writeFileSync(path.join(dir, 'SoulCoreStats.json'), JSON.stringify(soulCoreStats));
    writeFileSync(path.join(dir, 'SoulCoreStatCategories.json'), JSON.stringify(statCategories));
    writeFileSync(path.join(dir, 'Stats.json'), JSON.stringify(stats));
    return dir;
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'wiki-soulcore-test-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('joins a rune to its rendered per-category effect lines', () => {
    const dir = writeTables(
      [{ _index: 0, Name: 'Desert Rune' }],
      [{ _index: 0, BaseItemType: 0 }],
      [
        { SoulCore: 0, StatCategory: 0, Stats: [0], StatsValues: [45] },
        { SoulCore: 0, StatCategory: 1, Stats: [1, 2], StatsValues: [4, 6] },
      ],
      [
        { _index: 0, Id: 'Armour', Display: 'Armour' },
        { _index: 1, Id: 'Martial Weapon', Display: '' },
      ],
      [
        { _index: 0, Id: 'base_fire_damage_resistance_%' },
        { _index: 1, Id: 'local_minimum_added_fire_damage' },
        { _index: 2, Id: 'local_maximum_added_fire_damage' },
      ],
    );

    expect(joinSoulCoresByName(dir, statIndex)).toEqual(new Map([
      ['Desert Rune', [
        { category: 'Armour', lines: ['+45% to Fire Resistance'] },
        { category: 'Martial Weapon', lines: ['Adds 4 to 6 Fire Damage'] },
      ]],
    ]));
  });

  it('falls back to the category Id when Display is empty', () => {
    const dir = writeTables(
      [{ _index: 0, Name: 'Desert Rune' }],
      [{ _index: 0, BaseItemType: 0 }],
      [{ SoulCore: 0, StatCategory: 0, Stats: [0], StatsValues: [45] }],
      [{ _index: 0, Id: 'Martial Weapon', Display: '' }],
      [{ _index: 0, Id: 'base_fire_damage_resistance_%' }],
    );
    const result = joinSoulCoresByName(dir, statIndex);
    expect(result.get('Desert Rune')?.[0].category).toBe('Martial Weapon');
  });

  it('strips GGPK bracket markup from the category label - real data has "[MartialWeapon|Martial Weapon]"', () => {
    const dir = writeTables(
      [{ _index: 0, Name: 'Desert Rune' }],
      [{ _index: 0, BaseItemType: 0 }],
      [{ SoulCore: 0, StatCategory: 0, Stats: [0], StatsValues: [45] }],
      [{ _index: 0, Id: 'Martial Weapon', Display: '[MartialWeapon|Martial Weapon]' }],
      [{ _index: 0, Id: 'base_fire_damage_resistance_%' }],
    );
    const result = joinSoulCoresByName(dir, statIndex);
    expect(result.get('Desert Rune')?.[0].category).toBe('Martial Weapon');
  });

  it('drops a stat row whose rune name has no matching BaseItemTypes entry', () => {
    const dir = writeTables(
      [],
      [{ _index: 0, BaseItemType: 99 }],
      [{ SoulCore: 0, StatCategory: 0, Stats: [0], StatsValues: [45] }],
      [{ _index: 0, Id: 'Armour', Display: 'Armour' }],
      [{ _index: 0, Id: 'base_fire_damage_resistance_%' }],
    );
    expect(joinSoulCoresByName(dir, statIndex)).toEqual(new Map());
  });

  it('returns an empty map when SoulCoreStats has no rows', () => {
    const dir = writeTables(
      [{ _index: 0, Name: 'Desert Rune' }],
      [{ _index: 0, BaseItemType: 0 }],
      [],
      [],
      [],
    );
    expect(joinSoulCoresByName(dir, statIndex)).toEqual(new Map());
  });
});
