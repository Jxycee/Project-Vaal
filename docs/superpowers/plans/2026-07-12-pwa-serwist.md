# PWA Support via Serwist — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Project Vaal installable as a PWA on Android/Chrome (manifest + icons + minimal service worker), replacing the unused `@ducanh2912/next-pwa` dependency with Serwist.

**Architecture:** A native Next.js `manifest.ts` (App Router file convention) provides the web manifest; `@serwist/next` wraps `next.config.ts` to generate a minimal service worker (`src/sw.ts`) that only precaches static build assets — no custom runtime caching, no offline handling for live-data pages. Production builds use `--webpack` to sidestep a documented Turbopack/Serwist integration gap; `next dev` is untouched (the service worker is disabled in development, so there's nothing to lose there).

**Tech Stack:** Next.js 16.2.9 (App Router), TypeScript, `@serwist/next` + `serwist` (new), vitest.

**Spec:** `docs/superpowers/specs/2026-07-12-pwa-serwist-design.md` — read it first if anything below is ambiguous; it wins on conflict.

## Global Constraints

- Scope is installable-only: no offline caching of tree/prices data, no push notifications, no custom offline-fallback page.
- Replace `@ducanh2912/next-pwa` entirely — remove it from `package.json`, don't leave it installed alongside Serwist.
- Manifest lives at `src/app/manifest.ts` (native convention), not a static `public/manifest.json`.
- `next build` must use `--webpack`; `next dev` must stay untouched (default Turbopack).
- Manifest colors are exact: `background_color: "#0f0d0b"`, `theme_color: "#c6a662"` — do not substitute the raw oklch strings or approximate hex values.
- Maskable icon background is pure black `#000000` (matches the existing `apple-icon.png`), not the oklch charcoal token.
- Claude has no shell/exec access to `C:\Dev\project-vaal` in this session — file writes only. Every step that requires running a command is explicitly marked **[JAYCEE RUNS]** and must not be silently skipped or assumed to have passed.

---

## Task 1: Generate PWA icon assets

**Files:**
- Create: `public/icons/pwa-192.png`
- Create: `public/icons/pwa-512.png`
- Create: `public/icons/pwa-512-maskable.png`

**Interfaces:**
- Consumes: `src/app/icon.png` (existing, 512×512 RGBA), `public/brand/vaal-emblem.png` (existing, 1024×1024 RGBA)
- Produces: three PNG files referenced by `src/app/manifest.ts` in Task 2 by exact path (`/icons/pwa-192.png`, `/icons/pwa-512.png`, `/icons/pwa-512-maskable.png`)

This task is asset generation, not logic — there's no meaningful "failing test" to write first. Instead: generate, then verify dimensions/mode/format directly (the verification step below is the acceptance check for this task).

- [ ] **Step 1: Generate the three files**

```python
from PIL import Image

SRC_ICON = "src/app/icon.png"                    # 512x512 RGBA, existing
SRC_EMBLEM = "public/brand/vaal-emblem.png"       # 1024x1024 RGBA, existing
OUT_DIR = "public/icons"

icon = Image.open(SRC_ICON)
icon.save(f"{OUT_DIR}/pwa-512.png")

icon_192 = icon.resize((192, 192), Image.LANCZOS)
icon_192.save(f"{OUT_DIR}/pwa-192.png")

emblem = Image.open(SRC_EMBLEM).convert("RGBA")
CANVAS = 512
SCALE = 0.65
inner = int(CANVAS * SCALE)  # 332px — confirmed the emblem's own visible
                             # content already fills ~93% of its 1024x1024
                             # canvas, so this yields a rendered logo at
                             # roughly 60% of the final canvas — comfortably
                             # inside the ~80% maskable safe-zone circle.
emblem_resized = emblem.resize((inner, inner), Image.LANCZOS)

canvas = Image.new("RGBA", (CANVAS, CANVAS), (0, 0, 0, 255))
offset = ((CANVAS - inner) // 2, (CANVAS - inner) // 2)
canvas.alpha_composite(emblem_resized, offset)
canvas = canvas.convert("RGB")  # flatten — solid black bg, no alpha needed
canvas.save(f"{OUT_DIR}/pwa-512-maskable.png")
```

- [ ] **Step 2: Verify the output**

```python
from PIL import Image

expected = {
    "public/icons/pwa-192.png": ((192, 192), "RGBA"),
    "public/icons/pwa-512.png": ((512, 512), "RGBA"),
    "public/icons/pwa-512-maskable.png": ((512, 512), "RGB"),
}
for path, (size, mode) in expected.items():
    im = Image.open(path)
    assert im.size == size, f"{path}: expected size {size}, got {im.size}"
    assert im.mode == mode, f"{path}: expected mode {mode}, got {im.mode}"
    assert im.format == "PNG", f"{path}: expected PNG, got {im.format}"
print("All three icon files verified.")
```

Expected output: `All three icon files verified.` with no assertion errors.

- [ ] **Step 3: Commit**

```powershell
git add public/icons/pwa-192.png public/icons/pwa-512.png public/icons/pwa-512-maskable.png
git commit -m "feat(pwa): generate manifest icon assets (192, 512, 512 maskable)"
```

---

## Task 2: Web app manifest (TDD)

**Files:**
- Test: `src/app/__tests__/manifest.test.ts`
- Create: `src/app/manifest.ts`

**Interfaces:**
- Consumes: nothing from other tasks (icon paths are string literals, not imports — Task 1's files just need to exist at those paths by the time this is manually verified)
- Produces: `export default function manifest(): MetadataRoute.Manifest` at `src/app/manifest.ts`, importable in tests as `import manifest from '@/app/manifest'`

- [ ] **Step 1: Write the failing test**

Create `src/app/__tests__/manifest.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import manifest from '@/app/manifest';

describe('manifest', () => {
  it('has the required identity fields', () => {
    const result = manifest();
    expect(result.name).toBe('Project Vaal');
    expect(result.short_name).toBe('Vaal');
    expect(result.display).toBe('standalone');
    expect(result.start_url).toBe('/');
  });

  it('uses the exact dark-theme colors', () => {
    const result = manifest();
    expect(result.background_color).toBe('#0f0d0b');
    expect(result.theme_color).toBe('#c6a662');
  });

  it('includes 192 and 512 "any"-purpose icons plus a 512 maskable icon', () => {
    const result = manifest();
    const icons = result.icons ?? [];
    const any192 = icons.find((i) => i.sizes === '192x192' && i.purpose === 'any');
    const any512 = icons.find((i) => i.sizes === '512x512' && i.purpose === 'any');
    const maskable512 = icons.find((i) => i.sizes === '512x512' && i.purpose === 'maskable');
    expect(any192).toBeDefined();
    expect(any512).toBeDefined();
    expect(maskable512).toBeDefined();
    expect(any192?.src).toBe('/icons/pwa-192.png');
    expect(any512?.src).toBe('/icons/pwa-512.png');
    expect(maskable512?.src).toBe('/icons/pwa-512-maskable.png');
  });
});
```

- [ ] **Step 2: [JAYCEE RUNS] Run test to verify it fails**

Run: `npm test -- src/app/__tests__/manifest.test.ts`
Expected: FAIL — `Cannot find module '@/app/manifest'` (the module doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

Create `src/app/manifest.ts`:

```ts
import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Project Vaal',
    short_name: 'Vaal',
    description: 'PoE2 console companion — passive tree, prices, and more',
    start_url: '/',
    display: 'standalone',
    background_color: '#0f0d0b',
    theme_color: '#c6a662',
    icons: [
      { src: '/icons/pwa-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/pwa-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
```

- [ ] **Step 4: [JAYCEE RUNS] Run test to verify it passes**

Run: `npm test -- src/app/__tests__/manifest.test.ts`
Expected: PASS — 3 tests passed.

- [ ] **Step 5: [JAYCEE RUNS] Commit**

```powershell
git add src/app/manifest.ts src/app/__tests__/manifest.test.ts
git commit -m "feat(pwa): add web app manifest"
```

---

## Task 3: Minimal Serwist service worker

**Files:**
- Create: `src/sw.ts`

**Interfaces:**
- Consumes: `@serwist/next/worker` (`defaultCache`), `serwist` (`Serwist`, `PrecacheEntry`, `SerwistGlobalConfig`) — packages installed in Task 6
- Produces: a service worker entry point referenced by `swSrc: 'src/sw.ts'` in Task 4's `next.config.ts` wrap

No automated test for this task — a service worker only runs in a browser's SW execution context, which vitest's `node` environment can't exercise. It's covered by the manual DevTools/Lighthouse check in Task 6.

- [ ] **Step 1: Write the service worker**

Create `src/sw.ts`:

```ts
import { defaultCache } from '@serwist/next/worker';
import { Serwist } from 'serwist';
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
  runtimeCaching: defaultCache, // default asset caching only — no custom rules;
                                // installable-only scope, per the design spec
});

serwist.addEventListeners();
```

- [ ] **Step 2: Commit**

```powershell
git add src/sw.ts
git commit -m "feat(pwa): add minimal Serwist service worker (precache only)"
```

(Type-checking this file requires `@serwist/next`/`serwist` to be installed — that happens in Task 6. This step will show red squiggles in the editor until then; that's expected, not a bug.)

---

## Task 4: Wire Serwist into the build (next.config.ts + package.json)

**Files:**
- Modify: `next.config.ts` (entire file — shown in full below)
- Modify: `package.json`

**Interfaces:**
- Consumes: `src/sw.ts` from Task 3 (referenced by path as `swSrc`)
- Produces: `next.config.ts` exports a Serwist-wrapped config; `package.json`'s `build` script uses `--webpack`; `@ducanh2912/next-pwa` no longer listed as a dependency

- [ ] **Step 1: Replace `next.config.ts` in full**

```ts
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

// Serwist generates the service worker from src/sw.ts. Disabled in
// development — nothing to test there either way, and it sidesteps a
// documented Turbopack/Serwist dev-mode integration gap. Production builds
// use `next build --webpack` (see package.json) for the same reason, applied
// to the build step instead. See docs/superpowers/specs/2026-07-12-pwa-serwist-design.md.
const withSerwist = withSerwistInit({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {
  // -------------------------------------------------------------------------
  // Image optimisation
  // Add domains here as we discover which CDNs GGG / poewiki use for assets.
  // -------------------------------------------------------------------------
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'web.poecdn.com',       // GGG CDN — item icons, skill gem art
      },
      {
        protocol: 'https',
        hostname: 'static.wikia.nocookie.net', // poewiki.net image CDN
      },
    ],
  },

  // -------------------------------------------------------------------------
  // Cache headers for large static data files served from /public/data/
  //
  // - Passive tree JSON: ~2MB, served from CDN with version suffix
  //   e.g. /data/skilltree-0.2.0.json — immutable per version
  // - Campaign JSON: smaller, but also versioned per patch
  //   e.g. /data/campaign-0.2.0.json
  //
  // Files are cache-busted by including the game version in the filename.
  // -------------------------------------------------------------------------
  async headers() {
    return [
      {
        source: '/data/:filename*',
        headers: [
          {
            key: 'Cache-Control',
            // max-age=1 year + immutable: CDN and browser cache forever,
            // bust by changing the filename on each patch update.
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ]
  },

  // -------------------------------------------------------------------------
  // Redirect /tree/[shareToken] → /builds/[shareToken] if we ever rename
  // the route. Placeholder — remove if not needed.
  // -------------------------------------------------------------------------
  // async redirects() {
  //   return []
  // },
}

export default withSerwist(nextConfig)
```

- [ ] **Step 2: Update `package.json`**

Change the `build` script:
```diff
-    "build": "next build",
+    "build": "next build --webpack",
```

Remove this line from `dependencies` (it will be replaced by Task 6's `npm install`):
```diff
-    "@ducanh2912/next-pwa": "^10.2.9",
```

- [ ] **Step 3: Commit**

```powershell
git add next.config.ts package.json
git commit -m "feat(pwa): wire Serwist into next.config.ts, switch build to webpack, drop next-pwa"
```

---

## Task 5: Manifest link + theme color in the root layout

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: nothing new
- Produces: `<link rel="manifest">` and `<meta name="theme-color">` tags in every page's `<head>`

Next.js normally auto-links a file-based `manifest.ts` into `<head>` without any manual metadata — but this exact behavior has had documented edge-case bugs in Next's history, and this project's Next.js version (16.2.9) is new enough that it's worth the one-line insurance rather than assuming. No automated test for this (it's two metadata fields, verified visually in Task 6's manual check).

- [ ] **Step 1: Add `manifest` and `viewport` to `src/app/layout.tsx`**

The current file:

```tsx
import type { Metadata } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Project Vaal",
  description:
    "A free companion app for Path of Exile 2 console players — builds, passive tree, campaign tracker, and prices.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cinzel.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

Replace with:

```tsx
import type { Metadata, Viewport } from "next";
import { Cinzel, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Project Vaal",
  description:
    "A free companion app for Path of Exile 2 console players — builds, passive tree, campaign tracker, and prices.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#c6a662",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cinzel.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add src/app/layout.tsx
git commit -m "feat(pwa): link manifest and set theme-color meta"
```

---

## Task 6: Install dependencies and run the full verification gate

**Files:** none (dependency install + verification only)

**Interfaces:**
- Consumes: everything from Tasks 1–5
- Produces: a working, installable PWA build; `package-lock.json` updated and back in sync with `package.json`

Every step in this task requires shell access Claude does not have. **[JAYCEE RUNS]** applies to the whole task.

- [ ] **Step 1: [JAYCEE RUNS] Install Serwist, remove next-pwa from the lockfile**

```powershell
cd C:\Dev\project-vaal
npm install @serwist/next serwist
```

Since Task 4 already removed `@ducanh2912/next-pwa` from `package.json`'s `dependencies`, this single command both adds `@serwist/next`/`serwist` (with real resolved versions, written into `package.json` automatically) and prunes the now-unlisted `@ducanh2912/next-pwa` from `package-lock.json` and `node_modules` in the same pass.

Expected: command exits 0; `git diff package.json` shows `@serwist/next` and `serwist` added, `@ducanh2912/next-pwa` gone.

- [ ] **Step 2: [JAYCEE RUNS] Type-check**

```powershell
npm run type-check
```

Expected: exits 0, no errors. (This is where Task 3's `src/sw.ts` gets its first real type-check now that the Serwist packages exist.)

- [ ] **Step 3: [JAYCEE RUNS] Lint**

```powershell
npm run lint
```

Expected: exits 0, no errors.

- [ ] **Step 4: [JAYCEE RUNS] Run the full test suite**

```powershell
npm test
```

Expected: all tests pass, including the 3 new manifest tests from Task 2.

- [ ] **Step 5: [JAYCEE RUNS] Production build (the real gate for the Turbopack/webpack decision)**

```powershell
npm run build
```

Expected: exits 0. Confirm the build log mentions webpack, not Turbopack, for this step (sanity-checks that `--webpack` actually took effect). Look for `public/sw.js` and `public/sw.js.map` (or similar) appearing as build output — that's Serwist's generated service worker.

- [ ] **Step 6: [JAYCEE RUNS] Manual install/PWA check**

```powershell
npm start
```

Then in Chrome, on `http://localhost:3000`:
1. DevTools → Application → Manifest: confirm no errors, all three icons load, name/short_name/colors match.
2. DevTools → Application → Service Workers: confirm one is registered and activated.
3. View Source or Elements panel: confirm exactly **one** `<link rel="manifest">` tag in `<head>` (checking for the duplicate-tag risk flagged in Task 5).
4. Run a Lighthouse audit (PWA category) and confirm the installability checks pass.
5. Optional: check the install icon appears in Chrome's address bar / three-dot menu → "Install Project Vaal."

- [ ] **Step 7: [JAYCEE RUNS] Final commit**

```powershell
git add package.json package-lock.json
git commit -m "chore(pwa): install @serwist/next + serwist, remove @ducanh2912/next-pwa"
```

- [ ] **Step 8: Update the plan doc**

Add a dated note to `poe2-console-hub-plan7_11_2026.md` §3 (or whatever the current dated filename is) recording that the app is now a real installable PWA on Android/Chrome, referencing this plan and the design spec — a targeted section edit, not a rewrite, per the plan doc's own maintenance rules.

---

## Self-Review

**1. Spec coverage:** Scope (installable only) → Task 1 (icons) + Task 2 (manifest) + Task 3 (minimal SW). Library swap → Task 4 + Task 6 Step 1. Manifest as `src/app/manifest.ts` → Task 2. Build tooling (`--webpack`) → Task 4 Step 2 + Task 6 Step 5. Icons (reuse + maskable) → Task 1. Colors → Task 2. `@ducanh2912/next-pwa` removal → Task 4 Step 2 + Task 6 Step 1. Testing (manifest-shape test + manual Lighthouse/DevTools check) → Task 2 + Task 6 Step 6. Every spec decision has a task. No gaps found.

**2. Placeholder scan:** No "TBD"/"TODO"/"similar to Task N" found. Every code block is complete, runnable code, not a description of code.

**3. Type consistency:** `manifest()` return type (`MetadataRoute.Manifest`) and its `icons` field shape match between Task 2's implementation and its own test. `src/sw.ts`'s `Serwist`/`defaultCache`/`PrecacheEntry`/`SerwistGlobalConfig` names match between Task 3 and the `@serwist/next`/`serwist` packages installed in Task 6 — same names used both places. `swSrc: 'src/sw.ts'` / `swDest: 'public/sw.js'` in Task 4 match the file Task 3 creates and the file Task 6 checks for in the build output.
