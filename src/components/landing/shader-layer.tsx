'use client'

// The only module that imports `shaders`. Reached solely through
// hero-backdrop.tsx's dynamic import, so the WebGPU engine (typegpu) stays out
// of every route's bundle — and out of the server render — until a browser that
// can use it has asked for it.
import { FilmGrain, FlowingGradient, Shader } from 'shaders/react'

type ShaderLayerProps = {
  onReady: () => void
}

export default function ShaderLayer({ onReady }: ShaderLayerProps) {
  return (
    // disableTelemetry: `shaders` reports usage by default. The privacy page
    // promises no third-party calls from the landing page, and the e2e spec
    // asserts it — do not remove this prop.
    <Shader disableTelemetry onReady={onReady} className="absolute inset-0 h-full w-full">
      <FlowingGradient colorA="#12100c" colorB="#8c6a2a" colorC="#8a2b27" colorD="#2f5870" />
      <FilmGrain strength={0.12} />
    </Shader>
  )
}
