// Fetches just enough of one wiki entry's detail JSON to render it as a
// small card (icon, a short flavor/description snippet, an accent color) —
// used only by the wiki home page's 4-card "recently searched" strip. Not a
// full detail-shape validator like load.ts's server-side isDetailFor; this
// defensively reads a handful of fields and falls back to safe defaults for
// anything malformed rather than rejecting the whole response, since a
// slightly-wrong card is a much smaller problem here than a hard error.
import { itemAccentColor, skillAccentColor, MOD_ACCENT_COLOR, EFFECT_ACCENT_COLOR, MAP_ACCENT_COLOR } from './accent';
import { WikiIndexFetchError, WikiSessionExpiredError } from './fetchIndex';
import { WIKI_DATA_VERSION } from './types';
import type { WikiEntryKind } from './types';

export interface WikiCardSnippet {
  iconUrl: string | null;
  iconWidth: number | null;
  iconHeight: number | null;
  /** Short flavor/description text, already picked from the right field for this entry's kind. Empty string, never null, when the source has none. */
  snippet: string;
  accent: string;
}

const KIND_PLURAL: Record<WikiEntryKind, string> = {
  item: 'items',
  skill: 'skills',
  mod: 'mods',
  effect: 'effects',
  map: 'maps',
};

const SKILL_COLORS = ['r', 'g', 'b', 'w'] as const;

function accentFor(kind: WikiEntryKind, v: Record<string, unknown>): string {
  if (kind === 'item') return itemAccentColor(v.rarity === 'unique' ? 'unique' : 'normal');
  if (kind === 'skill') {
    const color = SKILL_COLORS.includes(v.color as (typeof SKILL_COLORS)[number])
      ? (v.color as (typeof SKILL_COLORS)[number])
      : 'w';
    return skillAccentColor(color);
  }
  if (kind === 'mod') return MOD_ACCENT_COLOR;
  if (kind === 'effect') return EFFECT_ACCENT_COLOR;
  return MAP_ACCENT_COLOR;
}

/** Exported for testing — pure extraction, no I/O. */
export function extractCardSnippet(kind: WikiEntryKind, raw: unknown): WikiCardSnippet {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const iconUrl = typeof v.iconUrl === 'string' ? v.iconUrl : null;
  const iconWidth = typeof v.iconWidth === 'number' ? v.iconWidth : null;
  const iconHeight = typeof v.iconHeight === 'number' ? v.iconHeight : null;

  let snippet = '';
  if (kind === 'item') {
    snippet = Array.isArray(v.flavourText)
      ? v.flavourText.filter((s): s is string => typeof s === 'string').join(' ')
      : '';
  } else if (kind === 'mod') {
    snippet = Array.isArray(v.stats)
      ? v.stats.filter((s): s is string => typeof s === 'string').join(' ')
      : '';
  } else if (typeof v.description === 'string') {
    snippet = v.description;
  }

  return { iconUrl, iconWidth, iconHeight, snippet, accent: accentFor(kind, v) };
}

/**
 * Fetches one entry's detail JSON client-side and extracts just the card
 * fields. Same static file `loadDetail` reads server-side
 * (`/data/wiki/<version>/<kind>s/<slug>.json`), same auth gating
 * (`proxy.ts`) as the index files `fetchWikiIndex` already reads.
 */
export async function fetchWikiCardSnippet(kind: WikiEntryKind, slug: string): Promise<WikiCardSnippet> {
  const res = await fetch(`/data/wiki/${WIKI_DATA_VERSION}/${KIND_PLURAL[kind]}/${slug}.json`);

  if (res.redirected && new URL(res.url).pathname === '/login') {
    throw new WikiSessionExpiredError('Session expired — please sign in again.');
  }
  if (!res.ok) {
    throw new WikiIndexFetchError(`Failed to load ${kind} detail (HTTP ${res.status})`);
  }

  const data: unknown = await res.json();
  return extractCardSnippet(kind, data);
}
