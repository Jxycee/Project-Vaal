import { describe, expect, it } from 'vitest';
import { PERSONAL_CACHE_NAMES, publicAssetCaching } from './runtimeCaching';

// A stand-in for @serwist/next's production defaultCache: one entry per cache
// it defines (read off node_modules/@serwist/next/dist/index.worker.mjs on
// 2026-09-26), plus its trailing NetworkOnly catch-all, which has no cache.
const rule = (cacheName?: string) => ({ matcher: /x/, handler: cacheName ? { cacheName } : { handle: () => undefined } });
const DEFAULTS = [
  'google-fonts-webfonts', 'google-fonts-stylesheets', 'static-font-assets', 'static-image-assets',
  'next-static-js-assets', 'next-image', 'static-audio-assets', 'static-video-assets', 'static-js-assets',
  'static-style-assets', 'next-data', 'static-data-assets', 'apis', 'pages-rsc-prefetch', 'pages-rsc', 'pages',
  'others', 'cross-origin',
].map(rule);

describe('publicAssetCaching', () => {
  const kept = publicAssetCaching([...DEFAULTS, rule()]);
  const keptNames = kept.map((r) => ('cacheName' in r.handler ? r.handler.cacheName : null));

  it('drops every cache that can hold a signed-in response', () => {
    // Pages, RSC payloads, /api responses and cross-origin (Supabase) calls are
    // per user and survive sign-out in Cache Storage.
    for (const name of ['apis', 'pages', 'pages-rsc', 'pages-rsc-prefetch', 'others', 'cross-origin', 'next-data']) {
      expect(keptNames).not.toContain(name);
      expect(PERSONAL_CACHE_NAMES).toContain(name);
    }
  });

  it('keeps the public static asset caches', () => {
    for (const name of ['static-image-assets', 'next-static-js-assets', 'static-style-assets', 'static-font-assets']) {
      expect(keptNames).toContain(name);
    }
  });

  it('keeps a rule with no cache (it cannot store anything)', () => {
    expect(keptNames).toContain(null);
  });

  it('drops a cache it does not know, so a new library default is never trusted blindly', () => {
    expect(publicAssetCaching([rule('some-new-cache')])).toEqual([]);
  });
});
