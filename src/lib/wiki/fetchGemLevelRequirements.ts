// The character level each skill gem level needs (src/lib/build/gemLevels.ts),
// one ~7 KB file for every active gem. Cached promise per page; a failed fetch
// (network, non-JSON, malformed body) is not cached and resolves to null, which
// callers read as "no gating" — today's behaviour, never a crash.
import type { GemLevelTable } from '@/lib/build/gemLevels';
import { fetchWikiData } from './fetchWikiData';
import { WIKI_DATA_VERSION } from './types';

let pending: Promise<GemLevelTable | null> | null = null;

function parseTable(raw: unknown): GemLevelTable | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  if (!Array.isArray(v.arrays) || !v.bySlug || typeof v.bySlug !== 'object') return null;
  return { arrays: v.arrays as number[][], bySlug: v.bySlug as Record<string, number> };
}

export function fetchGemLevelRequirements(): Promise<GemLevelTable | null> {
  if (!pending) {
    pending = (async () => {
      try {
        const res = await fetchWikiData(`/data/wiki/${WIKI_DATA_VERSION}/gem-level-requirements.json`);
        if (!res.ok || !(res.headers.get('content-type') ?? '').includes('application/json')) return null;
        return parseTable(await res.json());
      } catch {
        return null;
      }
    })();
    pending.then((table) => {
      if (table === null) pending = null;
    });
  }
  return pending;
}
