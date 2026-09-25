// src/lib/pob/mapItems.ts
// =============================================================================
// PoB's equipped items -> our GearState, plus what could not come across.
//
// Pure apart from the icon lookup the catalogue answers. The rules, each
// verified against a real export (see the Slice 2 plan and
// docs/superpowers/specs/2026-09-23-pob2-decode-findings.md):
//
// - An item is PoE clipboard text. Line 1 is "Rarity: X". UNIQUE: line 2 is
//   the unique's name, line 3 its base. RARE: line 2 is a name the player
//   gave it, line 3 the base. MAGIC: line 2 is the whole affixed name
//   ("Saturated Ultimate Life Flask of the Ample") and line 3 is not a base,
//   so the base is read out of the name — and reported as inferred.
// - Items join on name. An unknown unique falls back to its base, reported.
// - Slots map by name per the decode findings' table. Flasks map by what the
//   item is, not by PoB's slot number: our flask1 is Life, flask2 is Mana.
//   Ring 3, a second flask of one kind, and any slot name we do not know are
//   reported, never forced into a wrong slot.
// - We store the base item only. Rolled mods, runes, quality and a unique's
//   selected variant are counted per item and reported — reading them is
//   ModParser's job, and belongs to a later slice.
// - Jewels (mapJewels) follow the same item rules, keyed by socket node id.
//   PoB sockets jewels per spec while gear is shared, so mapBuild takes them
//   from one spec and says so.
// =============================================================================

import { categoriesForSlot, GEAR_SLOT_LABELS, JEWEL_CATEGORIES, type GearItem, type GearSlot } from '@/lib/build/gearSlots';
import { emptyGearState, type GearState } from '@/lib/build/gearState';
import type { Catalogue, CatalogueItem } from './catalogue';
import type { PobItem, PobSlot } from './parse';
import type { ReportEntry } from './report';

export type ItemLookup = Catalogue['items'];
export type JewelTreeLookup = Pick<Catalogue['tree'], 'hasNode' | 'isJewelSocket'>;

/** PoB slot name -> ours, in the order PoB lists them; a flask slot is resolved by the item instead. */
const SLOT_BY_POB_NAME: Record<string, GearSlot | 'flask'> = {
  'Weapon 1': 'weapon1_main',
  'Weapon 2': 'weapon1_off',
  'Weapon 1 Swap': 'weapon2_main',
  'Weapon 2 Swap': 'weapon2_off',
  Helmet: 'head',
  'Body Armour': 'body',
  Gloves: 'gloves',
  Boots: 'boots',
  Amulet: 'amulet',
  'Ring 1': 'ring1',
  'Ring 2': 'ring2',
  Belt: 'belt',
  'Flask 1': 'flask',
  'Flask 2': 'flask',
  'Charm 1': 'charm1',
  'Charm 2': 'charm2',
  'Charm 3': 'charm3',
};
const POB_SLOT_ORDER = Object.keys(SLOT_BY_POB_NAME);

interface ReadItem {
  rarity: string;
  /** Lines 2 and 3 of the clipboard text, without the rarity line. */
  line2: string | undefined;
  line3: string | undefined;
  modLines: number;
  runes: number;
  quality: number;
  hasSelectedVariant: boolean;
}

