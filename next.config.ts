import type { NextConfig } from 'next'

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

export default nextConfig