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
  outward: number
  rise: number
  sway: number
  opacity: number
}

type Cinder = {
  vx: number
  vy: number
  life: number
  maxLife: number
  phase: number
  z: number
}

function createFlameTexture(variant: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 192
  canvas.height = 384

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const bend = [-20, 8, 24][variant % 3]
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.globalCompositeOperation = 'lighter'

  const outer = context.createLinearGradient(96, 376, 96, 8)
  outer.addColorStop(0, 'rgba(110,0,0,0)')
  outer.addColorStop(0.08, 'rgba(190,8,0,0.24)')
  outer.addColorStop(0.38, 'rgba(255,42,3,0.78)')
  outer.addColorStop(0.7, 'rgba(255,112,18,0.54)')
  outer.addColorStop(1, 'rgba(255,176,54,0)')

  context.save()
  context.fillStyle = outer
  context.shadowColor = 'rgba(255,34,0,0.72)'
  context.shadowBlur = 22
  context.beginPath()
  context.moveTo(96, 380)
  context.bezierCurveTo(38, 344, 40, 264, 78, 196)
  context.bezierCurveTo(52, 132, 82, 70, 96 + bend, 6)
  context.bezierCurveTo(118 + bend, 90, 164, 142, 132, 214)
  context.bezierCurveTo(168, 286, 154, 354, 96, 380)
  context.closePath()
  context.fill()
  context.restore()

  const core = context.createLinearGradient(96, 356, 96, 64)
  core.addColorStop(0, 'rgba(255,70,4,0)')
  core.addColorStop(0.2, 'rgba(255,104,12,0.72)')
  core.addColorStop(0.52, 'rgba(255,202,100,0.88)')
  core.addColorStop(0.78, 'rgba(255,242,194,0.58)')
  core.addColorStop(1, 'rgba(255,255,238,0)')

  context.save()
  context.fillStyle = core
  context.shadowColor = 'rgba(255,148,38,0.58)'
  context.shadowBlur = 10
  context.beginPath()
  context.moveTo(96, 356)
  context.bezierCurveTo(68, 306, 74, 238, 94, 184)
  context.bezierCurveTo(82, 138, 96, 96, 108 + bend * 0.18, 58)
  context.bezierCurveTo(120, 126, 138, 186, 118, 240)
  context.bezierCurveTo(134, 302, 124, 342, 96, 356)
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
  canvas.width = 128
  canvas.height = 512

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const bend = variant % 2 === 0 ? 28 : -28
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.globalCompositeOperation = 'lighter'
  context.lineCap = 'round'

  const outer = context.createLinearGradient(64, 500, 64, 12)
  outer.addColorStop(0, 'rgba(140,0,0,0)')
  outer.addColorStop(0.12, 'rgba(238,22,0,0.2)')
  outer.addColorStop(0.5, 'rgba(255,54,4,0.6)')
  outer.addColorStop(0.78, 'rgba(255,118,22,0.34)')
  outer.addColorStop(1, 'rgba(255,174,62,0)')

  context.save()
  context.strokeStyle = outer
  context.lineWidth = 27
  context.shadowColor = 'rgba(255,28,0,0.62)'
  context.shadowBlur = 22
  context.beginPath()
  context.moveTo(64, 500)
  context.bezierCurveTo(28, 420, 104, 350, 62 + bend, 270)
  context.bezierCurveTo(26 + bend, 196, 98 - bend, 116, 64 + bend * 0.35, 12)
  context.stroke()
  context.restore()

  const inner = context.createLinearGradient(64, 486, 64, 72)
  inner.addColorStop(0, 'rgba(255,80,7,0)')
  inner.addColorStop(0.28, 'rgba(255,120,24,0.5)')
  inner.addColorStop(0.68, 'rgba(255,212,116,0.52)')
  inner.addColorStop(1, 'rgba(255,255,226,0)')

  context.save()
  context.strokeStyle = inner
  context.lineWidth = 8
  context.shadowColor = 'rgba(255,154,46,0.52)'
  context.shadowBlur = 8
  context.beginPath()
  context.moveTo(64, 486)
  context.bezierCurveTo(38, 404, 92, 340, 66 + bend * 0.62, 264)
  context.bezierCurveTo(38 + bend * 0.45, 194, 92 - bend * 0.4, 122, 66 + bend * 0.2, 70)
  context.stroke()
  context.restore()

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createCinderTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 32
  canvas.height = 32

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16)
  gradient.addColorStop(0, 'rgba(255,255,222,1)')
  gradient.addColorStop(0.2, 'rgba(255,148,38,0.92)')
  gradient.addColorStop(0.55, 'rgba(255,42,4,0.38)')
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
  gradient.addColorStop(0, 'rgba(255,38,4,0.2)')
  gradient.addColorStop(0.38, 'rgba(180,8,0,0.07)')
  gradient.addColorStop(1, 'rgba(90,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 128, 128)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function pickRimAngle(outer: boolean): number {
  const minimumY = outer ? -0.04 : -0.3

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const angle = Math.random() * Math.PI * 2
    if (Math.sin(angle) >= minimumY) return angle
  }

  return Math.random() * Math.PI
}

