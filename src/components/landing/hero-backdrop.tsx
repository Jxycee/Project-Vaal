'use client'

// Decorative landing-hero backdrop. Layers, bottom to top:
//   1. a CSS gradient + grain fallback, always painted (SSR included), so a
//      browser without WebGPU — where the shader canvas stays transparent for
//      good — looks finished rather than blank;
//   2. the WebGPU shader, mounted only after the client confirms it can run it.
//
// The shader is skipped, and its chunk never requested, when `navigator.gpu` is
// missing or the user prefers reduced motion. Both checks happen in an effect,
// never during render, so server and client markup stay identical.
//
// `?backdrop=debug` adds a corner label naming the branch that is running —
// the only way to tell on a phone, where "the shader did nothing" and "this
// device has no WebGPU" look identical.
import dynamic from 'next/dynamic'
import { useState, useSyncExternalStore } from 'react'

const ShaderLayer = dynamic(() => import('./shader-layer'), { ssr: false })

const REDUCED = '(prefers-reduced-motion: reduce)'

// Browser capabilities are external state: read through useSyncExternalStore so
// the server (and the hydration pass) see "no shader" and the client switches
// over afterwards, with no setState-in-effect and no hydration mismatch.
const subscribeReduced = (cb: () => void) => {
  const query = window.matchMedia(REDUCED)
  query.addEventListener('change', cb)
  return () => query.removeEventListener('change', cb)
}
const noSubscribe = () => () => {}

type Capability = 'pending' | 'no-gpu' | 'reduced' | 'ok'

function useCapability(): Capability {
  const reduced = useSyncExternalStore(
    subscribeReduced,
    () => window.matchMedia(REDUCED).matches,
    () => false,
  )
  const hasGpu = useSyncExternalStore(
    noSubscribe,
    () => 'gpu' in navigator && !!(navigator as { gpu?: unknown }).gpu,
    () => false,
  )
  const hydrated = useSyncExternalStore(noSubscribe, () => true, () => false)
  if (!hydrated) return 'pending'
  if (!hasGpu) return 'no-gpu'
  return reduced ? 'reduced' : 'ok'
}

export function HeroBackdrop() {
  const capability = useCapability()
  const debug = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get('backdrop') === 'debug',
    () => false,
  )
  const [ready, setReady] = useState(false)
  const [unavailable, setUnavailable] = useState<string | null>(null)

  const shaderOn = capability === 'ok' && unavailable === null
  const status =
    capability === 'reduced'
      ? 'css · reduced motion'
      : capability === 'ok'
        ? unavailable !== null
          ? `css · shader unavailable (${unavailable})`
          : ready
            ? 'shader · live'
            : 'shader · loading'
        : 'css · no webgpu'

  return (
    <>
      <div
        data-testid="hero-backdrop"
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden bg-background"
      >
        <div
          className="hero-drift absolute -left-[30%] -top-[20%] h-[85vmax] w-[85vmax] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(222,160,48,0.85), transparent 66%)' }}
        />
        <div
          className="hero-drift absolute -right-[35%] top-[5%] h-[85vmax] w-[85vmax] rounded-full [animation-delay:-6s]"
          style={{ background: 'radial-gradient(circle, rgba(196,48,40,0.8), transparent 64%)' }}
        />
        <div
          className="hero-drift absolute -bottom-[30%] left-[10%] h-[75vmax] w-[75vmax] rounded-full [animation-delay:-12s]"
          style={{ background: 'radial-gradient(circle, rgba(52,130,180,0.7), transparent 66%)' }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-30 mix-blend-overlay">
          <filter id="hero-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#hero-grain)" />
        </svg>
        {/* Light veil, heaviest at the bottom where the small print sits. */}
        <div className="absolute inset-0 bg-gradient-to-b from-background/0 via-background/15 to-background/70" />

        {shaderOn && (
          // mix-blend-screen: black adds nothing, so a shader that renders blank
          // (software GPU, lost device) leaves the CSS fallback visible instead of
          // painting an opaque black sheet over it.
          <div
            className="absolute inset-0 mix-blend-screen transition-opacity duration-1000"
            style={{ opacity: ready ? 1 : 0 }}
          >
            <ShaderLayer
              onReady={() => setReady(true)}
              onUnavailable={(reason) => setUnavailable(String(reason))}
            />
          </div>
        )}
      </div>

      {debug && (
        <p
          data-testid="hero-backdrop-status"
          className="fixed bottom-2 right-2 z-50 rounded bg-black/70 px-2 py-1 font-mono text-[0.65rem] text-white"
        >
          {status}
        </p>
      )}
    </>
  )
}
