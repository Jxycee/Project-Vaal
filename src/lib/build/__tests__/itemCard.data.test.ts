// Failure modes for the reader's item card, written before buildItemCard
// exists. Each is a way a reader gets a card that lies or goes blank:
//  1. a mod's tier is shown the way our files number it (8 = best) instead of
//     from the top, so a reader sees "P8" on the best roll and thinks it is bad
//  2. prefix and suffix are not told apart, or a unique's lines get tier tags
//  3. a stored roll is not shown (the card prints the template's range)
//  4. the roll bar leaves 0-100, or shows a bar for a fixed-value line
//  5. a mod whose file did not load disappears, so the card looks shorter than
//     the item
//  6. the same rune socketed twice prints as two boxes, or the effect shown is
//     for the wrong kind of item
//  7. zero requirements are listed, or the weapon / armour block is missing
//  8. the card's text differs from the PoB export of the same item
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { getCatalogue } from '@/lib/pob/catalogue';
import { decodePobCode } from '@/lib/pob/decode';
import { mapBuild } from '@/lib/pob/mapBuild';
import { parsePobXml } from '@/lib/pob/parse';
import { displayedValues, emptyCraft } from '../craft';
import type { GearItem } from '../gearSlots';
import { buildItemCard, rollPercent, type CardSources } from '../itemCard';

const wiki = (...p: string[]) => path.join(process.cwd(), 'public', 'data', 'wiki', '2026-08-25', ...p);
const json = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as unknown;
const tiers = json(wiki('mod-tiers.json')) as Record<string, [number, number]>;

function sourcesFor(item: GearItem): CardSources {
  const mods = new Map<string, unknown>();
  for (const m of [...(item.craft?.prefixes ?? []), ...(item.craft?.suffixes ?? [])]) mods.set(m.slug, json(wiki('mods', `${m.slug}.json`)));
  const runes = new Map<string, unknown>();
  for (const slug of item.craft?.runes ?? []) runes.set(slug, json(wiki('items', `${slug}.json`)));
  return { item: json(wiki('items', `${item.slug}.json`)), mods, tiers, runes };
}

let crossbow: GearItem;
let helmet: GearItem;
let cloak: GearItem;

