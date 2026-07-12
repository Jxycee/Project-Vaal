'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

type VaalOrbProps = {
  className?: string
}

const AURA_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`

const AURA_FRAGMENT_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uPulse;
  uniform vec3 uColor;

  varying vec3 vWorldNormal;
  varying vec3 vWorldPosition;

  void main() {
    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - abs(dot(normalize(vWorldNormal), viewDirection)), 2.35);

    float waveA = sin(vWorldPosition.y * 14.0 + uTime * 2.1);
    float waveB = sin(vWorldPosition.x * 11.0 - uTime * 1.7);
    float waveC = sin((vWorldPosition.x + vWorldPosition.y) * 8.0 + uTime * 1.2);
    float wisps = smoothstep(0.72, 1.55, (waveA + waveB + waveC) * 0.34 + 0.72);

    float alpha = (0.035 + fresnel * 0.52 + wisps * 0.09) * uPulse;
    gl_FragColor = vec4(uColor, alpha);
  }
`

export function VaalOrb({ className = '' }: VaalOrbProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100)
    camera.position.set(0, 0, 3.7)

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.setClearColor(0x000000, 0)
    container.appendChild(renderer.domElement)

    const pmremGenerator = new THREE.PMREMGenerator(renderer)
    const environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = environment
    pmremGenerator.dispose()

    scene.add(new THREE.HemisphereLight(0xffe2b0, 0x120000, 1.65))

    const keyLight = new THREE.DirectionalLight(0xffd9a0, 4.2)
    keyLight.position.set(3.5, 4, 5)
    scene.add(keyLight)

    const rimLight = new THREE.DirectionalLight(0xff2b12, 3.4)
    rimLight.position.set(-4, 1, -3)
    scene.add(rimLight)

    const pulseLight = new THREE.PointLight(0xff1d08, 9, 5, 2)
    pulseLight.position.set(0, 0, 1.1)
    scene.add(pulseLight)

    const orbGroup = new THREE.Group()
    scene.add(orbGroup)

    const auraUniforms = {
      uTime: { value: 0 },
      uPulse: { value: 0.85 },
      uColor: { value: new THREE.Color(0xff2208) },
    }

    const auraMaterial = new THREE.ShaderMaterial({
      uniforms: auraUniforms,
      vertexShader: AURA_VERTEX_SHADER,
      fragmentShader: AURA_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })

    const aura = new THREE.Mesh(new THREE.SphereGeometry(1.22, 64, 64), auraMaterial)
    scene.add(aura)

    const particleCount = 140
    const particlePositions = new Float32Array(particleCount * 3)
    for (let index = 0; index < particleCount; index += 1) {
      const radius = 1.18 + Math.random() * 0.42
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      particlePositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta)
      particlePositions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta)
      particlePositions[index * 3 + 2] = radius * Math.cos(phi) * 0.72
    }

    const particleGeometry = new THREE.BufferGeometry()
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3))
    const particleMaterial = new THREE.PointsMaterial({
      color: 0xff2a0a,
      size: 0.018,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    })
    const particles = new THREE.Points(particleGeometry, particleMaterial)
    scene.add(particles)

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
            material.metalness = 0.72
            material.roughness = 0.58
            material.envMapIntensity = 1.35
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
        orbGroup.scale.setScalar(1.04 / Math.max(sphere.radius, 0.001))
        orbGroup.add(loadedScene)
        orbGroup.rotation.x = -0.04

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
      const elapsed = clock.getElapsedTime()
      const pulse = 0.5 + Math.sin(elapsed * 2.25) * 0.5

      pointerCurrent.lerp(pointerTarget, 0.045)

      if (!reducedMotion) {
        orbGroup.rotation.y = elapsed * 0.18 + pointerCurrent.x * 0.18
        orbGroup.rotation.x = -0.04 - pointerCurrent.y * 0.1 + Math.sin(elapsed * 0.62) * 0.025
        orbGroup.position.y = Math.sin(elapsed * 0.82) * 0.035

        aura.rotation.y = -elapsed * 0.08
        aura.rotation.z = elapsed * 0.035
        aura.scale.setScalar(0.985 + pulse * 0.045)

        particles.rotation.y = elapsed * 0.045
        particles.rotation.z = -elapsed * 0.025
      }

      auraUniforms.uTime.value = elapsed
      auraUniforms.uPulse.value = 0.72 + pulse * 0.52
      particleMaterial.opacity = 0.28 + pulse * 0.38
      pulseLight.intensity = 7 + pulse * 7

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

      aura.geometry.dispose()
      auraMaterial.dispose()
      particleGeometry.dispose()
      particleMaterial.dispose()
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
      aria-label="A slowly rotating Vaal emblem surrounded by pulsing red energy"
    >
      <div className="pointer-events-none absolute inset-x-[18%] bottom-[7%] h-[12%] rounded-full bg-red-600/20 blur-2xl" />

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
