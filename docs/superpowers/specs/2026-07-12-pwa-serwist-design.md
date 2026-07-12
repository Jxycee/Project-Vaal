# PWA Support via Serwist — Design Spec

**Date:** 2026-07-12
**Status:** approved by Jaycee, ready for implementation plan
**Plan-doc anchors:** none yet — this is new scope, not previously in `poe2-console-hub-plan7_11_2026.md`. §3's "Mobile-friendly + PWA" must-have row should be updated once this ships (targeted section edit, not a rewrite).

## Context

Project Vaal already works fine as a home-screen shortcut on iOS (Safari's "Add to Home Screen" needs no manifest or service worker). It does not currently qualify as an installable PWA on Android/Chrome — no web manifest, no service worker, no PWA meta tags anywhere in the repo. `@ducanh2912/next-pwa` has sat in `package.json` as an unused dependency since the project's `package.json` was first written; it was never wired into `next.config.ts`.

Investigated using it directly and recommended against it: its own npm/docs pages say to migrate to Serwist, it hasn't published in ~2 years, and it's webpack-only — Next.js 16 defaults **both** `next dev` and `next build` to Turbopack, so adopting it would mean losing Turbopack everywhere just for this one plugin.

## Decisions

1. **Scope: installable only.** No offline caching of the passive tree data, no offline handling for prices/dashboard, no push notifications, no custom offline-fallback page. Just a valid manifest + icons + a minimal service worker that satisfies installability criteria and precaches static build assets by default.
2. **Library: Serwist (`@serwist/next` + `serwist`)**, replacing `@ducanh2912/next-pwa` entirely. Actively maintained successor; next-pwa's own docs point here.
3. **Manifest: `src/app/manifest.ts`** (Next.js native App Router convention), not a static `public/manifest.json`. Type-checked against `MetadataRoute.Manifest`, consistent with the existing `icon.png`/`apple-icon.png` file-convention usage.
4. **Build tooling: `next build --webpack` for production builds; `next dev` stays on Turbopack, untouched.** There's a documented, still-referenced Turbopack↔Serwist integration gap (tracked in `serwist/serwist#54`, referenced again in a 2026 Vercel discussion thread). Since the service worker is disabled in development anyway (standard Serwist pattern — nothing to test locally either way), forcing webpack only for the build step costs nothing day-to-day and removes the risk entirely. This only affects the build that runs on Vercel/CI.
5. **Icons:**
   - `pwa-192.png` and `pwa-512.png` (`purpose: "any"`) — reuse the existing `icon.png` (already 512×512) for the 512 size; resize down for 192.
   - `pwa-512-maskable.png` (`purpose: "maskable"`) — the emblem from `public/brand/vaal-emblem.png` (1024×1024 source), scaled to occupy roughly the center 65% of the canvas, composited onto a solid pure-black (`#000000`) background — matching `apple-icon.png`'s existing background treatment (confirmed via pixel sampling: `apple-icon.png`'s corners are exactly `(0,0,0)`), so Android's adaptive-icon safe-zone crop can't clip the logo.
6. **Remove `@ducanh2912/next-pwa` entirely** from `package.json` (dependency) and `package-lock.json` (via `npm install` after the dependency swap — see Implementation notes). No other file in the repo references it, so this is a clean removal.

## File-by-file plan

### New files
- **`src/app/manifest.ts`**
  ```ts
  name: "Project Vaal"
  short_name: "Vaal"
  description: "PoE2 console companion — passive tree, prices, and more"
  start_url: "/"
  display: "standalone"
  background_color: "#0f0d0b"  // matches --background (oklch(0.16 0.006 70)), computed exactly
  theme_color: "#c6a662"       // matches --primary / aged gold (oklch(0.74 0.095 85)), computed exactly
  icons: [
    { src: "/icons/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icons/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icons/pwa-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ]
  ```
  `orientation` intentionally omitted (not fixed to portrait) — no reason to restrict desktop/tablet installs given the app is responsive.

- **`src/sw.ts`** — minimal Serwist worker:
  ```ts
  import { defaultCache } from "@serwist/next/worker";
  import { Serwist } from "serwist";
  import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

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
    runtimeCaching: defaultCache, // default asset caching only — no custom rules
  });

  serwist.addEventListeners();
  ```

