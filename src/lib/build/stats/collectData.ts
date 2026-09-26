// src/lib/build/stats/collectData.ts
// =============================================================================
// Raw data files -> the lookups collect.ts reads. Pure: the caller loads the
// files (the browser by fetch, tests and scripts from disk) and passes them in.
//
//   tree          public/data/tree/<v>/data.json          names, isGenericAttribute
//   nodeStats     public/data/tree/<v>/node-stats.json    typed node stats
//   implicitStats public/data/wiki/<v>/implicit-stats.json
//   uniqueStats   public/data/wiki/<v>/unique-stats.json
//   items, mods   item and mod detail files by slug — only the ones in use
//
// Anything absent or malformed reads as undefined ("unknown"), never a guess;
// the collector names what it could not count.
// =============================================================================

import type { CollectData } from './collect';

export interface RawCollectFiles {
  tree: { nodes: Record<string, { name?: string; isGenericAttribute?: boolean }> };
  nodeStats: { nodes: Record<string, [string, number][]> };
  implicitStats: { bases: Record<string, [string, number, number][][]> };
  uniqueStats: { uniques: Record<string, { baseType: string; lines: (string[] | null)[] }> };
  /** Item detail files by slug (base items and uniques in use, and unique bases). */
  items: ReadonlyMap<string, unknown>;
  /** Mod detail files by slug (the affixes in use). */
  mods: ReadonlyMap<string, unknown>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The slug of the item file whose name is `name`; how a unique reaches its base, which it names. */
function slugOfName(items: ReadonlyMap<string, unknown>, name: string): string | undefined {
  for (const [slug, detail] of items) if (isObject(detail) && detail.name === name) return slug;
  return undefined;
}

export function makeCollectData(files: RawCollectFiles): CollectData {
  return {
    node(id) {
      const typed = files.nodeStats.nodes[String(id)];
      const node = files.tree.nodes[String(id)];
      if (!typed || !node) return undefined;
      return { name: node.name ?? '', stats: typed, attribute: Boolean(node.isGenericAttribute) };
    },
    item(slug) {
      const detail = files.items.get(slug);
      if (!isObject(detail) || typeof detail.name !== 'string') return undefined;
      const a = isObject(detail.armour) ? detail.armour : null;
      return {
        armour: a ? { armour: num(a.armour), evasion: num(a.evasion), energyShield: num(a.energyShield) } : null,
        spirit: num(detail.spirit),
        implicits: files.implicitStats.bases[detail.name],
      };
    },
    mod(slug) {
      const detail = files.mods.get(slug);
      if (!isObject(detail) || !Array.isArray(detail.rolls)) return undefined;
      return detail.rolls.filter(
        (r): r is { stat: string; min: number; max: number } => isObject(r) && typeof r.stat === 'string' && typeof r.min === 'number' && typeof r.max === 'number',
      );
    },
    unique(name) {
      const typed = files.uniqueStats.uniques[name];
      const detail = files.items.get(slugOfName(files.items, name) ?? '');
      const baseSlug = typed ? slugOfName(files.items, typed.baseType) : undefined;
      if (!typed || !isObject(detail) || !baseSlug) return undefined;
      const texts = isObject(detail.uniqueMods) && Array.isArray(detail.uniqueMods.explicitMods) ? (detail.uniqueMods.explicitMods as unknown[]) : [];
      return {
        baseSlug,
        lines: texts.map((text, i) => ({ text: String(text), stats: typed.lines[i] ?? null })),
      };
    },
  };
}
