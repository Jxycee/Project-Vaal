// src/lib/wiki/modCatalogue.ts
// =============================================================================
// Which prefixes and suffixes can spawn on one base — the item editor's mod
// picker (Slice 4, plans/2026-09-25-slice4-item-affixes.md).
//
// Eligibility is PoB2's first-match rule (src/Classes/Item.lua,
// ItemClass:GetModSpawnWeight): walk a mod's spawnWeights in order; the FIRST
// tag the base carries decides, and weight 0 excludes. On our data that rule
// reproduces PoB2's own eligible counts exactly on five real bases (pinned in
// modCatalogue.test.ts). A mod must also share the base's `modDomain` — the
// domain labels are PoE1-looking enum names, but items and mods use the same
// table, so the join is consistent (jewels, for one, sit under "Atlas").
//
// Server-only in practice (node:fs), the same as src/lib/pob/catalogue.ts. It
// reads public/data at request time, so its files are listed under
// outputFileTracingIncludes in next.config.ts — the tracer does not find them
// on its own (it missed the PoB catalogue in Slice 2 while the build stayed
// green).
// =============================================================================

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { canSpawn } from './spawn';
import { WIKI_DATA_VERSION } from './types';

const ROOT = path.join(process.cwd(), 'public', 'data', 'wiki', WIKI_DATA_VERSION);

/** Item slugs as the sync writes them. Checked BEFORE a path is built, so no input can leave items/. */
const ITEM_SLUG_RE = /^[a-z0-9-]{1,120}$/;

export type AffixKind = 'prefix' | 'suffix';

export interface ModRoll {
  stat: string;
  min: number;
  max: number;
}

export interface ModTier {
  slug: string;
  tier: number;
  /** Item level the tier needs. */
  level: number;
  /** Display lines, e.g. "Adds (1-2) to (3-5) Cold damage to Attacks". */
  stats: string[];
  rolls: ModRoll[];
}

export interface ModGroup {
  group: string;
  tiers: ModTier[];
}

interface CatalogueMod extends ModTier {
  kind: AffixKind;
  domain: string;
  group: string;
  spawnWeights: { tag: string; weight: number }[];
}

export interface ModCatalogue {
  mods: CatalogueMod[];
}

const READ_BATCH = 256; // bounded, so thousands of small files never exhaust file handles

async function readJsonFiles(dir: string): Promise<unknown[]> {
  const names = (await readdir(dir)).filter((n) => n.endsWith('.json'));
  const out: unknown[] = [];
  for (let i = 0; i < names.length; i += READ_BATCH) {
    const batch = names.slice(i, i + READ_BATCH);
    out.push(...(await Promise.all(batch.map(async (n) => JSON.parse(await readFile(path.join(dir, n), 'utf8')) as unknown))));
  }
  return out;
}

function toCatalogueMod(raw: unknown): CatalogueMod | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;
  const kind = m.generationType === 'Prefix' ? 'prefix' : m.generationType === 'Suffix' ? 'suffix' : null;
  if (!kind || typeof m.slug !== 'string' || typeof m.domain !== 'string' || typeof m.group !== 'string') return null;
  return {
    kind,
    slug: m.slug,
    domain: m.domain,
    group: m.group,
    tier: typeof m.tier === 'number' ? m.tier : 0,
    level: typeof m.level === 'number' ? m.level : 0,
    stats: Array.isArray(m.stats) ? m.stats.filter((s): s is string => typeof s === 'string') : [],
    rolls: Array.isArray(m.rolls) ? (m.rolls as ModRoll[]) : [],
    spawnWeights: Array.isArray(m.spawnWeights) ? (m.spawnWeights as CatalogueMod['spawnWeights']) : [],
  };
}

let cached: Promise<ModCatalogue> | null = null;

/** Built on first use and shared thereafter. A failed build is not cached, so a transient fs error can recover. */
export function getModCatalogue(): Promise<ModCatalogue> {
  if (!cached) {
    cached = readJsonFiles(path.join(ROOT, 'mods'))
      .then((all) => ({ mods: all.map(toCatalogueMod).filter((m): m is CatalogueMod => m !== null) }))
      .catch((err: unknown) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}

/**
 * The prefixes or suffixes that can spawn on one base, grouped (one mod per
 * group is the game's rule), tiers ordered by required level. `null` for a
 * slug that is malformed or names no item; `[]` for a unique, whose mods are
 * fixed.
 */
export async function eligibleMods(itemSlug: string, kind: AffixKind): Promise<ModGroup[] | null> {
  if (!ITEM_SLUG_RE.test(itemSlug)) return null;
  let item: { rarity?: unknown; modDomain?: unknown; tags?: unknown };
  try {
    item = JSON.parse(await readFile(path.join(ROOT, 'items', `${itemSlug}.json`), 'utf8'));
  } catch {
    return null;
  }
  if (item.rarity === 'unique') return [];
  const tags = new Set(Array.isArray(item.tags) ? item.tags.filter((t): t is string => typeof t === 'string') : []);
  const domain = item.modDomain;

  const { mods } = await getModCatalogue();
  const byGroup = new Map<string, ModTier[]>();
  for (const mod of mods) {
    if (mod.kind !== kind || mod.domain !== domain || !canSpawn(mod.spawnWeights, tags)) continue;
    const tiers = byGroup.get(mod.group) ?? [];
    tiers.push({ slug: mod.slug, tier: mod.tier, level: mod.level, stats: mod.stats, rolls: mod.rolls });
    byGroup.set(mod.group, tiers);
  }
  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, tiers]) => ({ group, tiers: tiers.sort((a, b) => a.level - b.level || a.tier - b.tier) }));
}