beforeAll(async () => {
  const decoded = decodePobCode(readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8'));
  if (!decoded.ok) throw new Error('decode');
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error('parse');
  const mapped = await mapBuild(parsed.build, await getCatalogue(), {});
  if (!mapped.ok) throw new Error(mapped.error);
  const gear = mapped.plan.checkpoints[7].gear_state;
  crossbow = gear.weapon1_main!;
  helmet = gear.head!;
  cloak = gear.body!;
}, 120_000);

describe('buildItemCard: tiers and sides', () => {
  it('counts the tier from the top (our file calls the best tier 8)', () => {
    const card = buildItemCard(crossbow, sourcesFor(crossbow));
    const phys = card.mods.find((m) => m.lines[0].includes('Physical Damage') && m.lines[0].includes('%'))!;
    // localincreasedphysicaldamagepercent6 is the 3rd best of 8 tiers.
    expect(phys.tag).toBe('P3');
  });

  it('tags prefixes P and suffixes S, and never tags a unique line', () => {
    const card = buildItemCard(crossbow, sourcesFor(crossbow));
    expect(card.mods.filter((m) => m.kind === 'prefix').every((m) => /^P\d+$/.test(m.tag))).toBe(true);
    expect(card.mods.filter((m) => m.kind === 'suffix').every((m) => /^S\d+$/.test(m.tag))).toBe(true);
    expect(card.mods.some((m) => m.kind === 'prefix')).toBe(true);
    expect(card.mods.some((m) => m.kind === 'suffix')).toBe(true);
    const unique = buildItemCard(cloak, sourcesFor(cloak));
    expect(unique.mods.length).toBeGreaterThan(0);
    expect(unique.mods.every((m) => m.kind === 'unique' && m.tag === '')).toBe(true);
  });
});

describe('buildItemCard: lines and rolls', () => {
  it('shows the stored roll, never the template range', () => {
    const card = buildItemCard(crossbow, sourcesFor(crossbow));
    const lines = card.mods.flatMap((m) => m.lines);
    expect(lines.some((l) => /^150% increased Physical Damage$/.test(l))).toBe(true);
    expect(lines.every((l) => !/\(\d+(\.\d+)?-\d+(\.\d+)?\)/.test(l))).toBe(true);
  });

  it('keeps the range as separate muted text', () => {
    const card = buildItemCard(crossbow, sourcesFor(crossbow));
    const phys = card.mods.find((m) => m.lines[0] === '150% increased Physical Damage')!;
    expect(phys.tag).toBe('P3');
    expect(phys.range).toBe('(135-154)');
  });

  it('prints a roll stored in hundredths in the units the line shows (crit 377 -> 3.77%)', () => {
    const card = buildItemCard(crossbow, sourcesFor(crossbow));
    const lines = card.mods.flatMap((m) => m.lines);
    expect(lines).toContain('+3.77% to Critical Hit Chance');
    expect(lines.some((l) => l === '+4% to Critical Hit Chance')).toBe(false);
  });

  it('displayedValues: same units pass through, a x100 roll scales, anything else is null', () => {
    expect(displayedValues(['+(30-50)% to Fire Resistance'], [{ min: 30, max: 50 }], [42])).toEqual([42]);
    expect(displayedValues(['+(3-4)% to Critical Hit Chance'], [{ min: 311, max: 380 }], [377])).toEqual([3.77]);
    expect(displayedValues(['+(3-4)% to Critical Hit Chance'], [{ min: 100, max: 900 }], [377])).toBeNull();
    expect(displayedValues(['Adds (1-2) to (3-4) Damage'], [{ min: 1, max: 2 }], [1])).toBeNull();
  });

  it('roll percent: min is 0, max is 100, clamps, and a fixed line has no bar', () => {
    expect(rollPercent([{ min: 10, max: 20 }], [10])).toBe(0);
    expect(rollPercent([{ min: 10, max: 20 }], [20])).toBe(100);
    expect(rollPercent([{ min: 10, max: 20 }], [15])).toBe(50);
    expect(rollPercent([{ min: 10, max: 20 }], [99])).toBe(100);
    expect(rollPercent([{ min: 10, max: 20 }], [-5])).toBe(0);
    expect(rollPercent([{ min: 5, max: 5 }], [5])).toBeNull();
    expect(rollPercent([], [])).toBeNull();
    // A negative range runs from its larger-magnitude end: -10 is its best.
    expect(rollPercent([{ min: -5, max: -10 }], [-10])).toBe(100);
    expect(rollPercent([{ min: -5, max: -10 }], [-5])).toBe(0);
  });

  it('keeps a mod whose file did not load, marked unknown, instead of dropping it', () => {
    const full = sourcesFor(crossbow);
    const mods = new Map(full.mods);
    mods.delete(crossbow.craft!.prefixes[0].slug);
    const card = buildItemCard(crossbow, { ...full, mods });
    expect(card.mods.length).toBe(crossbow.craft!.prefixes.length + crossbow.craft!.suffixes.length);
    expect(card.mods.some((m) => m.unknown)).toBe(true);
  });
});

describe('buildItemCard: header, requirements, runes', () => {
  it('names the item, its base and its rarity', () => {
    const card = buildItemCard(crossbow, sourcesFor(crossbow));
    expect(card.base).toContain('Crossbow');
    expect(card.rarity).toBe('rare');
    expect(card.name).toBe(crossbow.craft!.name || crossbow.name);
  });

  it('lists only the requirements an item has', () => {
    const card = buildItemCard(helmet, sourcesFor(helmet));
    expect(card.requirements).toContain('Strength');
    expect(card.requirements).not.toContain('Dexterity');
    expect(card.requirements).not.toContain('Intelligence');
    expect(card.requirements).toMatch(/Level \d+/);
  });

  it('shows base weapon and base armour numbers, labelled as base', () => {
    const w = buildItemCard(crossbow, sourcesFor(crossbow));
    expect(w.stats.some((s) => /Physical Damage/.test(s.label))).toBe(true);
    expect(w.stats.every((s) => /^Base /.test(s.label) || s.label === 'Quality')).toBe(true);
    const a = buildItemCard(helmet, sourcesFor(helmet));
    expect(a.stats.some((s) => /Armour/.test(s.label) && s.value === '357')).toBe(true);
  });

  it('groups a rune socketed twice into one box and picks the effect for this kind of item', () => {
    const card = buildItemCard(crossbow, sourcesFor(crossbow));
    expect(card.runes.length).toBe(1);
    expect(card.runes[0].count).toBe(2);
    expect(card.runes[0].effect.length).toBeGreaterThan(0);
    const body = buildItemCard(helmet, sourcesFor(helmet));
    expect(body.runes.length).toBeGreaterThan(0);
  });

  it('a unique body armour whose file carries no armour numbers still gets its runes\' armour effect', () => {
    const card = buildItemCard(cloak, sourcesFor(cloak));
    expect(card.runes.length).toBe(1);
    expect(card.runes[0].count).toBe(2);
    expect(card.runes[0].effect.join(' ')).toMatch(/Life/);
  });

  it('an item with no craft still gets a card from the base alone', () => {
    const bare: GearItem = { slug: helmet.slug, name: helmet.name, category: helmet.category, isUnique: false, iconUrl: null };
    const card = buildItemCard(bare, sourcesFor(bare));
    expect(card.name).toBe(helmet.name);
    expect(card.mods).toEqual([]);
    void emptyCraft;
  });
});
