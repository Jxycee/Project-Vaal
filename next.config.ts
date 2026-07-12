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