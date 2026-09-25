import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GEAR_SLOTS } from '@/lib/build/gearSlots';
import { cleanGearStateInput } from '@/lib/build/stateInput';
import { getCatalogue, type CatalogueItem } from '../catalogue';
import { decodePobCode } from '../decode';
import { mapItems, mapJewels, type ItemLookup, type JewelTreeLookup } from '../mapItems';
import { parsePobXml, type PobItem, type PobSlot } from '../parse';

// Failure modes first (AGENTS.md). A small fake item catalogue isolates each
// rule; the real build against the real catalogue checks the whole thing at
// the end.

const entry = (name: string, category: string, isUnique = false): CatalogueItem => ({
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
  name,
  category,
  isUnique,
});

const known = [
  entry('Plain Ring', 'Ring'),
  entry('Plain Helm', 'Helmet'),
  entry('Plain Gloves', 'Gloves'),
  entry('Famous Gloves', 'Gloves', true),
  entry('Small Life Flask', 'LifeFlask'),
  entry('Small Mana Flask', 'ManaFlask'),
  entry('Plain Charm', 'UtilityFlask'),
  entry('Plain Bow', 'Bow'),
  entry('Plain Shield', 'Shield'),
  entry('Plain Jewel', 'Jewel'),
];

const fake: ItemLookup = {
  byName: new Map(known.map((item) => [item.name, item])),
  findBaseIn(text) {
    return known.filter((item) => !item.isUnique && text.includes(item.name)).sort((a, b) => b.name.length - a.name.length)[0] ?? null;
  },
  async iconUrlFor(slug) {
    return `/data/wiki/2026-08-25/icons/items/${slug}.png`;
  },
};

const item = (id: number, lines: string[]): PobItem => ({ id, raw: lines.join('\n') });
const rare = (id: number, base: string, extra: string[] = []) => item(id, ['Rarity: RARE', 'Grim Hook', base, ...extra]);
const slot = (name: string, itemId: number): PobSlot => ({ name, itemId });

