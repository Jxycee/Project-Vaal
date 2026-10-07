// src/lib/pob/export/exportItems.ts
// =============================================================================
// One of our items -> the clipboard text PoB2 stores in <Item>.
//
// The layout is PoB2's own ItemClass:BuildRaw (src/Classes/Item.lua) as read
// on 2026-10-06, and matches the real exports in src/lib/pob/__fixtures__ and
// docs/superpowers/handoffs: "Rarity", the name line(s), "Item Level",
// "Quality", "Sockets" + "Rune: name" per rune, "Implicits: N", the implicit
// lines, then every explicit line.
//
// DISPLAY lines, not the crafted "Prefix: {range}ModId" form. Our mod slugs
// are lowercased and PoB2 looks a mod id up case-sensitively, so a crafted
// header could not be written faithfully; display text is what PoB2 reads for
// any pasted item. PoB2 rebuilds an item's rune effects itself from its
// "Rune:" names when each is a known rune (Item.lua ParseRaw: canRebuildRunes
// -> UpdateRunes), so rune effect lines are not written.
//
// A mod whose display ranges are not its roll ranges (crit: "(3-4)%" over
// rolls 311-380) cannot show a stored roll, so it is written at its best
// display value and reported — the same reading the importer applies.
// =============================================================================

import { emptyCraft, rangesIn } from '@/lib/build/craft';
import type { GearItem } from '@/lib/build/gearSlots';
import { loadDetail } from '@/lib/wiki/load';
import { getModCatalogue, type ModCatalogue } from '@/lib/wiki/modCatalogue';
import type { WikiItemDetail } from '@/lib/wiki/types';
import { sameUnits } from '../mapCraft';
import type { ReportEntry } from '../report';
import { renderLine } from './renderLine';

type CatalogueMod = ModCatalogue['mods'][number];

const modIndexes = new WeakMap<ModCatalogue, Map<string, CatalogueMod>>();
async function modBySlug(slug: string): Promise<CatalogueMod | undefined> {
  const catalogue = await getModCatalogue();
  let index = modIndexes.get(catalogue);
  if (!index) {
    index = new Map(catalogue.mods.map((m) => [m.slug, m]));
    modIndexes.set(catalogue, index);
  }
  return index.get(slug);
}

/**
 * The values a base or unique line is written at. A row the player never set is
 * read by the engine at each range's midpoint (collect.ts, implicits.ts), so it
 * is written there too: writing the best roll would move the sheet.
 */
function rowValues(template: string, row: readonly number[] | undefined): number[] {
  return rangesIn(template).map((r, i) => row?.[i] ?? (r.min + r.max) / 2);
}

const entry = (kind: ReportEntry['kind'], message: string): ReportEntry => ({ kind, area: 'items', message });

/** A mod's display lines, filled from its stored values. */
function modLines(mod: CatalogueMod, values: readonly number[], label: string, report: ReportEntry[]): string[] {
  if (sameUnits({ rolls: mod.rolls, stats: mod.stats, slug: mod.slug, kind: mod.kind })) {
    let at = 0;
    return mod.stats.map((template) => {
      const n = rangesIn(template).length;
      const line = renderLine(template, values.slice(at, at + n));
      at += n;
      return line;
    });
  }
  report.push(
    entry('inferred', `${label}: "${mod.stats.join(' / ')}" shows a different range than it rolls, so it was written at its best value.`),
  );
  return mod.stats.map((template) => renderLine(template, []));
}

export async function itemText(item: GearItem, where: string, report: ReportEntry[]): Promise<string> {
  const detail = (await loadDetail('item', item.slug)) as WikiItemDetail | null;
  const craft = item.craft ?? emptyCraft(item.isUnique);
  const rarity = item.isUnique ? 'unique' : craft.rarity;
  const label = `${item.name} (${where})`;
  if (!detail) report.push(entry('dropped', `${label} is not in this patch's item data, so only its name was written.`));

  const lines: string[] = [`Rarity: ${rarity.toUpperCase()}`];
  if (rarity === 'unique') {
    lines.push(item.name, detail?.uniqueMods?.baseType ?? item.name);
  } else if (rarity === 'rare') {
    lines.push(craft.name || 'New Item', item.name);
  } else if (rarity === 'magic') {
    lines.push(craft.name || item.name);
  } else {
    lines.push(item.name);
  }
  if (craft.itemLevel !== null) lines.push(`Item Level: ${craft.itemLevel}`);
  if (craft.quality > 0) lines.push(`Quality: ${craft.quality}`);

  const runeNames: string[] = [];
  for (const slug of craft.runes) {
    const rune = (await loadDetail('item', slug)) as WikiItemDetail | null;
    if (rune) runeNames.push(rune.name);
    else report.push(entry('dropped', `${label}: a rune (${slug}) is not in this patch's item data and was left out.`));
  }
  if (runeNames.length > 0) {
    lines.push(`Sockets: ${runeNames.map(() => 'S').join(' ')}`);
    for (const name of runeNames) lines.push(`Rune: ${name}`);
  }

  const implicits = (detail?.implicitMods ?? []).map((template, i) => renderLine(template, rowValues(template, craft.implicitValues[i])));
  lines.push(`Implicits: ${implicits.length}`, ...implicits);

  if (rarity === 'unique') {
    (detail?.uniqueMods?.explicitMods ?? []).forEach((template, i) => lines.push(renderLine(template, rowValues(template, craft.uniqueValues[i]))));
  }
  for (const crafted of [...craft.prefixes, ...craft.suffixes]) {
    const mod = await modBySlug(crafted.slug);
    if (!mod) {
      report.push(entry('dropped', `${label}: the mod ${crafted.slug} is not in this patch's data and was left out.`));
      continue;
    }
    lines.push(...modLines(mod, crafted.values, label, report));
  }
  if (craft.corrupted) lines.push('Corrupted');
  return lines.join('\n');
}
