import { WIKI_DATA_VERSION, isWikiSearchEntry } from './types';
import type { WikiEntryKind, WikiSearchEntry } from './types';

export class WikiIndexFetchError extends Error {}

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

  if (!res.ok) {
    throw new WikiIndexFetchError(`Failed to load ${kind} index (HTTP ${res.status})`);
  }

  // A same-origin fetch that somehow reaches an unauthenticated context gets
  // redirected to /login by src/proxy.ts. `fetch` follows that redirect by
  // default and resolves with a 200 HTML page rather than JSON — detect that
  // here instead of letting `res.json()` fail with an opaque parse error.
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new WikiIndexFetchError('Session expired — please sign in again.');
  }

  const data: unknown = await res.json();
  const entries = (data as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries) || !entries.every(isWikiSearchEntry)) {
    throw new WikiIndexFetchError(`Malformed ${kind} index response`);
  }

  return entries;
}
