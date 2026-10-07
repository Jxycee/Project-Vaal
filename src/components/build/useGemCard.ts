'use client';

// Loads what one gem group's card needs (src/lib/build/gemCard.ts): the skill's
// own wiki file and one per support, each cached per slug for the page's life.
// A file whose request failed is left out (the card shows that support by name
// only) and is not cached, so a later open can retry.
import { useEffect, useState } from 'react';
import { buildGemCard, type GemCard } from '@/lib/build/gemCard';
import type { GemLoadout } from '@/lib/build/gemState';
import { fetchWikiData } from '@/lib/wiki/fetchWikiData';
import { WIKI_DATA_VERSION } from '@/lib/wiki/types';

const cache = new Map<string, Promise<unknown | null>>();

function fetchRawSkill(slug: string): Promise<unknown | null> {
  let pending = cache.get(slug);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetchWikiData(`/data/wiki/${WIKI_DATA_VERSION}/skills/${slug}.json`);
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return null;
        return await res.json();
      } catch {
        return null;
      }
    })();
    cache.set(slug, pending);
    pending.then((r) => {
      if (r === null) cache.delete(slug);
    });
  }
  return pending;
}

/** The card for `loadout`, or a names-only card while its files load. */
export function useGemCard(loadout: GemLoadout): { card: GemCard; loading: boolean } {
  const key = JSON.stringify([loadout.skill?.slug ?? null, loadout.level, loadout.quality, loadout.supports.map((s) => s.slug)]);
  const [loaded, setLoaded] = useState<{ key: string; card: GemCard } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const supportSlugs = [...new Set(loadout.supports.map((s) => s.slug))];
    Promise.all([loadout.skill ? fetchRawSkill(loadout.skill.slug) : Promise.resolve(null), Promise.all(supportSlugs.map(fetchRawSkill))]).then(
      ([skill, supportRaws]) => {
        if (cancelled) return;
        const supports = new Map<string, unknown>();
        supportSlugs.forEach((s, i) => supportRaws[i] != null && supports.set(s, supportRaws[i]));
        setLoaded({ key, card: buildGemCard(loadout, { skill, supports }) });
      },
    );
    return () => {
      cancelled = true;
    };
    // `loadout` is read through `key`: a new object with the same content must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (loaded && loaded.key === key) return { card: loaded.card, loading: false };
  return { card: buildGemCard(loadout, { skill: null, supports: new Map() }), loading: true };
}
