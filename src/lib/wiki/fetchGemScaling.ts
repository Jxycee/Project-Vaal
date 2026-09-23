// Per-gem level cap — the max `level` a skill's own `scaling[]` reaches.
//
// Active Skill Gems scale to level 40 in our data (60 sampled, all 40);
// Spirit Gems are mixed (mostly 40, some 1/8/11/14); Support Gems cap at 1
// (60 of 60 sampled — they simply have no per-gem cap function, callers
// never ask). See docs/superpowers/CURRENT-STATE.md. Hardcoding 40 would be
// wrong for the Spirit-gem minority, so every caller reads this per-gem,
// from the gem's own detail JSON, rather than assuming a game-wide constant.
//
// Same static-file path fetchDetail.ts's fetchWikiCardSnippet reads
// (`/data/wiki/<version>/skills/<slug>.json`, auth-gated by proxy.ts), same
// tolerance-over-rejection reasoning: a malformed or missing file falls back
// to 1 (the one level every gem legitimately has) rather than throwing.
import { WIKI_DATA_VERSION } from './types';

/**
 * Pure extraction — no I/O, unit-test target. Given a skill detail's raw
 * JSON (or anything else), returns the highest `level` in `scaling[]`, or 1
 * when `scaling` is missing, empty, or every entry is malformed.
 */
export function extractMaxGemLevel(raw: unknown): number {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const scaling = Array.isArray(v.scaling) ? v.scaling : [];
  const levels = scaling
    .map((entry) => (entry && typeof entry === 'object' ? (entry as Record<string, unknown>).level : undefined))
    .filter((n): n is number => typeof n === 'number' && Number.isFinite(n));
  return levels.length > 0 ? Math.max(...levels) : 1;
}

/**
 * Fetches one skill's max gem level client-side. Never throws — a failed
 * request, non-JSON response, or malformed body all fall back to 1, same as
 * `extractMaxGemLevel` does for a malformed-but-present body. This is the
 * "if the gem's data is unavailable, fall back to allowing 1 only" rule.
 */
export async function fetchMaxGemLevel(slug: string): Promise<number> {
  try {
    const res = await fetch(`/data/wiki/${WIKI_DATA_VERSION}/skills/${slug}.json`);
    if (!res.ok) return 1;
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) return 1;
    const data: unknown = await res.json();
    return extractMaxGemLevel(data);
  } catch {
    return 1;
  }
}
