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
}

type Spark = {
  angle: number
  radius: number
  speed: number
  drift: number
  life: number
  maxLife: number
  z: number
}

function createFlameTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256

  const context = canvas.getContext('2d')
  if (!context) return new THREE.CanvasTexture(canvas)

  context.clearRect(0, 0, canvas.width, canvas.height)

  const body = context.createRadialGradient(64, 176, 2, 64, 160, 72)
  body.addColorStop(0, 'rgba(255,255,255,1)')
  body.addColorStop(0.18, 'rgba(255,220,150,0.95)')
  body.addColorStop(0.48, 'rgba(255,95,28,0.68)')
  body.addColorStop(0.78, 'rgba(180,8,0,0.22)')
  body.addColorStop(1, 'rgba(80,0,0,0)')
  context.fillStyle = body
  context.fillRect(0, 72, 128, 184)

  const tip = context.createRadialGradient(64, 86, 0, 64, 104, 48)
  tip.addColorStop(0, 'rgba(255,235,185,0.7)')
  tip.addColorStop(0.35, 'rgba(255,70,18,0.42)')
  tip.addColorStop(1, 'rgba(120,0,0,0)')
  context.fillStyle = tip
  context.fillRect(12, 28, 104, 132)

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
  gradient.addColorStop(0, 'rgba(255,255,220,1)')
  gradient.addColorStop(0.24, 'rgba(255,120,32,0.95)')
  gradient.addColorStop(0.62, 'rgba(255,24,4,0.45)')
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
  gradient.addColorStop(0, 'rgba(255,35,4,0.42)')
  gradient.addColorStop(0.4, 'rgba(210,8,0,0.16)')
  gradient.addColorStop(1, 'rgba(110,0,0,0)')
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

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0, 3.35)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment
    pmremGenerator.dispose()

    scene.add(new THREE.HemisphereLight(0xffe8c7, 0x120806, 0.95))

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 5.2)
    keyLight.position.set(4, 3.5, 5)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xb8c9ff, 1.35)
    fillLight.position.set(-3.5, -1.5, 4)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xff2a0a, 1.8)
    rimLight.position.set(-3, 2, -4)
    scene.add(rimLight)

    const highlightLight = new THREE.PointLight(0xffffff, 18, 7, 2)
    highlightLight.position.set(2.2, 1.4, 3.1)
    scene.add(highlightLight)

    const fireLight = new THREE.PointLight(0xff2608, 3.2, 4.5, 2)
    fireLight.position.set(0, -0.1, -0.65)
    scene.add(fireLight)

    const orbGroup = new THREE.Group()
    scene.add(orbGroup)

    const flameTexture = createFlameTexture()
    const sparkTexture = createSparkTexture()
    const glowTexture = createGlowTexture()

    const glowMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xff1b05,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const backGlow = new THREE.Sprite(glowMaterial)
    backGlow.position.set(0, 0, -0.72)
    backGlow.scale.set(2.65, 2.65, 1)
    scene.add(backGlow)

    const fireGroup = new THREE.Group()
    fireGroup.position.z = -0.34
    scene.add(fireGroup)

    const flames: FlameWisp[] = []
    const flameCount = 34

    for (let index = 0; index < flameCount; index += 1) {
      const angle = (index / flameCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.18
      const material = new THREE.SpriteMaterial({
        map: flameTexture,
        color: Math.random() > 0.35 ? 0xff2d08 : 0xff761c,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        depthTest: true,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      })
      const sprite = new THREE.Sprite(material)
      const width = 0.095 + Math.random() * 0.085
      const height = 0.24 + Math.random() * 0.22

      sprite.scale.set(width, height, 1)
      fireGroup.add(sprite)

      flames.push({
        sprite,
        material,
        angle,
        radius: 1.03 + Math.random() * 0.08,
        speed: 0.24 + Math.random() * 0.25,
        phase: Math.random(),
        width,
        height,
        z: -0.08 + Math.random() * 0.13,
      })
    }

    const sparkCount = 72
    const sparkPositions = new Float32Array(sparkCount * 3)
    const sparks: Spark[] = []

    const resetSpark = (index: number, initial: boolean) => {
      const angle = Math.random() * Math.PI * 2
      const radius = 1.02 + Math.random() * 0.23
      const maxLife = 1.4 + Math.random() * 1.8
      const life = initial ? Math.random() * maxLife : maxLife

      sparks[index] = {
        angle,
        radius,
        speed: 0.14 + Math.random() * 0.25,
        drift: (Math.random() - 0.5) * 0.08,
        life,
        maxLife,
        z: -0.22 + Math.random() * 0.34,
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
      color: 0xff4a12,
      size: 0.035,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.5,
      alphaTest: 0.02,
      depthWrite: false,
      depthTest: true,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const sparkPoints = new THREE.Points(sparkGeometry, sparkMaterial)
    sparkPoints.position.z = -0.2
    scene.add(sparkPoints)

    let loadedScene: THREE.Object3D | null = null
    const loader = new GLTFLoader()
    loader.load(
      '/models/vaal-orb.glb',
      (gltf) => {
        loadedScene = gltf.scene

        loadedScene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return

          object.castShadow = false
          object.receiveShadow = false

          const materials = Array.isArray(object.material) ? object.material : [object.material]
          materials.forEach((material) => {
            if (!(material instanceof THREE.MeshStandardMaterial)) return

            material.metalness = 0.82
            material.roughness = 0.36
            material.envMapIntensity = 2.15
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
        orbGroup.scale.setScalar(1.16 / Math.max(sphere.radius, 0.001))
        orbGroup.add(loadedScene)
        orbGroup.rotation.x = -0.035

        setStatus('ready')
      },
      undefined,
      () => setStatus('error')
    )

    const pointerTarget = new THREE.Vector2()
    const pointerCurrent = new THREE.Vector2()

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect()
      pointerTarget.set(
        ((event.clientX - bounds.left) / bounds.width - 0.5) * 2,
        ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
      )
    }

    const handlePointerLeave = () => pointerTarget.set(0, 0)
    container.addEventListener('pointermove', handlePointerMove)
    container.addEventListener('pointerleave', handlePointerLeave)

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
      const pulse = 0.5 + Math.sin(elapsed * 2.7) * 0.5

      pointerCurrent.lerp(pointerTarget, 0.045)

      if (!reducedMotion) {
        orbGroup.rotation.y = elapsed * 0.18 + pointerCurrent.x * 0.18
        orbGroup.rotation.x = -0.035 - pointerCurrent.y * 0.1 + Math.sin(elapsed * 0.62) * 0.022
        orbGroup.position.y = Math.sin(elapsed * 0.82) * 0.03

        fireGroup.rotation.z = Math.sin(elapsed * 0.2) * 0.018
        sparkPoints.rotation.z = -elapsed * 0.012
      }

      highlightLight.position.x = Math.sin(elapsed * 0.52) * 2.45
      highlightLight.position.y = 1.2 + Math.cos(elapsed * 0.41) * 0.65
      fireLight.intensity = 2.4 + pulse * 2.2
      glowMaterial.opacity = 0.055 + pulse * 0.035
      backGlow.scale.setScalar(2.52 + pulse * 0.12)

      flames.forEach((flame) => {
        const cycle = (elapsed * flame.speed + flame.phase) % 1
        const fade = Math.pow(Math.sin(Math.PI * cycle), 1.35)
        const flicker = 0.78 + Math.sin(elapsed * 8.5 + flame.phase * 17) * 0.22
        const angle = flame.angle + Math.sin(elapsed * 1.6 + flame.phase * 8) * 0.035
        const radius = flame.radius + cycle * 0.25

        flame.sprite.position.set(
          Math.cos(angle) * radius + Math.sin(elapsed * 2.1 + flame.phase * 11) * 0.018,
          Math.sin(angle) * radius + cycle * 0.075,
          flame.z
        )
        flame.sprite.scale.set(
          flame.width * (0.92 - cycle * 0.24) * flicker,
          flame.height * (0.68 + cycle * 1.15),
          1
        )
        flame.material.rotation = angle - Math.PI / 2 + Math.sin(elapsed * 2.4 + flame.phase) * 0.06
        flame.material.opacity = fade * flicker * 0.24
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
          sparkPositions[index * 3] += spark.drift * delta
          sparkPositions[index * 3 + 1] += spark.speed * delta * (0.7 + lifeProgress)
          sparkPositions[index * 3 + 2] = spark.z
        }
        sparkPositionAttribute.needsUpdate = true
      }

      sparkMaterial.opacity = 0.26 + pulse * 0.24

      renderer.render(scene, camera)
      animationFrame = window.requestAnimationFrame(render)
    }

    render()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      container.removeEventListener('pointermove', handlePointerMove)
      container.removeEventListener('pointerleave', handlePointerLeave)

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
      flameTexture.dispose()
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
      className={`relative isolate overflow-hidden ${className}`}
      role="img"
      aria-label="A slowly rotating metallic Vaal emblem surrounded by flickering red fire wisps"
    >
      {status === 'loading' && (
        <div className="absolute inset-0 grid place-items-center text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Awakening relic
        </div>
      )}

      {status === 'error' && (
        <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-muted-foreground">
          The Vaal relic could not be loaded.
        </div>
      )}
    </div>
  )
}
