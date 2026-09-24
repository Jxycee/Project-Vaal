// src/lib/pob/catalogue.ts
// =============================================================================
// The PoB importer's view of OUR data: tree nodes and ascendancies, gems by
// their GGG id, items by name. The one place the importer touches
// public/data, built once per server process and cached.
//
// Server-only in practice: it reads the filesystem, so it cannot be bundled
// for the browser. (There is no `server-only` package in this project to
// enforce that, and adding a dependency for a guarantee node:fs already gives
// was not worth it.)
//
// Every lookup answers "not ours" as a clear miss — never a nearest match.
// Every icon URL it hands on starts with /data/wiki/, which is what the write
// gate (src/lib/build/stateInput.ts) requires.
// =============================================================================

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { GEAR_SLOTS, JEWEL_CATEGORIES, categoriesForSlot } from '@/lib/build/gearSlots';
import { TREE_VERSION } from '@/lib/tree/version';
import { loadAllSlugs, loadDetail } from '@/lib/wiki/load';
import { loadIndex } from '@/lib/wiki/loadIndex';
import type { WikiItemDetail, WikiSkillDetail } from '@/lib/wiki/types';

export interface CatalogueGem {
  slug: string;
  name: string;
  gemType: 'active' | 'support' | 'spirit';
  iconUrl: string | null;
}

export interface CatalogueItem {
  slug: string;
  name: string;
  category: string;
  isUnique: boolean;
}

export interface Catalogue {
  tree: {
    hasNode(id: number): boolean;
    /** The ascendancy a node belongs to (e.g. 'Mercenary2'), or null for a main-tree node or an unknown id. */
    ascendancyOf(id: number): string | null;
    /** Exact class and ascendancy display names -> our ascendancy id, or null. */
    ascendancyIdFor(className: string, ascendancyName: string): string | null;
  };
  /** Keyed by the gem's GGG id — the last segment of its metadata path, e.g. 'SkillGemIceNova'. */
  gems: Map<string, CatalogueGem>;
  items: {
    byName: Map<string, CatalogueItem>;
    /**
     * The longest non-unique base name found, as whole words, inside `text` —
     * for magic items, whose single name line carries affixes around the base
     * ("Saturated Ultimate Life Flask of the Ample"). Null when none fits.
     */
    findBaseIn(text: string): CatalogueItem | null;
    iconUrlFor(slug: string): Promise<string | null>;
  };
}

interface RawTreeNode {
  ascendancyId?: string;
}
interface RawTree {
  classes: Array<{ name: string; ascendancies?: Array<{ id: string; name: string }> }>;
  nodes: Record<string, RawTreeNode>;
}

/** Reading 1,118 detail files all at once can exhaust file handles on Windows; this bounds it. */
const READ_BATCH = 64;

async function buildTree(): Promise<Catalogue['tree']> {
  const file = path.join(process.cwd(), 'public', 'data', 'tree', TREE_VERSION, 'data.json');
  const raw = JSON.parse(await readFile(file, 'utf8')) as RawTree;

  // Node keys are GGG skill ids as strings; the tree also carries a 'root'
  // key, which is not a node anyone allocates.
  const ascendancyByNode = new Map<number, string | null>();
  for (const [key, node] of Object.entries(raw.nodes)) {
    if (!/^\d+$/.test(key)) continue;
    ascendancyByNode.set(Number(key), node.ascendancyId ?? null);
  }

  const ascendancyIds = new Map<string, string>();
  for (const cls of raw.classes) {
    for (const asc of cls.ascendancies ?? []) ascendancyIds.set(`${cls.name}\u0000${asc.name}`, asc.id);
  }

  return {
    hasNode: (id) => ascendancyByNode.has(id),
    ascendancyOf: (id) => ascendancyByNode.get(id) ?? null,
    ascendancyIdFor: (className, ascendancyName) => ascendancyIds.get(`${className}\u0000${ascendancyName}`) ?? null,
  };
}

async function buildGems(): Promise<Map<string, CatalogueGem>> {
  // gemId lives only in the detail files, not in skill-index.json, so they
  // are read once here.
  const slugs = await loadAllSlugs('skill');
  const gems = new Map<string, CatalogueGem>();
  for (let i = 0; i < slugs.length; i += READ_BATCH) {
    const details = await Promise.all(
      slugs.slice(i, i + READ_BATCH).map((slug) => loadDetail('skill', slug) as Promise<WikiSkillDetail | null>),
    );
    for (const detail of details) {
      if (!detail?.gemId || gems.has(detail.gemId)) continue;
      gems.set(detail.gemId, {
        slug: detail.slug,
        name: detail.name,
        gemType: detail.gemType,
        iconUrl: detail.iconUrl ?? null,
      });
    }
  }
  return gems;
}

function isWordChar(char: string | undefined): boolean {
  return char !== undefined && /[\p{L}\p{N}']/u.test(char);
}

async function buildItems(): Promise<Catalogue['items']> {
  const entries = await loadIndex('item');
  const byName = new Map<string, CatalogueItem>();
  for (const entry of entries) {
    if (byName.has(entry.name)) continue;
    byName.set(entry.name, {
      slug: entry.slug,
      name: entry.name,
      category: entry.category,
      isUnique: entry.isUniqueItem,
    });
  }

  // Bases are the non-unique items of the categories a gear slot or jewel
  // socket can hold. Uniques are never bases, so a unique's name wrapped in
  // affixes is never mistaken for one.
  const baseCategories = new Set<string>([...GEAR_SLOTS.flatMap((slot) => [...categoriesForSlot(slot)]), ...JEWEL_CATEGORIES]);
  const basesLongestFirst = [...byName.values()]
    .filter((item) => !item.isUnique && baseCategories.has(item.category))
    .sort((a, b) => b.name.length - a.name.length);

  return {
    byName,
    findBaseIn(text) {
      for (const base of basesLongestFirst) {
        let from = 0;
        for (;;) {
          const at = text.indexOf(base.name, from);
          if (at === -1) break;
          // Whole words only: "Ring" must not match inside "Ringmail".
          if (!isWordChar(text[at - 1]) && !isWordChar(text[at + base.name.length])) return base;
          from = at + 1;
        }
      }
      return null;
    },
    async iconUrlFor(slug) {
      const detail = (await loadDetail('item', slug)) as WikiItemDetail | null;
      return detail?.iconUrl ?? null;
    },
  };
}

let cached: Promise<Catalogue> | null = null;

/**
 * Built on first use and shared thereafter. A failed build is not cached, so a
 * transient read error does not poison every later import.
 */
export function getCatalogue(): Promise<Catalogue> {
  if (!cached) {
    cached = Promise.all([buildTree(), buildGems(), buildItems()])
      .then(([tree, gems, items]) => ({ tree, gems, items }))
      .catch((error: unknown) => {
        cached = null;
        throw error;
      });
  }
  return cached;
}
