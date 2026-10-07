'use client';

// Loads what one item's card needs (src/lib/build/itemCard.ts): the item's own
// file, each chosen mod's file, each socketed rune's file, and the tier-rank
// table. All cached per slug (src/lib/wiki/fetchCraftData.ts); the tier table
// is fetched once per page. A file whose request failed is left out of its
// map, which the card shows as "Unknown affix" rather than hiding the mod.
import { useEffect, useState } from 'react';
import { buildItemCard, type CardSources, type ItemCard } from '@/lib/build/itemCard';
import type { GearItem } from '@/lib/build/gearSlots';
import { fetchRawItem, fetchRawMod } from '@/lib/wiki/fetchCraftData';
import { fetchWikiData } from '@/lib/wiki/fetchWikiData';
import { WIKI_DATA_VERSION } from '@/lib/wiki/types';

let tiersPending: Promise<CardSources['tiers']> | null = null;
function fetchTiers(): Promise<CardSources['tiers']> {
  if (!tiersPending) {
    tiersPending = fetchWikiData(`/data/wiki/${WIKI_DATA_VERSION}/mod-tiers.json`)
      .then((res) => (res.ok ? (res.json() as Promise<CardSources['tiers']>) : {}))
      .catch(() => ({}));
    // A failed load is not kept: a later card retries. An empty table still renders ("P" / "S" without a number).
    tiersPending.then((t) => {
      if (Object.keys(t).length === 0) tiersPending = null;
    });
  }
  return tiersPending;
}

/** The card for `item`, or null while it loads. */
export function useItemCard(item: GearItem | null): ItemCard | null {
  const key = item ? JSON.stringify([item.slug, item.name, item.craft ?? null, item.isUnique]) : '';
  const [loaded, setLoaded] = useState<{ key: string; card: ItemCard } | null>(null);

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    const slugs = {
      mods: [...new Set([...(item.craft?.prefixes ?? []), ...(item.craft?.suffixes ?? [])].map((m) => m.slug))],
      runes: [...new Set(item.craft?.runes ?? [])],
    };
    Promise.all([
      fetchRawItem(item.slug),
      Promise.all(slugs.mods.map((s) => fetchRawMod(s))),
      Promise.all(slugs.runes.map((s) => fetchRawItem(s))),
      fetchTiers(),
    ]).then(([rawItem, rawMods, rawRunes, tiers]) => {
      if (cancelled) return;
      const mods = new Map<string, unknown>();
      slugs.mods.forEach((s, i) => rawMods[i] != null && mods.set(s, rawMods[i]));
      const runes = new Map<string, unknown>();
      slugs.runes.forEach((s, i) => rawRunes[i] != null && runes.set(s, rawRunes[i]));
      setLoaded({ key, card: buildItemCard(item, { item: rawItem ?? {}, mods, tiers, runes }) });
    });
    return () => {
      cancelled = true;
    };
    // `item` is read through `key`: a new object with the same content must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return loaded && loaded.key === key ? loaded.card : null;
}