describe('mapItems — every way it can go wrong', () => {
  it('reports an occupied Ring 3 instead of forcing it into ring2', async () => {
    const { value, report } = await mapItems([rare(1, 'Plain Ring')], [slot('Ring 3', 1)], fake);
    expect(value.ring1).toBeNull();
    expect(value.ring2).toBeNull();
    expect(report).toHaveLength(1);
    expect(report[0]).toMatchObject({ kind: 'dropped', area: 'items' });
    expect(report[0].message).toContain('Ring 3');
    expect(report[0].message).toContain('Plain Ring');
  });

  it('reports a slot name it does not know, rather than guessing a home for it', async () => {
    const { value, report } = await mapItems([rare(1, 'Plain Ring')], [slot('Belt Abyssal Socket 1', 1)], fake);
    expect(GEAR_SLOTS.every((s) => value[s] === null)).toBe(true);
    expect(report[0].message).toContain('Belt Abyssal Socket 1');
  });

  it('routes flasks by what they are, not by PoB slot number', async () => {
    const { value, report } = await mapItems(
      [rare(1, 'Small Mana Flask'), rare(2, 'Small Life Flask')],
      [slot('Flask 1', 1), slot('Flask 2', 2)],
      fake,
    );
    expect(value.flask1?.name).toBe('Small Life Flask');
    expect(value.flask2?.name).toBe('Small Mana Flask');
    expect(report.filter((r) => r.kind === 'dropped')).toEqual([]);
  });

  it('reports a second life flask — we hold one — and keeps the first', async () => {
    const { value, report } = await mapItems(
      [rare(1, 'Small Life Flask'), item(2, ['Rarity: RARE', 'Second', 'Small Life Flask'])],
      [slot('Flask 1', 1), slot('Flask 2', 2)],
      fake,
    );
    expect(value.flask1).not.toBeNull();
    expect(value.flask2).toBeNull();
    expect(report).toHaveLength(1);
    expect(report[0].message).toContain('Small Life Flask');
  });

  it('reports a magic item whose name holds no known base', async () => {
    const { value, report } = await mapItems([item(1, ['Rarity: MAGIC', 'Shiny Doodad of Nothing'])], [slot('Helmet', 1)], fake);
    expect(value.head).toBeNull();
    expect(report[0]).toMatchObject({ kind: 'dropped' });
    expect(report[0].message).toContain('Shiny Doodad of Nothing');
  });

  it('marks a magic item\'s base as inferred — it is read out of an affixed name', async () => {
    const { value, report } = await mapItems([item(1, ['Rarity: MAGIC', 'Sturdy Plain Helm of Doing'])], [slot('Helmet', 1)], fake);
    expect(value.head?.name).toBe('Plain Helm');
    expect(report).toHaveLength(1);
    expect(report[0].kind).toBe('inferred');
    expect(report[0].message).toContain('Sturdy Plain Helm of Doing');
  });

  it('falls back to a unique\'s base when the unique is unknown, and says so', async () => {
    const { value, report } = await mapItems(
      [item(1, ['Rarity: UNIQUE', 'Forgotten Grips', 'Plain Gloves'])],
      [slot('Gloves', 1)],
      fake,
    );
    expect(value.gloves).toMatchObject({ name: 'Plain Gloves', isUnique: false });
    expect(report).toHaveLength(1);
    expect(report[0].message).toContain('Forgotten Grips');
  });

  it('imports a known unique as the unique, not its base', async () => {
    const { value, report } = await mapItems(
      [item(1, ['Rarity: UNIQUE', 'Famous Gloves', 'Plain Gloves'])],
      [slot('Gloves', 1)],
      fake,
    );
    expect(value.gloves).toMatchObject({ name: 'Famous Gloves', isUnique: true });
    expect(report).toEqual([]);
  });

  it('drops an item whose base is unknown, naming it', async () => {
    const { value, report } = await mapItems([rare(1, 'Imaginary Visor')], [slot('Helmet', 1)], fake);
    expect(value.head).toBeNull();
    expect(report[0].message).toContain('Imaginary Visor');
  });

  it('drops an item that cannot sit in its slot — a ring is not a helmet', async () => {
    const { value, report } = await mapItems([rare(1, 'Plain Ring')], [slot('Helmet', 1)], fake);
    expect(value.head).toBeNull();
    expect(report[0].message).toContain('Plain Ring');
  });

  it('drops an item with no rarity line rather than guessing its layout', async () => {
    const { value, report } = await mapItems([item(1, ['Plain Helm'])], [slot('Helmet', 1)], fake);
    expect(value.head).toBeNull();
    expect(report).toHaveLength(1);
  });

  it('counts rolled mods, runes, quality and a selected variant — never discarding them silently', async () => {
    const { value, report } = await mapItems(
      [
        item(1, [
          'Rarity: UNIQUE',
          'Famous Gloves',
          'Plain Gloves',
          'Variant: Old',
          'Variant: Current',
          'Selected Variant: 2',
          'Quality: 20',
          'Sockets: S S',
          'Rune: Some Rune',
          'Rune: Some Rune',
          'LevelReq: 33',
          'Implicits: 1',
          '{enchant}{rune}8% increased Attack Speed',
          '{variant:2}+20 to maximum Energy Shield',
          '{range:0.5}+(10-20) to Intelligence',
        ]),
      ],
      [slot('Gloves', 1)],
      fake,
    );
    expect(value.gloves?.name).toBe('Famous Gloves');
    expect(report).toHaveLength(1);
    expect(report[0].kind).toBe('dropped');
    const message = report[0].message;
    expect(message).toContain('Famous Gloves');
    expect(message).toContain('3 mod lines');
    expect(message).toContain('2 runes');
    expect(message).toContain('20% quality');
    expect(message).toContain('variant');
  });

  it('says nothing about details an item does not have', async () => {
    const { report } = await mapItems([rare(1, 'Plain Helm', ['Quality: 0', 'LevelReq: 1', 'Implicits: 0'])], [slot('Helmet', 1)], fake);
    expect(report).toEqual([]);
  });

  it('reports a slot pointing at an item that is not there', async () => {
    const { report } = await mapItems([], [slot('Helmet', 42)], fake);
    expect(report).toHaveLength(1);
    expect(report[0].message).toContain('Helmet');
  });
});