export function VaalOrb({ className = '' }: VaalOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let disposed = false
    const isMobile = window.matchMedia('(max-width: 640px)').matches
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.set(0, 0, 4.55)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.4 : 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.9
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.position = 'absolute'
    renderer.domElement.style.inset = '0'
    renderer.domElement.style.width = '100%'
    renderer.domElement.style.height = '100%'
    renderer.domElement.style.cursor = 'grab'
    renderer.domElement.style.touchAction = 'pan-y'
    container.appendChild(renderer.domElement)

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment
    pmremGenerator.dispose()

    scene.add(new THREE.HemisphereLight(0xffead0, 0x0d0503, 0.58))

    const keyLight = new THREE.DirectionalLight(0xfff1d4, 2.8)
    keyLight.position.set(4, 3.5, 5)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xb9c8ef, 0.52)
    fillLight.position.set(-3.5, -1.5, 4)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xff3a10, 0.68)
    rimLight.position.set(-3, 2, -4)
    scene.add(rimLight)

    const highlightLight = new THREE.PointLight(0xffffff, 4.2, 7, 2)
    highlightLight.position.set(2.4, 1.6, 3.2)
    scene.add(highlightLight)

    const fireLight = new THREE.PointLight(0xff2d08, 0.8, 4.2, 2)
    fireLight.position.set(0, 0.15, -0.8)
    scene.add(fireLight)

    const orbGroup = new THREE.Group()
    scene.add(orbGroup)

    const flameTextures = [0, 1, 2].map(createFlameTexture)
    const wispTextures = [0, 1].map(createWispTexture)
    const cinderTexture = createCinderTexture()
    const glowTexture = createGlowTexture()

    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff1d05,
      transparent: true,
      opacity: 0.018,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const backGlow = new THREE.Sprite(glowMaterial)
    backGlow.position.set(0, 0.04, -0.82)
    backGlow.scale.set(2.22, 2.22, 1)
    scene.add(backGlow)

    const fireGroup = new THREE.Group()
    fireGroup.position.z = -0.38
    scene.add(fireGroup)

    const flames: FlameWisp[] = []

    const addFlame = (index: number, outer: boolean) => {
      const angle = pickRimAngle(outer)
      const texture = outer
        ? wispTextures[index % wispTextures.length]
        : flameTextures[index % flameTextures.length]
      const palette = outer
        ? [0xff2505, 0xff3c09, 0xff6418]
        : [0xff3407, 0xff5a12, 0xff8726]
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
      const width = outer ? 0.045 + Math.random() * 0.045 : 0.07 + Math.random() * 0.065
      const height = outer ? 0.42 + Math.random() * 0.28 : 0.24 + Math.random() * 0.2

      // Anchor the sprite at its base so flames grow upward instead of extending
      // below the orb and visibly colliding with the canvas boundary.
      sprite.center.set(0.5, 0.06)
      sprite.scale.set(width, height, 1)
      fireGroup.add(sprite)

      flames.push({
        sprite,
        material,
        angle,
        radius: outer ? 1.04 + Math.random() * 0.07 : 0.99 + Math.random() * 0.065,
        speed: outer ? 0.15 + Math.random() * 0.16 : 0.24 + Math.random() * 0.24,
        phase: Math.random(),
        width,
        height,
        z: outer ? -0.06 + Math.random() * 0.05 : -0.02 + Math.random() * 0.07,
        outward: outer ? 0.1 + Math.random() * 0.13 : 0.04 + Math.random() * 0.08,
        rise: outer ? 0.3 + Math.random() * 0.25 : 0.16 + Math.random() * 0.16,
        sway: outer ? 0.07 + Math.random() * 0.07 : 0.025 + Math.random() * 0.045,
        opacity: outer ? 0.08 + Math.random() * 0.06 : 0.16 + Math.random() * 0.09,
      })
    }

    const innerFlameCount = isMobile ? 28 : 40
    const outerWispCount = isMobile ? 12 : 20
    for (let index = 0; index < innerFlameCount; index += 1) addFlame(index, false)
    for (let index = 0; index < outerWispCount; index += 1) addFlame(index, true)

    const cinderCount = isMobile ? 56 : 86
    const cinderPositions = new Float32Array(cinderCount * 3)
    const cinders: Cinder[] = []

    const resetCinder = (index: number, initial: boolean) => {
      const maxLife = 1.5 + Math.random() * 2.2
      const life = initial ? Math.random() * maxLife : maxLife
      const x = (Math.random() - 0.5) * 1.8
      const y = -0.72 + Math.random() * 0.58
      const z = -0.34 + Math.random() * 0.18

      cinders[index] = {
        vx: (Math.random() - 0.5) * 0.12,
        vy: 0.28 + Math.random() * 0.38,
        life,
        maxLife,
        phase: Math.random() * Math.PI * 2,
        z,
      }

      cinderPositions[index * 3] = x
      cinderPositions[index * 3 + 1] = y
      cinderPositions[index * 3 + 2] = z
    }

    for (let index = 0; index < cinderCount; index += 1) resetCinder(index, true)

    const cinderGeometry = new THREE.BufferGeometry()
    const cinderPositionAttribute = new THREE.BufferAttribute(cinderPositions, 3)
    cinderGeometry.setAttribute('position', cinderPositionAttribute)

    const cinderMaterial = new THREE.PointsMaterial({
      map: cinderTexture,
      color: 0xff5b18,
      size: isMobile ? 0.024 : 0.027,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.34,
      alphaTest: 0.02,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const cinderPoints = new THREE.Points(cinderGeometry, cinderMaterial)
    cinderPoints.position.z = -0.18
    scene.add(cinderPoints)

    let loadedScene: THREE.Object3D | null = null
    const loader = new GLTFLoader()
    loader.load(
      '/models/vaal-orb.glb',
      (gltf) => {
        if (disposed) return

        const model = gltf.scene
        loadedScene = model

        model.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return

          object.castShadow = false
          object.receiveShadow = false

          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            if (!(material instanceof THREE.MeshStandardMaterial)) return

            material.metalness = 0.68
            material.roughness = 0.44
            material.envMapIntensity = 1.25
            material.side = THREE.DoubleSide

            if (material.map) {
              material.map.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8)
            }

            material.needsUpdate = true
          })
        })

        const bounds = new THREE.Box3().setFromObject(model)
        const sphere = bounds.getBoundingSphere(new THREE.Sphere())
        const center = bounds.getCenter(new THREE.Vector3())

        model.position.copy(center).multiplyScalar(-1)
        orbGroup.scale.setScalar(1.08 / Math.max(sphere.radius, 0.001))
        orbGroup.add(model)
        orbGroup.rotation.x = -0.025

        setStatus('ready')
      },
      undefined,
      () => {
        if (!disposed) setStatus('error')
      }
    )

    let dragging = false
    let dragAxis: 'pending' | 'horizontal' | null = null
    let dragPointerId: number | null = null
    let dragStartX = 0
    let dragStartY = 0
    let dragStartRotation = 0
    let previousPointerX = 0
    let previousPointerTime = 0
    let rotationTarget = 0
    let rotationCurrent = 0
    let angularVelocity = 0

    const cancelPendingDrag = () => {
      dragging = false
      dragAxis = null
      dragPointerId = null
      renderer.domElement.style.cursor = 'grab'
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return

      dragging = true
      dragAxis = 'pending'
      dragPointerId = event.pointerId
      dragStartX = event.clientX
      dragStartY = event.clientY
      dragStartRotation = rotationTarget
      previousPointerX = event.clientX
      previousPointerTime = performance.now()
      angularVelocity = 0
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== dragPointerId) return

      const dx = event.clientX - dragStartX
      const dy = event.clientY - dragStartY

      if (dragAxis === 'pending') {
        if (Math.hypot(dx, dy) < 6) return

        if (Math.abs(dx) <= Math.abs(dy) * 1.15) {
          cancelPendingDrag()
          return
        }

        dragAxis = 'horizontal'
        container.setPointerCapture(event.pointerId)
        renderer.domElement.style.cursor = 'grabbing'
      }

      if (dragAxis !== 'horizontal') return
      event.preventDefault()

      const width = Math.max(container.getBoundingClientRect().width, 1)
      const radiansPerPixel = (Math.PI * 2.1) / width
      rotationTarget = dragStartRotation + dx * radiansPerPixel

      const now = performance.now()
      const elapsedSeconds = Math.max((now - previousPointerTime) / 1000, 0.001)
      angularVelocity = THREE.MathUtils.clamp(
        ((event.clientX - previousPointerX) * radiansPerPixel) / elapsedSeconds,
        -7,
        7
      )
      previousPointerX = event.clientX
      previousPointerTime = now
    }

    const finishDrag = (event: PointerEvent) => {
      if (event.pointerId !== dragPointerId) return

      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId)
      }
      cancelPendingDrag()
    }

    container.addEventListener('pointerdown', handlePointerDown)
    container.addEventListener('pointermove', handlePointerMove, { passive: false })
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

    const clock = new THREE.Clock()
    let animationFrame = 0

    const render = () => {
      const delta = Math.min(clock.getDelta(), 0.05)
      const elapsed = clock.elapsedTime
      const pulse = 0.5 + Math.sin(elapsed * 2.7) * 0.5

      if (!dragging && !reducedMotion) {
        rotationTarget += angularVelocity * delta
        angularVelocity *= Math.pow(0.035, delta)
        if (Math.abs(angularVelocity) < 0.002) angularVelocity = 0
      }

      rotationCurrent = THREE.MathUtils.damp(rotationCurrent, rotationTarget, 11, delta)
      orbGroup.rotation.y = rotationCurrent
      orbGroup.rotation.x = -0.025

      fireLight.intensity = 0.7 + pulse * 0.5
      glowMaterial.opacity = 0.012 + pulse * 0.012
      backGlow.scale.setScalar(2.16 + pulse * 0.05)

      flames.forEach((flame) => {
        const cycle = (elapsed * flame.speed + flame.phase) % 1
        const fade = Math.pow(Math.sin(Math.PI * cycle), 1.65)
        const fastFlicker = 0.8 + Math.sin(elapsed * 10.8 + flame.phase * 19) * 0.14
        const slowFlicker = 0.9 + Math.sin(elapsed * 2.5 + flame.phase * 7) * 0.1
        const flicker = fastFlicker * slowFlicker
        const sway = Math.sin(elapsed * 3.1 + flame.phase * 13) * flame.sway * cycle
        const radius = flame.radius + cycle * flame.outward
        const originX = Math.cos(flame.angle) * radius
        const originY = Math.sin(flame.angle) * flame.radius

        flame.sprite.position.set(originX + sway, originY + cycle * flame.rise, flame.z)
        flame.sprite.scale.set(
          flame.width * (1 - cycle * 0.38) * flicker,
          flame.height * (0.7 + cycle * 1.38) * slowFlicker,
          1
        )
        flame.material.rotation = sway * 1.8 + Math.sin(elapsed * 2 + flame.phase * 5) * 0.035
        flame.material.opacity = fade * flicker * flame.opacity
      })

      if (!reducedMotion) {
        for (let index = 0; index < cinderCount; index += 1) {
          const cinder = cinders[index]
          cinder.life -= delta

          const positionIndex = index * 3
          const lifeProgress = 1 - cinder.life / cinder.maxLife
          cinderPositions[positionIndex] +=
            (cinder.vx + Math.sin(elapsed * 2.6 + cinder.phase) * 0.026) * delta
          cinderPositions[positionIndex + 1] +=
            cinder.vy * delta * (0.75 + lifeProgress * 0.7)
          cinderPositions[positionIndex + 2] = cinder.z

          if (cinder.life <= 0 || cinderPositions[positionIndex + 1] > 1.42) {
            resetCinder(index, false)
          }
        }
        cinderPositionAttribute.needsUpdate = true
      }

      cinderMaterial.opacity = 0.24 + pulse * 0.12

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
      cinderGeometry.dispose()
      cinderMaterial.dispose()
      glowMaterial.dispose()
      flameTextures.forEach((texture) => texture.dispose())
      wispTextures.forEach((texture) => texture.dispose())
      cinderTexture.dispose()
      glowTexture.dispose()
      environment.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className={`relative overflow-visible select-none ${className}`}
      role="img"
      aria-label="A metallic Vaal emblem surrounded by rising flames and cinders. Drag horizontally to rotate it."
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
