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
