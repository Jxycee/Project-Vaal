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
import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'

const ShaderLayer = dynamic(() => import('./shader-layer'), { ssr: false })

export function HeroBackdrop() {
  const [shaderOn, setShaderOn] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const hasGpu = 'gpu' in navigator && !!(navigator as { gpu?: unknown }).gpu
    const sync = () => {
      const on = hasGpu && !query.matches
      setShaderOn(on)
      if (!on) setReady(false)
    }
    sync()
    query.addEventListener('change', sync)
    return () => query.removeEventListener('change', sync)
  }, [])

  return (
    <div
      data-testid="hero-backdrop"
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
      <div
        className="hero-drift absolute -left-1/4 -top-1/3 h-[80vmax] w-[80vmax] rounded-full opacity-60 blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(214,178,94,0.5), transparent 68%)' }}
      />
      <div
        className="hero-drift absolute -right-1/4 top-0 h-[80vmax] w-[80vmax] rounded-full opacity-50 blur-3xl [animation-delay:-6s]"
        style={{ background: 'radial-gradient(circle, rgba(176,51,47,0.55), transparent 66%)' }}
      />
      <div
        className="hero-drift absolute -bottom-1/2 left-1/4 h-[70vmax] w-[70vmax] rounded-full opacity-40 blur-3xl [animation-delay:-12s]"
        style={{ background: 'radial-gradient(circle, rgba(63,111,138,0.5), transparent 68%)' }}
      />
      <svg className="absolute inset-0 h-full w-full opacity-25 mix-blend-overlay">
        <filter id="hero-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#hero-grain)" />
      </svg>
      {/* Keeps the copy legible whatever the backdrop is doing. */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 to-background/85" />

      {shaderOn && (
        // mix-blend-screen: black adds nothing, so a shader that renders blank
        // (software GPU, lost device) leaves the CSS fallback visible instead of
        // painting an opaque black sheet over it.
        <div
          className="absolute inset-0 mix-blend-screen transition-opacity duration-1000"
          style={{ opacity: ready ? 0.9 : 0 }}
        >
          <ShaderLayer onReady={() => setReady(true)} />
        </div>
      )}
    </div>
  )
}
