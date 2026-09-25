'use client';

// The data the craft validator reads (src/lib/build/validate/affixRules.ts)
// for whatever the live gear state holds: every chosen mod, every crafted
// base, every socketed rune. Fetched lazily and cached per slug
// (src/lib/wiki/fetchCraftData.ts). A lookup whose request failed is left
// OUT of the maps, which the validator reads as "still loading" and skips —
// never as "missing".

import { useEffect, useState } from 'react';
import { GEAR_SLOTS } from '@/lib/build/gearSlots';
import type { GearState } from '@/lib/build/gearState';
import type { BaseData, CraftData, ModData } from '@/lib/build/validate';
import { fetchBaseData, fetchIsRune, fetchModData } from '@/lib/wiki/fetchCraftData';

function slugsOf(gear: GearState): { mods: string[]; bases: string[]; runes: string[] } {
  const items = [...GEAR_SLOTS.map((s) => gear[s]), ...Object.values(gear.jewels)].filter((i) => i?.craft);
  const mods = new Set<string>();
  const bases = new Set<string>();
  const runes = new Set<string>();
  for (const item of items) {
    bases.add(item!.slug);
    for (const m of [...item!.craft!.prefixes, ...item!.craft!.suffixes]) mods.add(m.slug);
    for (const r of item!.craft!.runes) runes.add(r);
  }
  const sorted = (s: Set<string>) => [...s].sort();
  return { mods: sorted(mods), bases: sorted(bases), runes: sorted(runes) };
}

async function load<T>(slugs: string[], fetchOne: (slug: string) => Promise<T | undefined>): Promise<Map<string, T>> {
  const results = await Promise.all(slugs.map(fetchOne));
  const map = new Map<string, T>();
  slugs.forEach((slug, i) => {
    if (results[i] !== undefined) map.set(slug, results[i] as T);
  });
  return map;
}

/**
 * CraftData for the given gear, or undefined before the first load. While a
 * newer set of slugs loads, the previous maps are returned: slugs they lack
 * are skipped by the validator, so warnings never flicker on and off.
 */
export function useCraftData(gear: GearState): CraftData | undefined {
  const wanted = slugsOf(gear);
  const key = JSON.stringify(wanted);
  const [result, setResult] = useState<{ key: string; data: CraftData } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { mods, bases, runes } = JSON.parse(key) as ReturnType<typeof slugsOf>;
    Promise.all([
      load<ModData | null>(mods, fetchModData),
      load<BaseData | null>(bases, fetchBaseData),
      load<boolean>(runes, fetchIsRune),
    ]).then(([modMap, baseMap, runeMap]) => {
      if (!cancelled) setResult({ key, data: { mods: modMap, bases: baseMap, runes: runeMap } });
    });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return result?.data;
}
