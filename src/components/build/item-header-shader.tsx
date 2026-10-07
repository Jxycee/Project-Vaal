'use client'

// The only module on the build page that imports `shaders`. Reached solely
// through ItemCard's dynamic import, so the WebGPU engine (typegpu) stays out
// of every route's bundle, and out of the server render, until a unique item's
// card opens in a browser that can run it.
//
// Deliberately quiet: it fills the card's HEADER strip only, never the stats
// below it. A slow bronze haze with a few embers, dark enough that the item
// name stays the brightest thing in it. The attention belongs on the mods.
import { FloatingParticles, Godrays, Shader, Vignette } from 'shaders/react'

export default function ItemHeaderShader({ onReady, onUnavailable }: { onReady: () => void; onUnavailable: (reason: unknown) => void }) {
  return (
    // disableTelemetry: `shaders` reports usage by default. The privacy page
    // promises no third-party calls from the app; do not remove this prop.
    <Shader disableTelemetry onReady={onReady} onUnavailable={onUnavailable} className="absolute inset-0 h-full w-full">
      <Godrays center={{ x: 0.5, y: 1.1 }} density={0.3} intensity={0.14} spotty={0.8} speed={0.06} rayColor="#a8731f" backgroundColor="#0a0807" />
      <FloatingParticles
        count={14}
        speed={0.12}
        angle={-90}
        angleVariance={30}
        speedVariance={0.5}
        randomness={0.6}
        twinkle={0.5}
        particleSize={1.6}
        softness={0.9}
        shape="circle"
        particleColor="#d9772a"
      />
      <Vignette color="#110e0b" radius={0.5} falloff={0.8} intensity={1} />
    </Shader>
  )
}
