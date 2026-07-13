'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

type VaalOrbProps = {
  className?: string
}

type Ember = {
  velocity: THREE.Vector3
  life: number
  maxLife: number
  phase: number
}

function createEmberTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 64

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const glow = context.createRadialGradient(32, 32, 0, 32, 32, 32)
  glow.addColorStop(0, 'rgba(255,255,226,1)')
  glow.addColorStop(0.12, 'rgba(255,224,126,1)')
  glow.addColorStop(0.3, 'rgba(255,126,26,0.95)')
  glow.addColorStop(0.6, 'rgba(255,48,5,0.46)')
  glow.addColorStop(1, 'rgba(255,20,0,0)')
  context.fillStyle = glow
  context.fillRect(0, 0, 64, 64)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.needsUpdate = true
  return texture
}

function createShadowTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 128

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  const gradient = context.createRadialGradient(128, 64, 0, 128, 64, 118)
  gradient.addColorStop(0, 'rgba(0,0,0,0.5)')
  gradient.addColorStop(0.45, 'rgba(0,0,0,0.2)')
  gradient.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 256, 128)

  return new THREE.CanvasTexture(canvas)
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
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(0, 0, isMobile ? 4.05 : 3.85)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.35 : 1.65))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 0.82
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

    scene.add(new THREE.HemisphereLight(0xffead0, 0x090403, 0.5))

    const keyLight = new THREE.DirectionalLight(0xffeed4, 2.5)
    keyLight.position.set(4, 3.5, 5)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xb9c8ef, 0.46)
    fillLight.position.set(-3.5, -1.5, 4)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xff3a10, 0.62)
    rimLight.position.set(-3, 2, -4)
    scene.add(rimLight)

    const highlightLight = new THREE.PointLight(0xffffff, 3.8, 7, 2)
    highlightLight.position.set(2.4, 1.6, 3.2)
    scene.add(highlightLight)

    const emberLight = new THREE.PointLight(0xff2d08, 0.65, 4.2, 2)
    emberLight.position.set(0, 0.1, -0.7)
    scene.add(emberLight)

    const orbGroup = new THREE.Group()
    scene.add(orbGroup)

    const shadowTexture = createShadowTexture()
    const shadowMaterial = new THREE.SpriteMaterial({
      map: shadowTexture,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      depthTest: true,
      color: 0x000000,
    })
    const shadow = new THREE.Sprite(shadowMaterial)
    shadow.position.set(0, -1.16, -0.22)
    shadow.scale.set(1.85, 0.48, 1)
    scene.add(shadow)

    const emberTexture = createEmberTexture()
    const emberCount = isMobile ? 54 : 88
    const emberPositions = new Float32Array(emberCount * 3)
    const emberColors = new Float32Array(emberCount * 3)
    const embers: Ember[] = []

    const warmColors = [
      new THREE.Color(0xffb347),
      new THREE.Color(0xff6a1a),
      new THREE.Color(0xffd27a),
      new THREE.Color(0xff3b08),
    ]

    const resetEmber = (index: number, initial: boolean) => {
      const angle = Math.random() * Math.PI * 2
      const radius = 0.98 + Math.random() * 0.58
      const maxLife = 1.6 + Math.random() * 3
      const life = initial ? Math.random() * maxLife : maxLife
      const y = -1.02 + Math.random() * 1.78
      const color = warmColors[index % warmColors.length]

      emberPositions[index * 3] = Math.cos(angle) * radius
      emberPositions[index * 3 + 1] = y
      emberPositions[index * 3 + 2] = 0.12 + Math.random() * 0.28

      emberColors[index * 3] = color.r
      emberColors[index * 3 + 1] = color.g
      emberColors[index * 3 + 2] = color.b

      embers[index] = {
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 0.16,
          0.2 + Math.random() * 0.38,
          (Math.random() - 0.5) * 0.025
        ),
        life,
        maxLife,
        phase: Math.random() * Math.PI * 2,
      }
    }

    for (let index = 0; index < emberCount; index += 1) resetEmber(index, true)

    const emberGeometry = new THREE.BufferGeometry()
    const emberPositionAttribute = new THREE.BufferAttribute(emberPositions, 3)
    emberGeometry.setAttribute('position', emberPositionAttribute)
    emberGeometry.setAttribute('color', new THREE.BufferAttribute(emberColors, 3))

    const emberHaloMaterial = new THREE.PointsMaterial({
      map: emberTexture,
      size: isMobile ? 0.075 : 0.095,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.2,
      alphaTest: 0.005,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexColors: true,
    })

    const emberCoreMaterial = new THREE.PointsMaterial({
      map: emberTexture,
      size: isMobile ? 0.032 : 0.042,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.92,
      alphaTest: 0.01,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
      vertexColors: true,
    })

    const emberHalo = new THREE.Points(emberGeometry, emberHaloMaterial)
    const emberCore = new THREE.Points(emberGeometry, emberCoreMaterial)
    emberHalo.frustumCulled = false
    emberCore.frustumCulled = false
    emberHalo.renderOrder = 2
    emberCore.renderOrder = 3
    scene.add(emberHalo, emberCore)

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

            material.metalness = 0.65
            material.roughness = 0.47
            material.envMapIntensity = 1.12
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
        orbGroup.scale.setScalar((isMobile ? 1.22 : 1.17) / Math.max(sphere.radius, 0.001))
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
      const pulse = 0.5 + Math.sin(elapsed * 2.3) * 0.5

      if (!dragging && !reducedMotion) {
        rotationTarget += (0.085 + angularVelocity) * delta
        angularVelocity *= Math.pow(0.035, delta)
        if (Math.abs(angularVelocity) < 0.002) angularVelocity = 0
      }

      rotationCurrent = THREE.MathUtils.damp(rotationCurrent, rotationTarget, 10, delta)
      orbGroup.rotation.y = rotationCurrent
      orbGroup.rotation.x = -0.025

      shadow.material.opacity = 0.3 + pulse * 0.045
      shadow.scale.x = 1.78 + pulse * 0.05
      emberLight.intensity = 0.55 + pulse * 0.3

      if (!reducedMotion) {
        for (let index = 0; index < emberCount; index += 1) {
          const ember = embers[index]
          ember.life -= delta

          const positionIndex = index * 3
          const progress = 1 - ember.life / ember.maxLife
          emberPositions[positionIndex] +=
            (ember.velocity.x + Math.sin(elapsed * 2.1 + ember.phase) * 0.035) * delta
          emberPositions[positionIndex + 1] += ember.velocity.y * delta * (0.72 + progress * 0.9)
          emberPositions[positionIndex + 2] += ember.velocity.z * delta

          const x = emberPositions[positionIndex]
          const y = emberPositions[positionIndex + 1]
          if (ember.life <= 0 || y > 1.5 || Math.abs(x) > 1.75) {
            resetEmber(index, false)
          }
        }
        emberPositionAttribute.needsUpdate = true
      }

      emberCoreMaterial.opacity = 0.8 + pulse * 0.18
      emberHaloMaterial.opacity = 0.14 + pulse * 0.12

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

      emberGeometry.dispose()
      emberHaloMaterial.dispose()
      emberCoreMaterial.dispose()
      emberTexture.dispose()
      shadowMaterial.dispose()
      shadowTexture.dispose()
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
      aria-label="A metallic Vaal emblem surrounded by floating fire embers. Drag horizontally to rotate it."
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
