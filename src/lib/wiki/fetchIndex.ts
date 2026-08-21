import { WIKI_DATA_VERSION, isWikiSearchEntry } from './types';
import type { WikiEntryKind, WikiSearchEntry } from './types';

export class WikiIndexFetchError extends Error {}

/**
 * Distinct from a generic `WikiIndexFetchError` so callers (WikiBrowse) can
 * react to it specifically — e.g. navigate to /login — rather than just
 * showing a dead-end error banner. Thrown only when the fetch itself gives a
 * direct signal that it was redirected to /login (see `fetchWikiIndex`
 * below), not inferred from response shape.
 */
export class WikiSessionExpiredError extends WikiIndexFetchError {}

/**
 * Fetches a wiki search index client-side from the (now auth-gated, see
 * src/proxy.ts PROTECTED_PREFIXES) /data/wiki/<version>/<kind>-index.json
 * static asset, validating the response shape at the boundary.
 *
 * Split out from the WikiBrowse component so the fetch/validate logic can be
 * unit-tested without a DOM — this repo's vitest config runs in the "node"
 * environment and has no jsdom/testing-library, so the component's rendered
 * loading/error markup itself isn't covered by an automated test; this
 * function is, including the redirect-to-login case below.
 */
export async function fetchWikiIndex(kind: WikiEntryKind): Promise<WikiSearchEntry[]> {
  const res = await fetch(`/data/wiki/${WIKI_DATA_VERSION}/${kind}-index.json`);

  // A same-origin fetch that reaches an unauthenticated context gets
  // redirected to /login by src/proxy.ts. `fetch` follows that redirect by
  // default, so `res.redirected` plus the final URL's pathname is a direct
  // signal — checked before falling back to a content-type heuristic, which
  // could otherwise mislabel an unrelated non-JSON 200 (a captive portal, a
  // CDN error page, an SW fallback) as an expired session.
  if (res.redirected && new URL(res.url).pathname === '/login') {
    throw new WikiSessionExpiredError('Session expired — please sign in again.');
  }

  if (!res.ok) {
    throw new WikiIndexFetchError(`Failed to load ${kind} index (HTTP ${res.status})`);
  }

  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new WikiIndexFetchError(`Unexpected response loading ${kind} index (not JSON).`);
  }

  const data: unknown = await res.json();
  const entries = (data as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries) || !entries.every(isWikiSearchEntry)) {
    throw new WikiIndexFetchError(`Malformed ${kind} index response`);
  }

  return entries;
}