- **`public/icons/pwa-192.png`**, **`public/icons/pwa-512.png`**, **`public/icons/pwa-512-maskable.png`** — generated per the Icons decision above.

- **`src/app/__tests__/manifest.test.ts`** — a small vitest test asserting the manifest object has the required fields: `name`, `short_name`, and an `icons` array containing entries for both 192 and 512 sizes plus one `purpose: "maskable"` entry.

### Modified files
- **`next.config.ts`** — wrap the existing config with `withSerwistInit({ swSrc: "src/sw.ts", swDest: "public/sw.js", disable: process.env.NODE_ENV === "development" })` from `@serwist/next`. No other changes to the existing `images.remotePatterns` or `headers()` blocks.
- **`package.json`** —
  - `"build": "next build --webpack"` (was `"next build"`)
  - Add `"@serwist/next"` and `"serwist"` to `dependencies`
  - Remove `"@ducanh2912/next-pwa"` from `dependencies`
- **`src/app/layout.tsx`** — add `manifest: "/manifest.webmanifest"` and a `viewport`/`themeColor` export (Next.js separates `viewport` from `metadata` as of the App Router's current metadata API) so the manifest link and theme-color meta tag are actually emitted in `<head>`.

### Not touched
No changes to the tree viewer, prices page, proxy, or any existing route. This is purely additive — nothing existing changes behavior. (Note: `src/proxy.ts`'s matcher already excludes `_next/static`/`_next/image`/common image extensions/`data/`; `/sw.js` and `/manifest.webmanifest` will still pass through the proxy, same as any other request. Considered extending the matcher to exclude them too — same category of issue as the tree-data fix — but the tree fix mattered because `/tree` re-fetches ~7 static files on every page load; `/sw.js` and the manifest are each fetched once, infrequently, and browser-managed (not on every navigation), so the overhead is negligible. Not worth the added matcher complexity for this.)

## Error handling
- Service worker registration failing (old browser, blocked by user, private browsing) degrades silently to a normal web app — Serwist doesn't throw or block rendering if `serviceWorker` isn't in `navigator`.
- A missing/404 icon reference breaks the manifest's icon display (no install prompt, or a blank icon) but not the app itself. All icon paths will be verified to resolve (200, correct dimensions) before calling this done.
- `next build --webpack` failing for an unrelated reason would surface as a normal CI/build failure — no silent failure mode introduced.

## Testing
- **Automated:** the small manifest-shape vitest test described above.
- **Manual (required before merging):** `npm run build && npm start`, then Chrome DevTools → Application → Manifest (no errors, correct icons) and a Lighthouse PWA check. Real-device Android install testing is Jaycee's call to do or skip; iOS behavior is already confirmed working today and isn't affected by any of this.

## Explicitly out of scope
- Offline caching of the passive tree's `data.json`/atlases (this was the "option 2" scope choice — Jaycee chose the simpler "installable only" option instead)
- Any offline UX for prices/dashboard/auth pages
- Push notifications
- `@serwist/turbopack` (dev-mode Turbopack SW testing) — unnecessary since the SW is disabled in dev anyway
- A custom offline-fallback page

## Implementation notes / known tooling limits
Claude does not have shell/exec access to `C:\Dev\project-vaal` (Filesystem MCP is read/write-file only). This means:
- Claude can write all the new/modified files above directly.
- Claude **cannot** run `npm install` to actually fetch `@serwist/next`/`serwist` or regenerate `package-lock.json` after removing `@ducanh2912/next-pwa` — package-lock surgery for a brand-new dependency (with its own transitive tree and integrity hashes) isn't something to hand-fabricate. **Jaycee must run `npm install` locally after the file changes land**, then the standard gate: `npm run type-check && npm run lint && npm test && npm run build` (the real `--webpack` build, to catch any Serwist/Turbopack-adjacent surprises before deploying).
- Icon generation (resize + maskable composite) will be done in Claude's sandbox (Python/PIL) using the uploaded copies of the existing assets, then written back to `C:\Dev\project-vaal\public\icons\` as finished PNGs — no manual image-editing tools required.
