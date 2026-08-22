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

  // -------------------------------------------------------------------------
  // Precache scope. @serwist/next defaults this to ['**/*'] — every file in
  // public/ becomes a precache entry. That was fine at 81 files; the wiki's
  // generated data added ~10k more, which put every one of them in the
  // manifest: sw.js went to 3.35MB (parsed by every visitor of every page)
  // and the service worker tried to fetch the whole dataset on install.
  //
  // These patterns keep every asset directory precached as before while
  // opting public/data/ in by name, so anything large added under data/ in
  // future stays out until someone decides otherwise. The wiki is not
  // offline-capable content — it is fetched on demand behind auth, and the
  // app shell it lives in is precached via .next/static regardless.
  //
  //   '*'                top-level files (cursor.png; sw.js is already ignored)
  //   '!(data)/**/*'     every asset directory except data/, including ones
  //                      added later — background, brand, effects, icons,
  //                      illustrations, models, ornaments
  //   'data/tree/**/*'   the vendored passive-tree export, precached before
  //                      this feature existed; kept so behaviour is unchanged
  //
  // Verified against glob@13 (what @serwist/next resolves): 80 entries, 38 of
  // them tree, 0 from data/wiki. Negative patterns are NOT an option here —
  // glob v9+ dropped inline '!' and @serwist/next hardcodes `ignore`.
  // -------------------------------------------------------------------------
  globPublicPatterns: ['*', '!(data)/**/*', 'data/tree/**/*'],
})

