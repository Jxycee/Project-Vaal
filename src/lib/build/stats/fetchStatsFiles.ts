// src/lib/build/stats/fetchStatsFiles.ts
// =============================================================================
// The three whole files the defence engine needs in the browser, fetched once
// per page and shared: typed tree node stats, typed base implicits, typed
// unique lines (all written by `npm run sync:stats`). A failed load is not
// cached, so a later render can retry.
// =============================================================================

import { TREE_VERSION } from '@/lib/tree/version';
import { fetchWikiData } from '@/lib/wiki/fetchWikiData';
import { WIKI_DATA_VERSION } from '@/lib/wiki/types';
import type { RawCollectFiles } from './collectData';

export type StatsFiles = Pick<RawCollectFiles, 'nodeStats' | 'implicitStats' | 'uniqueStats'>;

let pending: Promise<StatsFiles> | null = null;

async function getJson(url: string): Promise<unknown> {
  const res = await fetchWikiData(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

export function fetchStatsFiles(): Promise<StatsFiles> {
  if (!pending) {
    pending = Promise.all([
      getJson(`/data/tree/${TREE_VERSION}/node-stats.json`),
      getJson(`/data/wiki/${WIKI_DATA_VERSION}/implicit-stats.json`),
      getJson(`/data/wiki/${WIKI_DATA_VERSION}/unique-stats.json`),
    ])
      .then(([nodeStats, implicitStats, uniqueStats]) => ({ nodeStats, implicitStats, uniqueStats }) as StatsFiles)
      .catch((err: unknown) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}
