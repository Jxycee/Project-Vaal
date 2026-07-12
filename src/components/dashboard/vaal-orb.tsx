'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

type VaalOrbProps = {
  className?: string
}

type FlameWisp = {
  sprite: THREE.Sprite
  material: THREE.SpriteMaterial
  angle: number
  radius: number
  speed: number
  phase: number
  width: number
  height: number
  z: number
  radialTravel: number
  rise: number
  curl: number
  baseOpacity: number
}

type Spark = {
  speed: number
  drift: number
  life: number
  maxLife: number
  z: number
}

function createFlameTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 512

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const tipShift = [-26, 8, 30][variant % 3]
  const sideShift = [24, -18, 10][variant % 3]

  context.clearRect(0, 0, canvas.width, canvas.height)
  context.globalCompositeOperation = 'lighter'

  const outerGradient = context.createLinearGradient(128, 500, 128, 18)
  outerGradient.addColorStop(0, 'rgba(120,0,0,0)')
  outerGradient.addColorStop(0.12, 'rgba(210,12,0,0.28)')
  outerGradient.addColorStop(0.42, 'rgba(255,48,4,0.82)')
  outerGradient.addColorStop(0.72, 'rgba(255,126,24,0.6)')
  outerGradient.addColorStop(1, 'rgba(255,190,78,0)')

  context.save()
  context.fillStyle = outerGradient
  context.shadowColor = 'rgba(255,38,0,0.8)'
  context.shadowBlur = 26
  context.beginPath()
  context.moveTo(128, 506)
  context.bezierCurveTo(42, 456, 30, 354, 92, 260)
  context.bezierCurveTo(63, 188, 102, 96, 128 + tipShift, 10)
  context.bezierCurveTo(150 + tipShift, 118, 224, 182, 180, 286)
  context.bezierCurveTo(226, 382, 204, 468, 128, 506)
  context.closePath()
  context.fill()
  context.restore()

  const sideGradient = context.createLinearGradient(100, 432, 168, 92)
  sideGradient.addColorStop(0, 'rgba(255,40,0,0)')
  sideGradient.addColorStop(0.3, 'rgba(255,54,3,0.42)')
  sideGradient.addColorStop(0.72, 'rgba(255,118,20,0.42)')
  sideGradient.addColorStop(1, 'rgba(255,170,52,0)')

  context.save()
  context.fillStyle = sideGradient
  context.shadowColor = 'rgba(255,30,0,0.55)'
  context.shadowBlur = 18
  context.beginPath()
  context.moveTo(118, 466)
  context.bezierCurveTo(68, 390, 96 + sideShift, 314, 146 + sideShift, 242)
  context.bezierCurveTo(122 + sideShift, 202, 142 + sideShift, 150, 176 + sideShift, 106)
  context.bezierCurveTo(178 + sideShift, 186, 210 + sideShift, 256, 166, 326)
  context.bezierCurveTo(184, 394, 166, 448, 118, 466)
  context.closePath()
  context.fill()
  context.restore()

  const coreGradient = context.createLinearGradient(128, 478, 128, 112)
  coreGradient.addColorStop(0, 'rgba(255,82,4,0)')
  coreGradient.addColorStop(0.2, 'rgba(255,104,12,0.82)')
  coreGradient.addColorStop(0.52, 'rgba(255,205,108,0.96)')
  coreGradient.addColorStop(0.78, 'rgba(255,246,205,0.72)')
  coreGradient.addColorStop(1, 'rgba(255,255,255,0)')

  context.save()
  context.fillStyle = coreGradient
  context.shadowColor = 'rgba(255,168,52,0.7)'
  context.shadowBlur = 12
  context.beginPath()
  context.moveTo(128, 480)
  context.bezierCurveTo(84, 420, 94, 322, 124, 252)
  context.bezierCurveTo(107, 198, 126, 148, 146 + tipShift * 0.22, 96)
  context.bezierCurveTo(158, 178, 186, 246, 158, 324)
  context.bezierCurveTo(176, 404, 164, 456, 128, 480)
  context.closePath()
  context.fill()
  context.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createWispTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 512

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const bend = variant % 2 === 0 ? 34 : -34
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.globalCompositeOperation = 'lighter'
  context.lineCap = 'round'

  const outer = context.createLinearGradient(96, 500, 96, 16)
  outer.addColorStop(0, 'rgba(150,0,0,0)')
  outer.addColorStop(0.16, 'rgba(255,28,0,0.28)')
  outer.addColorStop(0.55, 'rgba(255,64,6,0.7)')
  outer.addColorStop(0.82, 'rgba(255,132,28,0.42)')
  outer.addColorStop(1, 'rgba(255,180,64,0)')

  context.save()
  context.strokeStyle = outer
  context.lineWidth = 38
  context.shadowColor = 'rgba(255,28,0,0.75)'
  context.shadowBlur = 28
  context.beginPath()
  context.moveTo(96, 500)
  context.bezierCurveTo(46, 414, 146, 340, 94 + bend, 252)
  context.bezierCurveTo(46 + bend, 176, 148 - bend, 104, 96 + bend * 0.35, 14)
  context.stroke()
  context.restore()

  const inner = context.createLinearGradient(96, 478, 96, 84)
  inner.addColorStop(0, 'rgba(255,84,8,0)')
  inner.addColorStop(0.3, 'rgba(255,126,26,0.7)')
  inner.addColorStop(0.68, 'rgba(255,220,130,0.72)')
  inner.addColorStop(1, 'rgba(255,255,225,0)')

  context.save()
  context.strokeStyle = inner
  context.lineWidth = 11
  context.shadowColor = 'rgba(255,156,48,0.7)'
  context.shadowBlur = 10
  context.beginPath()
  context.moveTo(96, 478)
  context.bezierCurveTo(60, 392, 132, 326, 98 + bend * 0.65, 246)
  context.bezierCurveTo(62 + bend * 0.5, 174, 132 - bend * 0.45, 116, 100 + bend * 0.25, 72)
  context.stroke()
  context.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createSparkTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, 'rgba(255,255,225,1)')
  gradient.addColorStop(0.22, 'rgba(255,152,46,0.96)')
  gradient.addColorStop(0.58, 'rgba(255,38,4,0.48)')
  gradient.addColorStop(1, 'rgba(255,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createGlowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(255,42,6,0.28)')
  gradient.addColorStop(0.42, 'rgba(190,8,0,0.1)')
  gradient.addColorStop(1, 'rgba(100,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

export function VaalOrb({ className = '' }: VaalOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0, 3.45)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.04
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'none'
    container.appendChild(renderer.domElement)

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment
    pmremGenerator.dispose()

    scene.add(new THREE.HemisphereLight(0xffead0, 0x100604, 1.05))

    const keyLight = new THREE.DirectionalLight(0xfff4df, 5.6)
    keyLight.position.set(4.2, 3.8, 5.4)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xc4d4ff, 1.45)
    fillLight.position.set(-3.4, -1.2, 4.2)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xff3a10, 1.25)
    rimLight.position.set(-3.2, 2.2, -4.5)
    scene.add(rimLight)

    const highlightLight = new THREE.PointLight(0xffffff, 15, 7, 2)
    highlightLight.position.set(2.3, 1.5, 3.2)
    scene.add(highlightLight)

    const fireLight = new THREE.PointLight(0xff2d08, 2.4, 4.6, 2)
    fireLight.position.set(0, 0, -0.7)
    scene.add(fireLight)

    const orbGroup = new THREE.Group()
    scene.add(orbGroup)

    const flameTextures = [0, 1, 2].map(createFlameTexture)
    const wispTextures = [0, 1].map(createWispTexture)
    const sparkTexture = createSparkTexture()
    const glowTexture = createGlowTexture()

    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff1d05,
      transparent: true,
      opacity: 0.045,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const backGlow = new THREE.Sprite(glowMaterial)
    backGlow.position.set(0, 0, -0.82)
    backGlow.scale.set(2.42, 2.42, 1)
    scene.add(backGlow)

    const fireGroup = new THREE.Group()
    fireGroup.position.z = -0.4
    scene.add(fireGroup)

    const flames: FlameWisp[] = []

    const addFlame = (index: number, count: number, outer: boolean) => {
      const angle = (index / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.16
      const texture = outer
        ? wispTextures[index % wispTextures.length]
        : flameTextures[index % flameTextures.length]
      const palette = outer
        ? [0xff2004, 0xff3b08, 0xff6818]
        : [0xff3006, 0xff5a10, 0xff8a26]
      const material = new THREE.SpriteMaterial({
        map: texture,
        color: palette[index % palette.length],
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
      const sprite = new THREE.Sprite(material)
      const width = outer ? 0.045 + Math.random() * 0.055 : 0.075 + Math.random() * 0.075
      const height = outer ? 0.42 + Math.random() * 0.34 : 0.24 + Math.random() * 0.24

      sprite.scale.set(width, height, 1)
      fireGroup.add(sprite)

      flames.push({
        sprite,
        material,
        angle,
        radius: outer ? 1.08 + Math.random() * 0.09 : 1.01 + Math.random() * 0.075,
        speed: outer ? 0.16 + Math.random() * 0.18 : 0.25 + Math.random() * 0.28,
        phase: Math.random(),
        width,
        height,
        z: outer ? -0.06 + Math.random() * 0.08 : -0.02 + Math.random() * 0.1,
        radialTravel: outer ? 0.3 + Math.random() * 0.18 : 0.17 + Math.random() * 0.16,
        rise: outer ? 0.14 + Math.random() * 0.14 : 0.06 + Math.random() * 0.09,
        curl: outer ? 0.055 + Math.random() * 0.055 : 0.018 + Math.random() * 0.035,
        baseOpacity: outer ? 0.12 + Math.random() * 0.07 : 0.2 + Math.random() * 0.11,
      })
    }

    const innerFlameCount = 46
    const outerWispCount = 24
    for (let index = 0; index < innerFlameCount; index += 1) {
      addFlame(index, innerFlameCount, false)
    }
    for (let index = 0; index < outerWispCount; index += 1) {
      addFlame(index, outerWispCount, true)
    }

    const sparkCount = 92
    const sparkPositions = new Float32Array(sparkCount * 3)
    const sparks: Spark[] = []

    const resetSpark = (index: number, initial: boolean) => {
      const angle = Math.random() * Math.PI * 2
      const radius = 1 + Math.random() * 0.3
      const maxLife = 1.2 + Math.random() * 2.1
      const life = initial ? Math.random() * maxLife : maxLife

      sparks[index] = {
        speed: 0.16 + Math.random() * 0.3,
        drift: (Math.random() - 0.5) * 0.12,
        life,
        maxLife,
        z: -0.24 + Math.random() * 0.3,
      }

      sparkPositions[index * 3] = Math.cos(angle) * radius
      sparkPositions[index * 3 + 1] = Math.sin(angle) * radius
      sparkPositions[index * 3 + 2] = sparks[index].z
    }

    for (let index = 0; index < sparkCount; index += 1) resetSpark(index, true)

    const sparkGeometry = new THREE.BufferGeometry()
    const sparkPositionAttribute = new THREE.BufferAttribute(sparkPositions, 3)
    sparkGeometry.setAttribute('position', sparkPositionAttribute)

    const sparkMaterial = new THREE.PointsMaterial({
      map: sparkTexture,
      color: 0xff5718,
      size: 0.026,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.42,
      alphaTest: 0.02,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const sparkPoints = new THREE.Points(sparkGeometry, sparkMaterial)
    sparkPoints.position.z = -0.22
    scene.add(sparkPoints)

    let loadedScene: THREE.Object3D | null = null
    const loader = new GLTFLoader()
    loader.load(
      '/models/vaal-orb.glb',
      (gltf) => {
        if (disposed) return
        loadedScene = gltf.scene

        loadedScene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return

          object.castShadow = false
          object.receiveShadow = false

          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            if (!(material instanceof THREE.MeshStandardMaterial)) return

            material.metalness = 0.8
            material.roughness = 0.33
            material.envMapIntensity = 2.25
            material.side = THREE.DoubleSide

            if (material.map) {
              material.map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
            }

            material.needsUpdate = true
          })
        })

        const bounds = new THREE.Box3().setFromObject(loadedScene)
        const sphere = bounds.getBoundingSphere(new THREE.Sphere())
        const center = bounds.getCenter(new THREE.Vector3())

        loadedScene.position.copy(center).multiplyScalar(-1)
        orbGroup.scale.setScalar(1.14 / Math.max(sphere.radius, 0.001))
        orbGroup.add(loadedScene)
        orbGroup.rotation.x = -0.03

        setStatus('ready')
      },
      undefined,
      () => {
        if (!disposed) setStatus('error')
      }
    )

    let dragging = false
    let dragPointerId: number | null = null
    let dragStartX = 0
    let dragStartRotation = 0
    let previousPointerX = 0
    let previousPointerTime = 0
    let rotationTarget = 0
    let rotationCurrent = 0
    let angularVelocity = 0

    const handlePointerDown = (event: PointerEvent) => {
      dragging = true
      dragPointerId = event.pointerId
      dragStartX = event.clientX
      dragStartRotation = rotationTarget
      previousPointerX = event.clientX
      previousPointerTime = performance.now()
      angularVelocity = 0
      container.setPointerCapture(event.pointerId)
      renderer.domElement.style.cursor = 'grabbing'
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== dragPointerId) return

      const width = Math.max(container.getBoundingClientRect().width, 1)
      const radiansPerPixel = (Math.PI * 2.2) / width
      rotationTarget = dragStartRotation + (event.clientX - dragStartX) * radiansPerPixel

      const now = performance.now()
      const elapsedSeconds = Math.max((now - previousPointerTime) / 1000, 0.001)
      angularVelocity = THREE.MathUtils.clamp(
        ((event.clientX - previousPointerX) * radiansPerPixel) / elapsedSeconds,
        -8,
        8
      )
      previousPointerX = event.clientX
      previousPointerTime = now
    }

    const finishDrag = (event: PointerEvent) => {
      if (event.pointerId !== dragPointerId) return
      dragging = false
      dragPointerId = null
      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId)
      }
      renderer.domElement.style.cursor = 'grab'
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerup', finishDrag)
    container.addEventListener('pointercancel', finishDrag)

    const resize = () => {
      const width = Math.max(container.clientWidth, 1)
      const height = Math.max(container.clientHeight, 1)
      renderer.setSize(width, height, false)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    resize()

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const clock = new THREE.Clock()
    let animationFrame = 0

    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05)
      const elapsed = clock.elapsedTime
      const pulse = 0.5 + Math.sin(elapsed * 3.1) * 0.5

      if (!dragging && !reducedMotion) {
        rotationTarget += angularVelocity * delta
        angularVelocity *= Math.pow(0.035, delta)
        if (Math.abs(angularVelocity) < 0.002) angularVelocity = 0
      }

      rotationCurrent = THREE.MathUtils.damp(rotationCurrent, rotationTarget, 11, delta)
      orbGroup.rotation.y = rotationCurrent
      orbGroup.rotation.x = -0.03
      orbGroup.position.y = reducedMotion ? 0 : Math.sin(elapsed * 0.78) * 0.025

      if (!reducedMotion) {
        fireGroup.rotation.z = Math.sin(elapsed * 0.22) * 0.014
        sparkPoints.rotation.z = -elapsed * 0.01
      }

      highlightLight.position.x = Math.sin(elapsed * 0.45) * 2.35
      highlightLight.position.y = 1.25 + Math.cos(elapsed * 0.36) * 0.55
      fireLight.intensity = 1.9 + pulse * 1.6
      glowMaterial.opacity = 0.026 + pulse * 0.018
      backGlow.scale.setScalar(2.34 + pulse * 0.08)

      flames.forEach((flame) => {
        const cycle = (elapsed * flame.speed + flame.phase) % 1
        const fade = Math.pow(Math.sin(Math.PI * cycle), 1.55)
        const fastFlicker = 0.76 + Math.sin(elapsed * 10.4 + flame.phase * 19) * 0.18
        const slowFlicker = 0.88 + Math.sin(elapsed * 2.8 + flame.phase * 7) * 0.12
        const flicker = fastFlicker * slowFlicker
        const angle = flame.angle + Math.sin(elapsed * 1.45 + flame.phase * 9) * flame.curl
        const radius = flame.radius + cycle * flame.radialTravel
        const sidewaysCurl = Math.sin(elapsed * 3.2 + flame.phase * 13) * flame.curl * cycle

        flame.sprite.position.set(
          Math.cos(angle) * radius + Math.cos(angle + Math.PI / 2) * sidewaysCurl,
          Math.sin(angle) * radius + cycle * flame.rise,
          flame.z
        )
        flame.sprite.scale.set(
          flame.width * (1 - cycle * 0.4) * flicker,
          flame.height * (0.62 + cycle * 1.5) * (0.9 + slowFlicker * 0.1),
          1
        )
        flame.material.rotation =
          angle - Math.PI / 2 + Math.sin(elapsed * 2.2 + flame.phase * 6) * 0.09
        flame.material.opacity = fade * flicker * flame.baseOpacity
      })

      if (!reducedMotion) {
        for (let index = 0; index < sparkCount; index += 1) {
          const spark = sparks[index]
          spark.life -= delta

          if (spark.life <= 0) {
            resetSpark(index, false)
            continue
          }

          const lifeProgress = 1 - spark.life / spark.maxLife
          sparkPositions[index * 3] += spark.drift * delta * (0.6 + lifeProgress)
          sparkPositions[index * 3 + 1] += spark.speed * delta * (0.7 + lifeProgress * 1.2)
          sparkPositions[index * 3 + 2] = spark.z
        }
        sparkPositionAttribute.needsUpdate = true
      }

      sparkMaterial.opacity = 0.2 + pulse * 0.2

      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(render)
    }

    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      container.removeEventListener('pointerdown', handlePointerDown)
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerup', finishDrag)
      container.removeEventListener('pointercancel', finishDrag)

      if (loadedScene) {
        loadedScene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return
          object.geometry.dispose()
          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            if (material instanceof THREE.MeshStandardMaterial) {
              material.map?.dispose()
              material.metalnessMap?.dispose()
              material.roughnessMap?.dispose()
              material.normalMap?.dispose()
            }
            material.dispose()
          })
        })
      }

      flames.forEach(({ material }) => material.dispose())
      sparkGeometry.dispose()
      sparkMaterial.dispose()
      glowMaterial.dispose()
      flameTextures.forEach((texture) => texture.dispose())
      wispTextures.forEach((texture) => texture.dispose())
      sparkTexture.dispose()
      glowTexture.dispose()
      environment.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-visible select-none touch-none ${className}`}
      role="img"
      aria-label="A metallic Vaal emblem surrounded by flickering fire wisps. Drag horizontally to rotate it."
    >
      {status === 'loading' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Awakening relic
        </div>
      )}

      {status === 'error' && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
          The Vaal relic could not be loaded.
        </div>
      )}
    </div>
  )
}
