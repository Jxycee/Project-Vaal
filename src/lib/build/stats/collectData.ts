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

import { projectJewelRadius, type JewelRadiusNode } from '@/lib/tree/treeLite';
import movementPenalties from '@/lib/pob/data/base-movement-penalty.json';
import baseDefences from '@/lib/pob/data/base-defences.json';
import type { CollectData } from './collect';

export interface RawCollectFiles {
  /**
   * The tree: names and flags for every reader. `jewelRadius` (lite.json) or, on the full export, node x/y with
   * the type flags, say which notables and smalls sit near each jewel socket.
   */
  tree: {
    nodes: Record<string, { name?: string; isGenericAttribute?: boolean; isNotable?: boolean; isKeystone?: boolean; isMastery?: boolean; isJewelSocket?: boolean }>;
    jewelSlots?: (string | number)[];
    jewelRadius?: Record<string, JewelRadiusNode[]>;
    /** lite.json: the ids that are not plain small passives (treeLite.ts). The full export says it per node instead. */
    notSmall?: number[];
  };
  nodeStats: { nodes: Record<string, [string, number][]> };
  implicitStats: { bases: Record<string, [string, number, number][][]> };
  uniqueStats: { uniques: Record<string, { baseType: string; baseSlug: string | null; lines: (string[] | null)[] }> };
  /** Item detail files by slug: the items in use, and each worn unique's base (unique-stats' baseSlug). */
  items: ReadonlyMap<string, unknown>;
  /** Mod detail files by slug (the affixes in use). */
  mods: ReadonlyMap<string, unknown>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

function pobDefences(name: string, wiki: Record<string, unknown>): { armour: number; evasion: number; energyShield: number; ward: number } {
  const pob = (baseDefences as unknown as Record<string, [number, number, number, number]>)[name];
  if (pob) return { armour: pob[0], evasion: pob[1], energyShield: pob[2], ward: pob[3] };
  return { armour: num(wiki.armour), evasion: num(wiki.evasion), energyShield: num(wiki.energyShield), ward: num(wiki.ward) };
}

export function makeCollectData(files: RawCollectFiles): CollectData {
  /** Name -> id for passives that carry typed stats and whose name nothing else shares. Built on first use. */
  let byName: Map<string, number> | undefined;
  /** Near-socket passives: the lite file's table, else derived from the full export's coordinates, else unknown. */
  let radius: Record<string, JewelRadiusNode[]> | null | undefined = files.tree.jewelRadius;
  const notSmall = files.tree.notSmall ? new Set(files.tree.notSmall) : undefined;
  const full = Object.values(files.tree.nodes).some((n) => n.isNotable !== undefined || n.isKeystone !== undefined || n.isMastery !== undefined);
  return {
    radiusNodes(socket) {
      if (radius === undefined) {
        const positioned = Object.values(files.tree.nodes).some((n) => typeof (n as { x?: unknown }).x === 'number');
        radius = positioned ? projectJewelRadius(files.tree.nodes) : null;
      }
      return radius?.[String(socket)];
    },
    sinisterSockets() {
      // Voices' sockets are the tree's jewelSlots whose node is a "Sinister Jewel Socket", in slot order (slot1 first).
      return (files.tree.jewelSlots ?? []).map(Number).filter((id) => files.tree.nodes[String(id)]?.name?.includes('SinisterJewelSockets'));
    },
    nodeByName(name) {
      if (!byName) {
        byName = new Map();
        const taken = new Set<string>();
        for (const [id, node] of Object.entries(files.tree.nodes)) {
          if (!node.name || !files.nodeStats.nodes[id]) continue;
          if (byName.has(node.name) || taken.has(node.name)) {
            byName.delete(node.name);
            taken.add(node.name);
          } else byName.set(node.name, Number(id));
        }
      }
      return byName.get(name);
    },
    node(id) {
      const typed = files.nodeStats.nodes[String(id)];
      const node = files.tree.nodes[String(id)];
      if (!typed || !node) return undefined;
      // Plain small = what "increased effect of Small Passive Skills" scales; undefined = this tree file cannot say.
      const small = notSmall ? !notSmall.has(id) : full ? !(node.isNotable || node.isKeystone || node.isMastery || node.isJewelSocket) : undefined;
      return { name: node.name ?? '', stats: typed, attribute: Boolean(node.isGenericAttribute), ...(small === undefined ? {} : { small }) };
    },
    item(slug) {
      const detail = files.items.get(slug);
      if (!isObject(detail) || typeof detail.name !== 'string') return undefined;
      const a = isObject(detail.armour) ? detail.armour : null;
      return {
        // PoB's base defences beat the wiki's where it has the base (they differ on a dozen Runeforged / Runemastered bases).
        armour: a ? pobDefences(detail.name, a) : null,
        movementPenalty: (movementPenalties as Record<string, number>)[detail.name] ?? 0,
        spirit: num(detail.spirit),
        strRequirement: isObject(detail.requirements) ? num(detail.requirements.strength) : 0,
        itemClass: typeof detail.itemClass === 'string' ? detail.itemClass : null,
        weapon: isObject(detail.weapon),
        implicits: files.implicitStats.bases[detail.name],
        implicitLines: strings(detail.implicitMods),
      };
    },
    rune(slug) {
      const detail = files.items.get(slug);
      if (!isObject(detail) || typeof detail.name !== 'string' || !Array.isArray(detail.soulCoreEffects)) return undefined;
      const effects = detail.soulCoreEffects
        .filter((e): e is { category: string; lines: unknown } => isObject(e) && typeof e.category === 'string')
        .map((e) => ({ category: e.category, lines: strings(e.lines) }));
      return { name: detail.name, effects };
    },
    mod(slug) {
      const detail = files.mods.get(slug);
      if (!isObject(detail) || !Array.isArray(detail.rolls)) return undefined;
      return detail.rolls.filter(
        (r): r is { stat: string; min: number; max: number } => isObject(r) && typeof r.stat === 'string' && typeof r.min === 'number' && typeof r.max === 'number',
      );
    },
    unique(name, slug) {
      const typed = files.uniqueStats.uniques[name];
      const detail = files.items.get(slug);
      const baseSlug = typed?.baseSlug;
      if (!typed || !isObject(detail) || !baseSlug) return undefined;
      const texts = isObject(detail.uniqueMods) && Array.isArray(detail.uniqueMods.explicitMods) ? (detail.uniqueMods.explicitMods as unknown[]) : [];
      return {
        baseSlug,
        lines: texts.map((text, i) => ({ text: String(text), stats: typed.lines[i] ?? null })),
        implicitLines: strings(detail.implicitMods),
      };
    },
  };
}
