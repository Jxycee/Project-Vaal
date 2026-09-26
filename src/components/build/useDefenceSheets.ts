'use client';

// The defence stat sheet for both weapon sets of the live checkpoint (Slice 5,
// plans/2026-09-25-slice5-defence-engine.md). Loads the three stats files once
// and the detail files of exactly what the build wears (items, unique bases,
// affixes), then runs collect + engine per set. `null` while loading.

import { useEffect, useMemo, useState } from 'react';
import type { GggTreeJson } from '@poe2-toolkit/tree-core/ggg';
import { GEAR_SLOTS, type GearItem } from '@/lib/build/gearSlots';
import type { GearState } from '@/lib/build/gearState';
import { collectContributions, type Collected } from '@/lib/build/stats/collect';
import { makeCollectData } from '@/lib/build/stats/collectData';
import { computeDefences, type DefenceSheet } from '@/lib/build/stats/engine';
import { fetchStatsFiles, type StatsFiles } from '@/lib/build/stats/fetchStatsFiles';
import type { PassiveState } from '@/lib/build/types';
import { fetchRawItem, fetchRawMod } from '@/lib/wiki/fetchCraftData';

export interface SetResult {
  sheet: DefenceSheet;
  collected: Collected;
}

interface Loaded {
  key: string;
  files: StatsFiles;
  items: Map<string, unknown>;
  mods: Map<string, unknown>;
}

function wornItems(gear: GearState): GearItem[] {
  return [...GEAR_SLOTS.map((s) => gear[s]), ...Object.values(gear.jewels)].filter((i): i is GearItem => i !== null);
}

async function loadAll<T>(slugs: string[], fetchOne: (slug: string) => Promise<T | null | undefined>): Promise<Map<string, unknown>> {
  const results = await Promise.all(slugs.map(fetchOne));
  const map = new Map<string, unknown>();
  slugs.forEach((slug, i) => {
    if (results[i] !== undefined && results[i] !== null) map.set(slug, results[i]);
  });
  return map;
}

export function useDefenceSheets(input: {
  /** null while the tree export is still loading (the shared page fetches it behind a tap). */
  tree: GggTreeJson | null;
  className: string | undefined;
  level: number;
  passive: PassiveState;
  gear: GearState;
}): { 1: SetResult; 2: SetResult } | { error: string } | null {
  const worn = wornItems(input.gear);
  const itemSlugs = [...new Set(worn.map((i) => i.slug))].sort();
  const modSlugs = [...new Set(worn.flatMap((i) => [...(i.craft?.prefixes ?? []), ...(i.craft?.suffixes ?? [])].map((m) => m.slug)))].sort();
  const uniqueNames = [...new Set(worn.filter((i) => i.isUnique).map((i) => i.name))].sort();
  const key = JSON.stringify([itemSlugs, modSlugs, uniqueNames]);

  const [loaded, setLoaded] = useState<Loaded | { key: string; error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const [items, mods, uniques] = JSON.parse(key) as [string[], string[], string[]];
    (async () => {
      const files = await fetchStatsFiles();
      const baseSlugs = uniques.map((n) => files.uniqueStats.uniques[n]?.baseSlug).filter((s): s is string => Boolean(s));
      const [itemMap, modMap] = await Promise.all([loadAll([...new Set([...items, ...baseSlugs])], fetchRawItem), loadAll(mods, fetchRawMod)]);
      if (!cancelled) setLoaded({ key, files, items: itemMap, mods: modMap });
    })().catch((err: unknown) => {
      if (!cancelled) setLoaded({ key, error: String(err) });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return useMemo(() => {
    if (!loaded || loaded.key !== key || !input.tree) return null;
    if ('error' in loaded) return { error: loaded.error };
    const data = makeCollectData({ tree: input.tree as unknown as Parameters<typeof makeCollectData>[0]['tree'], ...loaded.files, items: loaded.items, mods: loaded.mods });
    const cls = (input.tree.classes as unknown as { name: string; base_str: number; base_dex: number; base_int: number }[]).find(
      (c) => c.name === input.className,
    );
    const classBase = cls ? { str: cls.base_str, dex: cls.base_dex, int: cls.base_int } : { str: 0, dex: 0, int: 0 };
    const run = (set: 1 | 2): SetResult => {
      const collected = collectContributions({ passive: input.passive, gear: input.gear, level: input.level, set }, data);
      const sheet = computeDefences({
        level: input.level,
        classBase,
        contributions: collected.contributions,
        resistancePenalty: collected.resistancePenalty,
        flags: collected.flags,
      });
      return { sheet, collected };
    };
    return { 1: run(1), 2: run(2) };
  }, [loaded, key, input.tree, input.className, input.level, input.passive, input.gear]);
}