function readItem(raw: string): ReadItem | null {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rarity = /^Rarity: (\w+)$/.exec(lines[0] ?? '')?.[1];
  if (!rarity) return null;

  // Everything after the "Implicits: N" line is a mod line — implicits,
  // enchants, rune effects and explicit mods alike.
  const implicitsAt = lines.findIndex((line) => /^Implicits: \d+$/.test(line));
  const quality = Number(/^Quality: (\d+)$/.exec(lines.find((line) => line.startsWith('Quality: ')) ?? '')?.[1] ?? 0);
  return {
    rarity,
    line2: lines[1],
    line3: lines[2],
    modLines: implicitsAt === -1 ? 0 : lines.length - implicitsAt - 1,
    runes: lines.filter((line) => line.startsWith('Rune: ')).length,
    quality,
    hasSelectedVariant: lines.some((line) => line.startsWith('Selected Variant: ')),
  };
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function dropped(message: string): ReportEntry {
  return { kind: 'dropped', area: 'items', message };
}

type Resolved = { found: CatalogueItem; displayName: string; note: ReportEntry | null } | { found: null; reason: string };

function resolve(read: ReadItem, items: ItemLookup): Resolved {
  const baseByName = (name: string | undefined) => {
    const found = name ? items.byName.get(name) : undefined;
    return found && !found.isUnique ? found : null;
  };

  switch (read.rarity) {
    case 'UNIQUE': {
      const unique = read.line2 ? items.byName.get(read.line2) : undefined;
      if (unique?.isUnique) return { found: unique, displayName: unique.name, note: null };
      const base = baseByName(read.line3);
      if (!base) return { found: null, reason: `The unique ${read.line2 ?? '(unnamed)'} and its base are not in this patch's item data` };
      return {
        found: base,
        displayName: base.name,
        note: dropped(`The unique ${read.line2} is not in this patch's item data, so its base, ${base.name}, was imported instead.`),
      };
    }
    case 'RARE':
    case 'NORMAL': {
      // A rare's line 2 is the player's own name for it; a normal item may
      // carry its base there instead.
      const base = read.rarity === 'RARE' ? baseByName(read.line3) : (baseByName(read.line2) ?? baseByName(read.line3));
      if (!base) return { found: null, reason: `${read.line3 ?? read.line2 ?? 'An item'} is not in this patch's item data` };
      return { found: base, displayName: base.name, note: null };
    }
    case 'MAGIC': {
      const base = read.line2 ? items.findBaseIn(read.line2) : null;
      if (!base) return { found: null, reason: `No known base item could be found in the name ${read.line2 ?? '(unnamed)'}` };
      return {
        found: base,
        displayName: read.line2!,
        note: {
          kind: 'inferred',
          area: 'items',
          message: `${read.line2} was imported as ${base.name}, read from its name — a magic item's name wraps its base in affixes.`,
        },
      };
    }
    default:
      return { found: null, reason: `An item of rarity ${read.rarity} could not be read` };
  }
}

async function toGearItem(found: CatalogueItem, items: ItemLookup): Promise<GearItem> {
  return {
    slug: found.slug,
    name: found.name,
    category: found.category,
    isUnique: found.isUnique,
    iconUrl: await items.iconUrlFor(found.slug),
  };
}

function reportLostDetails(read: ReadItem, displayName: string, where: string, report: ReportEntry[]): void {
  const lost = lostDetails(read);
  if (lost.length > 0) {
    report.push(dropped(`${displayName} (${where}): ${lost.join(', ')} not kept — Project Vaal stores the base item only for now.`));
  }
}

function lostDetails(read: ReadItem): string[] {
  const lost: string[] = [];
  if (read.modLines > 0) lost.push(plural(read.modLines, 'mod line'));
  if (read.runes > 0) lost.push(plural(read.runes, 'rune'));
  if (read.quality > 0) lost.push(`${read.quality}% quality`);
  if (read.hasSelectedVariant) lost.push('its selected variant');
  return lost;
}

export async function mapItems(
  pobItems: PobItem[],
  pobSlots: PobSlot[],
  items: ItemLookup,
): Promise<{ value: GearState; report: ReportEntry[] }> {
  const value = emptyGearState();
  const report: ReportEntry[] = [];
  const itemsById = new Map(pobItems.map((item) => [item.id, item]));

  const orderOf = (name: string) => {
    const at = POB_SLOT_ORDER.indexOf(name);
    return at === -1 ? POB_SLOT_ORDER.length : at;
  };
  const slots = [...pobSlots].sort((a, b) => orderOf(a.name) - orderOf(b.name) || a.name.localeCompare(b.name));

  for (const pobSlot of slots) {
    const pobItem = itemsById.get(pobSlot.itemId);
    if (!pobItem) {
      report.push(dropped(`Path of Building's ${pobSlot.name} slot points at an item that is not in the export, so it was left empty.`));
      continue;
    }
    const read = readItem(pobItem.raw);
    if (!read) {
      report.push(dropped(`The item in ${pobSlot.name} could not be read (it has no rarity line) and was left out.`));
      continue;
    }

    const resolved = resolve(read, items);
    if (!resolved.found) {
      report.push(dropped(`${resolved.reason}, so ${pobSlot.name} was left empty.`));
      continue;
    }
    const { found, displayName } = resolved;

    const mapped = SLOT_BY_POB_NAME[pobSlot.name];
    if (!mapped) {
      const why = pobSlot.name === 'Ring 3' ? 'Project Vaal has two ring slots' : 'Project Vaal has no such slot';
      report.push(dropped(`${displayName} in Path of Building's ${pobSlot.name} was left out — ${why}.`));
      continue;
    }

    let slot: GearSlot | null = mapped === 'flask' ? null : mapped;
    if (mapped === 'flask') {
      slot = categoriesForSlot('flask1').includes(found.category)
        ? 'flask1'
        : categoriesForSlot('flask2').includes(found.category)
          ? 'flask2'
          : null;
    }
    if (!slot || !categoriesForSlot(slot).includes(found.category)) {
      report.push(dropped(`${displayName} (${found.category}) cannot go in ${pobSlot.name} here, so it was left out.`));
      continue;
    }
    if (value[slot] !== null) {
      report.push(
        dropped(`${displayName} was left out — Project Vaal has one ${GEAR_SLOT_LABELS[slot]} slot, and it already holds ${value[slot]!.name}.`),
      );
      continue;
    }

    value[slot] = await toGearItem(found, items);
    if (resolved.note) report.push(resolved.note);
    reportLostDetails(read, displayName, GEAR_SLOT_LABELS[slot], report);
  }

  return { value, report };
}

/**
 * One spec's socketed jewels -> gear_state.jewels, keyed by socket node id as
 * the editor stores them. The same item rules as gear; a socket our tree does
 * not know, or holds something that is not a jewel, is reported.
 */
export async function mapJewels(
  sockets: Array<{ nodeId: number; itemId: number }>,
  pobItems: PobItem[],
  items: ItemLookup,
  tree: JewelTreeLookup,
): Promise<{ value: Record<string, GearItem>; report: ReportEntry[] }> {
  const value: Record<string, GearItem> = {};
  const report: ReportEntry[] = [];
  const itemsById = new Map(pobItems.map((item) => [item.id, item]));

  for (const { nodeId, itemId } of sockets) {
    const where = `jewel socket ${nodeId}`;
    const pobItem = itemsById.get(itemId);
    const read = pobItem ? readItem(pobItem.raw) : null;
    if (!read) {
      report.push(dropped(`The jewel in ${where} is missing from the export or could not be read, and was left out.`));
      continue;
    }
    const resolved = resolve(read, items);
    if (!resolved.found) {
      report.push(dropped(`${resolved.reason}, so ${where} was left empty.`));
      continue;
    }
    const { found, displayName } = resolved;
    if (!tree.hasNode(nodeId) || !tree.isJewelSocket(nodeId)) {
      report.push(dropped(`${displayName} was left out — node ${nodeId} is not a jewel socket in this patch's tree.`));
      continue;
    }
    if (!(JEWEL_CATEGORIES as readonly string[]).includes(found.category)) {
      report.push(dropped(`${displayName} (${found.category}) is not a jewel, so ${where} was left empty.`));
      continue;
    }

    value[String(nodeId)] = await toGearItem(found, items);
    if (resolved.note) report.push(resolved.note);
    reportLostDetails(read, displayName, where, report);
  }

  return { value, report };
}
