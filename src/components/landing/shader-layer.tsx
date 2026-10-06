'use client'

// The only module that imports `shaders`. Reached solely through
// hero-backdrop.tsx's dynamic import, so the WebGPU engine (typegpu) stays out
// of every route's bundle — and out of the server render — until a browser that
// can use it has asked for it.
import { FilmGrain, FlowingGradient, Shader } from 'shaders/react'

type ShaderLayerProps = {
  onReady: () => void
  onUnavailable: (reason: unknown) => void
}

export default function ShaderLayer({ onReady, onUnavailable }: ShaderLayerProps) {
  return (
    // disableTelemetry: `shaders` reports usage by default. The privacy page
    // promises no third-party calls from the landing page, and the e2e spec
    // asserts it — do not remove this prop.
    <Shader
      disableTelemetry
      onReady={onReady}
      onUnavailable={onUnavailable}
      className="absolute inset-0 h-full w-full"
    >
      <FlowingGradient colorA="#1a1610" colorB="#d6a23a" colorC="#c23a32" colorD="#3f8fb5" />
      <FilmGrain strength={0.14} />
    </Shader>
  )
}