describe('mapItems — output', () => {
  it('maps weapon slots per the decode findings: Weapon 2 is the off-hand, Swap is set 2', async () => {
    const { value } = await mapItems(
      [rare(1, 'Plain Bow'), rare(2, 'Plain Shield')],
      [slot('Weapon 1', 1), slot('Weapon 2', 2), slot('Weapon 1 Swap', 1), slot('Weapon 2 Swap', 2)],
      fake,
    );
    expect(value.weapon1_main?.name).toBe('Plain Bow');
    expect(value.weapon1_off?.name).toBe('Plain Shield');
    expect(value.weapon2_main?.name).toBe('Plain Bow');
    expect(value.weapon2_off?.name).toBe('Plain Shield');
  });

  it('keeps a dual-wielded off-hand weapon now that the off-hand accepts one, but still drops a Wand there', async () => {
    const extra = [entry('Plain Dagger', 'Dagger'), entry('Plain Wand', 'Wand')];
    const lookup: ItemLookup = {
      ...fake,
      byName: new Map([...fake.byName, ...extra.map((i) => [i.name, i] as const)]),
      findBaseIn: () => null,
    };
    const { value, report } = await mapItems(
      [rare(1, 'Plain Dagger'), rare(2, 'Plain Wand')],
      [slot('Weapon 1', 1), slot('Weapon 2', 1), slot('Weapon 1 Swap', 2), slot('Weapon 2 Swap', 2)],
      lookup,
    );
    expect(value.weapon1_main?.name).toBe('Plain Dagger');
    expect(value.weapon1_off?.name).toBe('Plain Dagger');
    expect(value.weapon2_main?.name).toBe('Plain Wand');
    expect(value.weapon2_off).toBeNull();
    expect(report.filter((r) => r.kind === 'dropped').map((r) => r.message)).toEqual([
      expect.stringContaining('Plain Wand'),
    ]);
  });

  it('carries the icon the catalogue resolves, and state the write gate accepts unchanged', async () => {
    const { value } = await mapItems([rare(1, 'Plain Ring'), rare(2, 'Plain Charm')], [slot('Ring 1', 1), slot('Charm 2', 2)], fake);
    expect(value.ring1?.iconUrl).toBe('/data/wiki/2026-08-25/icons/items/plain-ring.png');
    expect(value.charm2?.name).toBe('Plain Charm');
    const gated = cleanGearStateInput(value);
    expect(gated.ok).toBe(true);
    if (gated.ok) expect(gated.value).toEqual(value);
  });
});

const sockets: JewelTreeLookup = { hasNode: (id) => id < 1000, isJewelSocket: (id) => id >= 100 && id < 1000 };

