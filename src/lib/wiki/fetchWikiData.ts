// src/lib/wiki/fetchWikiData.ts
// =============================================================================
// fetch() for the auth-gated /data/wiki/** files, with one recovery.
//
// Until 2026-09-26 the 307-to-/login for a signed-out request under
// /data/wiki/ inherited next.config.ts's `private, max-age=3600`, so a browser
// whose session expired on a wiki page kept that redirect for an hour. After
// signing back in, a plain fetch replayed it from cache, landed on /login,
// was sent straight back (the proxy now sees the user) and replayed it again
// until the redirect limit threw a TypeError. src/proxy.ts now marks every
// redirect `no-store`, but a browser that cached one before that deploy keeps
// it for up to an hour — so a network-level failure is retried ONCE with
// `cache: 'reload'`, which bypasses the HTTP cache and replaces the entry.
// A real network failure fails the same way twice and is thrown as before.
// =============================================================================

export async function fetchWikiData(url: string): Promise<Response> {
  try {
    return await fetch(url);
  } catch {
    return fetch(url, { cache: 'reload' });
  }
}
