'use client'

// Client boundary for VaalOrb's dynamic import. VaalOrb pulls in three.js +
// GLTFLoader (a heavy chunk) and only runs in the browser (WebGL canvas), so
// it's loaded with ssr: false — that requires next/dynamic to be called from
// a client component, not the server-rendered dashboard page.
import dynamic from 'next/dynamic'

type VaalOrbLoaderProps = {
  className?: string
}

const VaalOrb = dynamic(() => import('./vaal-orb').then((m) => m.VaalOrb), {
  ssr: false,
  loading: () => (
    <div
      className="relative h-full w-full overflow-visible select-none"
      role="img"
      aria-label="A metallic Vaal emblem with fire embers rising from the ember bed below it. Drag horizontally to rotate it."
    >
      <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
        Awakening relic
      </div>
    </div>
  ),
})

export function VaalOrbLoader({ className }: VaalOrbLoaderProps) {
  return <VaalOrb className={className} />
}