describe('mapJewels — every way it can go wrong', () => {
  it('keys a jewel by its socket node, as the editor stores it', async () => {
    const { value, report } = await mapJewels([{ nodeId: 101, itemId: 1 }], [rare(1, 'Plain Jewel')], fake, sockets);
    expect(Object.keys(value)).toEqual(['101']);
    expect(value['101'].name).toBe('Plain Jewel');
    expect(report).toEqual([]);
  });

  it('drops a jewel whose node is unknown or is not a socket, naming it', async () => {
    const { value, report } = await mapJewels(
      [
        { nodeId: 5000, itemId: 1 },
        { nodeId: 5, itemId: 1 },
      ],
      [rare(1, 'Plain Jewel')],
      fake,
      sockets,
    );
    expect(value).toEqual({});
    expect(report).toHaveLength(2);
    expect(report[0].message).toContain('5000');
    expect(report[1].message).toContain('Plain Jewel');
  });

  it('drops a socketed item that is not a jewel', async () => {
    const { value, report } = await mapJewels([{ nodeId: 101, itemId: 1 }], [rare(1, 'Plain Ring')], fake, sockets);
    expect(value).toEqual({});
    expect(report[0].message).toContain('Plain Ring');
  });

  it('reports what the jewel carried that is not kept, like any other item', async () => {
    const { report } = await mapJewels(
      [{ nodeId: 101, itemId: 1 }],
      [rare(1, 'Plain Jewel', ['Implicits: 0', '+8% to Something', '+4% to Else'])],
      fake,
      sockets,
    );
    expect(report).toHaveLength(1);
    expect(report[0].message).toContain('2 mod lines');
  });

  it('passes the write gate as gear_state.jewels', async () => {
    const { value } = await mapJewels([{ nodeId: 101, itemId: 1 }], [rare(1, 'Plain Jewel')], fake, sockets);
    const gated = cleanGearStateInput({ jewels: value });
    expect(gated.ok).toBe(true);
    if (gated.ok) expect(gated.value.jewels).toEqual(value);
  });
});

describe('mapItems — the real build against the real catalogue', async () => {
  const decoded = decodePobCode(readFileSync('src/lib/pob/__fixtures__/sample-pob2-code.txt', 'utf8'));
  if (!decoded.ok) throw new Error('fixture failed to decode');
  const parsed = parsePobXml(decoded.xml);
  if (!parsed.ok) throw new Error('fixture failed to parse');
  const { items, tree } = await getCatalogue();
  const { value, report } = await mapItems(parsed.build.items, parsed.build.slots, items);
  const lastSpec = parsed.build.specs[parsed.build.specs.length - 1];
  const jewels = await mapJewels(lastSpec.jewelSockets, parsed.build.items, items, tree);

  it('fills every occupied slot with the item the decode findings list', () => {
    // Verified 2026-09-24 against the fixture's <ItemSet> and item-index.json.
    // Ring 1 and Ring 2 both hold PoB item 10 in this export.
    const names = Object.fromEntries(
      Object.entries(value)
        .filter(([key, v]) => key !== 'jewels' && v !== null)
        .map(([key, v]) => [key, (v as { name: string }).name]),
    );
    expect(names).toEqual({
      head: 'Paragon Greathelm',
      body: 'Cloak of Flame',
      gloves: 'Blueflame Bracers',
      boots: 'Vaal Greaves',
      amulet: 'Stellar Amulet',
      ring1: 'Amethyst Ring',
      ring2: 'Amethyst Ring',
      belt: 'Fine Belt',
      weapon1_main: 'Siege Crossbow',
      flask1: 'Ultimate Life Flask',
      flask2: 'Ultimate Mana Flask',
      charm1: 'Golden Charm',
    });
  });

  it('marks the three magic bases as inferred, and loses no item outright', () => {
    expect(report.filter((r) => r.kind === 'inferred')).toHaveLength(3);
    // Every "dropped" entry is about details on an item that WAS imported.
    const dropped = report.filter((r) => r.kind === 'dropped');
    expect(dropped.every((r) => r.message.includes('not kept'))).toBe(true);
  });

  it("imports the last spec's Emerald into both of its sockets", () => {
    // Spec 8 sockets PoB item 4 (a rare Emerald) at nodes 26725 and 2491.
    expect(Object.keys(jewels.value).sort()).toEqual(['2491', '26725']);
    expect(Object.values(jewels.value).every((j) => j.name === 'Emerald')).toBe(true);
    expect(jewels.report.every((r) => r.message.includes('not kept'))).toBe(true);
  });

  it('passes the write gate unchanged', () => {
    const gated = cleanGearStateInput(value);
    expect(gated.ok).toBe(true);
    if (gated.ok) expect(gated.value).toEqual(value);
  });
});
