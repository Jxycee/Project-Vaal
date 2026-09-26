// src/lib/wiki/fetchCraftData.ts
// =============================================================================
// Client-side lookups the craft validator (src/lib/build/validate/affixRules.ts)
// and the item editor need: one mod, one base, whether a slug is a rune.
// Same static paths as fetchGemScaling.ts (/data/wiki/<version>/…, auth-gated
// by proxy.ts), same rule: a fetch that fails reads as "no data" and is not
// cached, so a transient error can recover; a file that exists but is
// unusable reads as null — "does not exist" — never a half-filled record.
// =============================================================================

import type { BaseData, ModData } from '@/lib/build/validate/affixRules';
import { WIKI_DATA_VERSION } from './types';

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []);

export function extractModData(raw: unknown): ModData | null {
  if (!isObject(raw) || typeof raw.group !== 'string' || typeof raw.domain !== 'string') return null;
  const kind = raw.generationType === 'Prefix' ? 'prefix' : raw.generationType === 'Suffix' ? 'suffix' : 'other';
  const rolls = (Array.isArray(raw.rolls) ? raw.rolls : [])
    .filter((r): r is { min: number; max: number } => isObject(r) && isFiniteNumber(r.min) && isFiniteNumber(r.max))
    .map((r) => ({ min: r.min, max: r.max }));
  const spawnWeights = (Array.isArray(raw.spawnWeights) ? raw.spawnWeights : [])
    .filter((w): w is { tag: string; weight: number } => isObject(w) && typeof w.tag === 'string' && isFiniteNumber(w.weight))
    .map((w) => ({ tag: w.tag, weight: w.weight }));
  return { kind, group: raw.group, level: isFiniteNumber(raw.level) ? raw.level : 0, domain: raw.domain, rolls, spawnWeights, stats: strings(raw.stats) };
}

export function extractBaseData(raw: unknown): BaseData | null {
  if (!isObject(raw)) return null;
  const unique = isObject(raw.uniqueMods) ? raw.uniqueMods : {};
  return {
    tags: strings(raw.tags),
    modDomain: typeof raw.modDomain === 'string' ? raw.modDomain : null,
    implicitLines: strings(raw.implicitMods),
    uniqueLines: strings(unique.explicitMods),
  };
}

export function extractIsRune(raw: unknown): boolean {
  return isObject(raw) && raw.category === 'SoulCore';
}

/** `undefined` = the request failed (not cached, may be retried); otherwise the parsed JSON, or null for a 404. */
async function fetchDetail(kind: 'mods' | 'items', slug: string): Promise<unknown | null | undefined> {
  try {
    const res = await fetch(`/data/wiki/${WIKI_DATA_VERSION}/${kind}/${slug}.json`);
    if (res.status === 404) return null;
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return undefined;
    return await res.json();
  } catch {
    return undefined;
  }
}

function cachedLookup<T>(kind: 'mods' | 'items', extract: (raw: unknown) => T) {
  const cache = new Map<string, Promise<T | undefined>>();
  return (slug: string): Promise<T | undefined> => {
    let pending = cache.get(slug);
    if (!pending) {
      pending = fetchDetail(kind, slug).then((raw) => (raw === undefined ? undefined : extract(raw)));
      cache.set(slug, pending);
      pending.then((result) => {
        if (result === undefined) cache.delete(slug);
      });
    }
    return pending;
  };
}

/** A mod's data; null = no such mod; undefined = the request failed. */
export const fetchModData = cachedLookup('mods', extractModData);
/** A base's data; null = no such item; undefined = the request failed. */
export const fetchBaseData = cachedLookup('items', extractBaseData);
/** Whether a slug is a rune or soul core; undefined = the request failed. */
export const fetchIsRune = cachedLookup('items', extractIsRune);

/** An item's raw detail file (for the Slice 5 stat engine's makeCollectData); null = no such item; undefined = failed. */
export const fetchRawItem = cachedLookup('items', (raw) => raw);
/** A mod's raw detail file; null = no such mod; undefined = failed. */
export const fetchRawMod = cachedLookup('mods', (raw) => raw);
