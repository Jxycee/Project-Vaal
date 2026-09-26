// src/lib/pwa/runtimeCaching.ts
// =============================================================================
// Which of @serwist/next's default runtime caches the service worker may use.
//
// The defaults cache navigations, RSC payloads, same-origin /api GETs and every
// cross-origin GET (Supabase included) — each of them a signed-in user's own
// response. Cache Storage is not cleared by a Supabase sign-out, so on a
// shared device the next person could be served them offline or on a slow
// connection (review 2026-09-26). This app is installable, not offline-first,
// so only public static assets are cached; everything else goes to the
// network as if there were no service worker.
//
// An allowlist, not a denylist: a cache a future library version adds is left
// out until someone decides it is safe.
// =============================================================================

/** Public, identical for every visitor. /data/wiki/** is excluded earlier, in sw.ts. */
const PUBLIC_ASSET_CACHES: ReadonlySet<string> = new Set([
  'google-fonts-webfonts',
  'google-fonts-stylesheets',
  'static-font-assets',
  'static-image-assets',
  'next-static-js-assets',
  'next-image',
  'static-audio-assets',
  'static-video-assets',
  'static-js-assets',
  'static-style-assets',
  'static-data-assets',
]);

/** The default caches that can hold a signed-in response. sw.ts deletes them on activate. */
export const PERSONAL_CACHE_NAMES: readonly string[] = [
  'apis',
  'pages',
  'pages-rsc',
  'pages-rsc-prefetch',
  'others',
  'cross-origin',
  'next-data',
];

type Rule = { handler: object };

function cacheNameOf(rule: Rule): string | null {
  const handler = rule.handler as { cacheName?: unknown };
  return typeof handler.cacheName === 'string' ? handler.cacheName : null;
}

/** The rules whose cache is a public asset cache, plus any rule with no cache at all (NetworkOnly). */
export function publicAssetCaching<T extends Rule>(rules: readonly T[]): T[] {
  return rules.filter((rule) => {
    const name = cacheNameOf(rule);
    return name === null || PUBLIC_ASSET_CACHES.has(name);
  });
}
