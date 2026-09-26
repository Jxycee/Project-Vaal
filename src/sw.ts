import { defaultCache } from '@serwist/next/worker';
import { NetworkOnly, Serwist } from 'serwist';
import type { PrecacheEntry, RouteHandler, RouteHandlerObject, SerwistGlobalConfig } from 'serwist';
import { PERSONAL_CACHE_NAMES, publicAssetCaching } from './lib/pwa/runtimeCaching';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // /data/wiki/** is auth-gated (src/proxy.ts, 2026-08-21 security review)
    // and must never land in the service worker's Cache Storage — Serwist
    // routes match in array order (first match wins), and defaultCache below
    // includes generic image (`.(?:jpg|jpeg|gif|png|svg|ico|webp)$`,
    // StaleWhileRevalidate) and JSON (`.(?:json|xml|csv)$`, NetworkFirst)
    // matchers that would otherwise both match wiki index/detail JSON and
    // icon PNGs. StaleWhileRevalidate in particular would serve a cached
    // icon straight from Cache Storage with no auth check at all, and any
    // cached entry here survives sign-out on a shared device — Cache Storage
    // isn't cleared by a Supabase sign-out. This rule must stay first.
    {
      matcher: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/data/wiki/'),
      handler: new NetworkOnly(),
    },
    // Public static assets only. The rest of defaultCache stores pages, RSC
    // payloads, /api responses and cross-origin (Supabase) calls — a
    // signed-in user's own responses, kept after sign-out (review
    // 2026-09-26). See src/lib/pwa/runtimeCaching.ts. Anything not matched
    // here goes to the network as if there were no service worker.
    ...publicAssetCaching(defaultCache),
  ],
});

serwist.addEventListeners();

// One-time cleanup for browsers that installed a service worker BEFORE the
// /data/wiki/ NetworkOnly rule above existed (2026-08-21 security review,
// round 2). Those installs may already have gated wiki bytes sitting in
// Cache Storage under defaultCache's generic image/JSON runtime-cache
// buckets — Cache Storage isn't cleared by a Supabase sign-out, so without
// this, "survives sign-out" persists for anyone who hasn't picked up the new
// SW yet. This walks every named cache `defaultCache` defines (read off each
// rule's `handler.cacheName` rather than hardcoding e.g.
// "static-image-assets" / "static-data-assets" literally, so it stays
// correct if @serwist/next's internal naming ever changes) and drops any
// entry whose URL is under /data/wiki/. A no-op after the first activate on
// an already-clean install.
// `RuntimeCaching['handler']` is typed as `RouteHandlerCallback | RouteHandlerObject`
// (a plain `handle` function is also legal), so `cacheName` isn't statically
// known to exist — narrow at runtime instead of importing `Strategy` just
// for an instanceof check. Every defaultCache entry is in practice a Strategy
// instance (StaleWhileRevalidate, NetworkFirst, etc.), all of which do carry it.
function hasCacheName(handler: RouteHandler): handler is RouteHandlerObject & { cacheName: string } {
  return typeof handler === 'object' && handler !== null && 'cacheName' in handler;
}
const defaultCacheNames = new Set(
  defaultCache.map((rule) => rule.handler).filter(hasCacheName).map((handler) => handler.cacheName),
);

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // The caches publicAssetCaching() no longer uses may still hold another
      // user's pages and API responses from before 2026-09-26. Drop them whole.
      await Promise.all(PERSONAL_CACHE_NAMES.map((name) => caches.delete(name)));
      const cacheNames = (await caches.keys()).filter((name) => defaultCacheNames.has(name));
      await Promise.all(
        cacheNames.map(async (name) => {
          const cache = await caches.open(name);
          const requests = await cache.keys();
          await Promise.all(
            requests
              .filter((req) => new URL(req.url).pathname.startsWith('/data/wiki/'))
              .map((req) => cache.delete(req)),
          );
        }),
      );
    })(),
  );
});
