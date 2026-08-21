import { defaultCache } from '@serwist/next/worker';
import { NetworkOnly, Serwist } from 'serwist';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';

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
    ...defaultCache, // default asset caching for everything else — no other
                      // custom rules; installable-only scope, per the design spec
  ],
});

serwist.addEventListeners();