const nextConfig: NextConfig = {
  // -------------------------------------------------------------------------
  // Explicit, empty Turbopack config. `withSerwistInit` (below) injects a
  // `webpack` key into this config to bundle the service worker for
  // production (`next build --webpack`). Without this, `next dev` (which
  // defaults to Turbopack on Next 16) sees that `webpack` key with no
  // matching `turbopack` key and treats it as an unmigrated config, hard-
  // erroring on startup. This tells Next.js the Turbopack/webpack split is
  // deliberate: dev stays on Turbopack with its own defaults, the webpack
  // key only matters for the production build path.
  // -------------------------------------------------------------------------
  turbopack: {},

  // -------------------------------------------------------------------------
  // Serverless bundle tracing for the wiki's ISR detail routes.
  //
  // Those routes read public/data/wiki/<version>/<kind>s/<slug>.json at
  // request time. The slug is dynamic, so Next's tracer cannot narrow the
  // path and pulls the whole wiki tree into every one of the three functions
  // — originally 27,771 files / 211MB each, past Vercel's 250MB uncompressed
  // function limit and enough to fail the deploy outright.
  //
  // Two exclusions, both safe because the server never opens these files:
  //   - icons/**   fetched by URL from the CDN by the browser, never read by
  //                the server. This is the bulk of the bytes.
  //   - the other two kinds' detail directories, per route. /wiki/items has
  //     no reason to carry every mod.
  //
  // *-index.json is NOT excluded (2026-08-22 fix): src/lib/wiki/mentions.ts
  // reads all three kinds' index files server-side, on every detail page
  // (loadMentionIndex, for cross-page name-mention linking), regardless of
  // which of the three routes is rendering — confirmed live in production
  // via Vercel runtime error logs (ENOENT on skill-index.json from
  // /wiki/items/[slug] and /wiki/skills/[slug]) after this same exclusion
  // silently dropped them from the bundle. Before re-excluding these again,
  // `grep -rn "index.json" src` and confirm nothing server-side still reads
  // them — the same check this comment asked for last time, which is
  // exactly the step that got skipped and broke production.
  //
  // Gate for any change here: the `files` count in
  // .next/server/app/wiki/*/[slug]/page.js.nft.json after a build. A green
  // `next build` does not prove this is right — it was green when the
  // functions were 211MB, and green again the day this exclusion broke
  // every wiki detail page in production.
  // -------------------------------------------------------------------------
  // PLATFORM NOTE: these excludes apply on Linux (what Vercel builds on) but
  // are inert on a Windows build. Next resolves each value with
  // `path.join(projectDir, value)` before handing it to picomatch
  // (next/dist/build/collect-build-traces.js), which on Windows yields a
  // backslash pattern that picomatch cannot match — verified directly
  // against Next's own bundled picomatch. Nothing in this config can work
  // around it; the values below are correct for the deploy target.
  //
  // So don't read a local Windows nft.json count as proof this is broken,
  // and don't rely on these excludes as the only thing keeping the function
  // under the limit — the icon downscale in scripts/sync-wiki.ts is what
  // actually does that (211MB -> ~47MB, under the cap on either platform).
  // These trim it further, to ~10MB, on the platform that deploys.
  outputFileTracingExcludes: {
    '/wiki/**': [
      './public/data/wiki/**/icons/**',
    ],
    '/wiki/items/*': [
      './public/data/wiki/**/skills/**',
      './public/data/wiki/**/mods/**',
    ],
    '/wiki/skills/*': [
      './public/data/wiki/**/items/**',
      './public/data/wiki/**/mods/**',
    ],
    '/wiki/mods/*': [
      './public/data/wiki/**/items/**',
      './public/data/wiki/**/skills/**',
    ],
  },

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
      // -----------------------------------------------------------------
      // The two rules below are mutually exclusive by construction — each
      // is scoped to its own path prefix (`/data/wiki/`, `/data/tree/`)
      // rather than one of them being a catch-all for "everything else
      // under /data/". Next applies every matching rule, and depending on
      // ordering semantics an overlapping `immutable` would quietly win
      // over this one.
      //
      // SECURITY: the second rule below used to be a denylist —
      // `/data/:filename((?!wiki/).*)`, i.e. "everything under /data/
      // except /data/wiki/**" — instead of the allowlist it is now
      // (2026-08-21 security review, round 2). `headers()` rule matching
      // happens on the RAW, non-percent-decoded pathname, same as the
      // src/proxy.ts matcher (see that file's comments). A request to
      // `/data/%77iki/2026-08-21/item-index.json` (percent-encoded "wiki")
      // does not literally match `wiki/` in the negative lookahead, so a
      // denylist rule here would apply its `public, max-age=1y, immutable`
      // caching to gated wiki bytes — worse than the original bug this file
      // was first patched for, since `fsChecker.headers` in Next's pipeline
      // runs before middleware, so even the anonymous 307-to-/login would
      // carry that header. An allowlist scoped to `/data/tree/:path*` (the
      // one thing actually meant to get this treatment, matching how the
      // proxy matcher itself already scopes its tree exclusion) means any
      // path that isn't a literal, undecoded `/data/tree/...` — including
      // every percent-encoded spelling of a wiki path — falls through to
      // Next's own conservative default instead of matching either rule.
      // Do not widen this back to a denylist.
      //
      // The wiki cannot use the immutable rule. Its path segment is
      // WIKI_DATA_VERSION, a hand-bumped constant that the weekly sync does
      // not touch — so a refresh overwrites icons and JSON in place at the
      // same URL. Under `immutable, max-age=1y` a re-synced icon would keep
      // serving the old bytes from browser and CDN caches for a year.
      //
      // MUST be `private`, not `public`, and MUST NOT set `s-maxage`. This
      // path is auth-gated by src/proxy.ts (2026-08-21 security review) —
      // both the 200 JSON response for a signed-in user and the 307-to-
      // /login redirect for an anonymous one share this Cache-Control rule
      // (Next applies header rules by path, not by response status), and
      // there is no `Vary: Cookie` to split the cache key by auth state. A
      // `public`/`s-maxage` value lets a shared cache (a CDN, or any
      // intermediary) serve a cached 200 payload to a different,
      // unauthenticated visitor, or serve a cached 307 to a signed-in one.
      // `private` restricts caching to the requesting browser's own cache,
      // which is scoped per-origin per-profile and goes stale the moment
      // the auth cookie is gone — still imperfect (a signed-out browser can
      // keep serving its own stale cached copy until `max-age` elapses,
      // which is why `max-age` here is 1 hour, not a day) but not shared
      // across users the way `public` + a CDN would be.
      //
      // A day of shared caching with stale-while-revalidate matches the
      // sync's weekly cadence and the detail pages' own `revalidate`.
      // If WIKI_DATA_VERSION ever does get bumped per sync, this can go
      // back to immutable — but must stay `private`, never `public`, as
      // long as this path requires auth.
      // -----------------------------------------------------------------
      {
        source: '/data/wiki/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=3600, stale-while-revalidate=604800',
          },
        ],
      },
      {
        // Allowlist, not "everything under /data except wiki" — see the
        // SECURITY note above. Public, unauthenticated, versioned-by-path
        // passive-tree assets only.
        source: '/data/tree/:path*',
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