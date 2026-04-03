import { useEffect, useRef, useCallback } from 'react'

interface Star {
  x: number
  y: number
  size: number
  opacity: number
  hue: number
}

interface NebulaCloud {
  x: number
  y: number
  radius: number
  hue: number
  opacity: number
}

interface Planet {
  orbitRadius: number
  orbitSpeed: number
  orbitAngle: number
  orbitTilt: number
  size: number
  hue: number
  glowSize: number
  ringColor?: string
  hasRing: boolean
}

export function ParticleBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const nebulaRef = useRef<NebulaCloud[]>([])
  const planetsRef = useRef<Planet[]>([])
  const animationRef = useRef<number>(0)

  const createGalaxy = useCallback((width: number, height: number) => {
    const stars: Star[] = []
    const centerX = width / 2
    const centerY = height / 2
    const galaxyRadius = Math.min(width, height) * 0.8

    const starCount = Math.floor((width * height) / 2400)
    for (let i = 0; i < starCount; i++) {
      const arm = Math.floor(Math.random() * 4)
      const armAngle = (arm / 4) * Math.PI * 2
      const dist = Math.pow(Math.random(), 0.5) * galaxyRadius
      const spiralAngle = armAngle + dist * 0.008
      const spread = dist * 0.15 + 20

      const x = centerX + Math.cos(spiralAngle) * dist + (Math.random() - 0.5) * spread
      const y = centerY + Math.sin(spiralAngle) * dist * 0.5 + (Math.random() - 0.5) * spread * 0.5

      const isBright = Math.random() < 0.03
      const size = isBright ? Math.random() * 2 + 1.5 : Math.random() * 1 + 0.2
      const hue = Math.random() > 0.85
        ? 200 + Math.random() * 60
        : Math.random() > 0.75
          ? 20 + Math.random() * 40
          : 0

      stars.push({
        x: Math.max(0, Math.min(width, x)),
        y: Math.max(0, Math.min(height, y)),
        size,
        opacity: isBright ? 0.5 + Math.random() * 0.3 : Math.random() * 0.3 + 0.05,
        hue,
      })
    }

    const nebulae: NebulaCloud[] = [
      { x: centerX - galaxyRadius * 0.3, y: centerY - galaxyRadius * 0.1, radius: galaxyRadius * 0.5, hue: 280, opacity: 0.008 },
      { x: centerX + galaxyRadius * 0.2, y: centerY + galaxyRadius * 0.15, radius: galaxyRadius * 0.4, hue: 200, opacity: 0.006 },
      { x: centerX + galaxyRadius * 0.1, y: centerY - galaxyRadius * 0.25, radius: galaxyRadius * 0.35, hue: 330, opacity: 0.005 },
      { x: centerX - galaxyRadius * 0.15, y: centerY + galaxyRadius * 0.2, radius: galaxyRadius * 0.3, hue: 170, opacity: 0.004 },
      { x: centerX, y: centerY, radius: galaxyRadius * 0.6, hue: 30, opacity: 0.003 },
      { x: centerX + galaxyRadius * 0.4, y: centerY - galaxyRadius * 0.1, radius: galaxyRadius * 0.25, hue: 220, opacity: 0.006 },
      { x: centerX - galaxyRadius * 0.4, y: centerY + galaxyRadius * 0.05, radius: galaxyRadius * 0.3, hue: 350, opacity: 0.004 },
    ]

    const planets: Planet[] = [
      { orbitRadius: galaxyRadius * 0.12, orbitSpeed: 0.0004, orbitAngle: 0, orbitTilt: 0.3, size: 4, hue: 200, glowSize: 12, hasRing: false },
      { orbitRadius: galaxyRadius * 0.2, orbitSpeed: 0.0003, orbitAngle: 1.2, orbitTilt: 0.3, size: 6, hue: 220, glowSize: 16, hasRing: false },
      { orbitRadius: galaxyRadius * 0.3, orbitSpeed: 0.00022, orbitAngle: 2.5, orbitTilt: 0.3, size: 7, hue: 170, glowSize: 20, hasRing: false },
      { orbitRadius: galaxyRadius * 0.42, orbitSpeed: 0.00016, orbitAngle: 3.8, orbitTilt: 0.3, size: 5, hue: 30, glowSize: 14, hasRing: false },
      { orbitRadius: galaxyRadius * 0.55, orbitSpeed: 0.0001, orbitAngle: 5.0, orbitTilt: 0.3, size: 14, hue: 30, glowSize: 30, hasRing: true, ringColor: 'rgba(210, 180, 120, 0.4)' },
      { orbitRadius: galaxyRadius * 0.7, orbitSpeed: 0.00006, orbitAngle: 0.8, orbitTilt: 0.3, size: 11, hue: 40, glowSize: 24, hasRing: true, ringColor: 'rgba(180, 200, 220, 0.3)' },
      { orbitRadius: galaxyRadius * 0.85, orbitSpeed: 0.00003, orbitAngle: 4.2, orbitTilt: 0.3, size: 10, hue: 210, glowSize: 22, hasRing: false },
    ]

    return { stars, nebulae, planets }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const galaxy = createGalaxy(canvas.width, canvas.height)
      starsRef.current = galaxy.stars
      nebulaRef.current = galaxy.nebulae
      planetsRef.current = galaxy.planets
    }

    resize()
    window.addEventListener('resize', resize)

    const draw = (time: number) => {
      const { width, height } = canvas
      const stars = starsRef.current
      const nebulae = nebulaRef.current
      const planets = planetsRef.current
      const centerX = width / 2
      const centerY = height / 2

      ctx.clearRect(0, 0, width, height)

      for (const cloud of nebulae) {
        const gradient = ctx.createRadialGradient(cloud.x, cloud.y, 0, cloud.x, cloud.y, cloud.radius)
        gradient.addColorStop(0, `hsla(${cloud.hue}, 70%, 50%, ${cloud.opacity})`)
        gradient.addColorStop(0.4, `hsla(${cloud.hue + 20}, 60%, 40%, ${cloud.opacity * 0.5})`)
        gradient.addColorStop(1, 'transparent')
        ctx.fillStyle = gradient
        ctx.fillRect(cloud.x - cloud.radius, cloud.y - cloud.radius, cloud.radius * 2, cloud.radius * 2)
      }

      const coreGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 80)
      coreGradient.addColorStop(0, 'rgba(255, 240, 200, 0.06)')
      coreGradient.addColorStop(0.3, 'rgba(255, 200, 150, 0.02)')
      coreGradient.addColorStop(1, 'transparent')
      ctx.fillStyle = coreGradient
      ctx.fillRect(centerX - 80, centerY - 80, 160, 160)

      for (const star of stars) {
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        if (star.hue > 0) {
          ctx.fillStyle = `hsla(${star.hue}, 70%, 75%, ${star.opacity})`
        } else {
          ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`
        }
        ctx.fill()

        if (star.size > 1.5) {
          const glow = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 5)
          const glowHue = star.hue || 200
          glow.addColorStop(0, `hsla(${glowHue}, 80%, 80%, ${star.opacity * 0.1})`)
          glow.addColorStop(1, 'transparent')
          ctx.fillStyle = glow
          ctx.fillRect(star.x - star.size * 5, star.y - star.size * 5, star.size * 10, star.size * 10)
        }
      }

      for (const planet of planets) {
        const angle = planet.orbitAngle + time * planet.orbitSpeed
        const px = centerX + Math.cos(angle) * planet.orbitRadius
        const py = centerY + Math.sin(angle) * planet.orbitRadius * Math.cos(planet.orbitTilt)

        ctx.beginPath()
        ctx.ellipse(centerX, centerY, planet.orbitRadius, planet.orbitRadius * Math.cos(planet.orbitTilt), 0, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.015)'
        ctx.lineWidth = 0.5
        ctx.stroke()

        if (planet.hasRing && planet.ringColor) {
          ctx.save()
          ctx.beginPath()
          ctx.ellipse(px, py, planet.size * 2.2, planet.size * 0.5, 0.3, 0, Math.PI * 2)
          ctx.strokeStyle = planet.ringColor
          ctx.lineWidth = 2
          ctx.stroke()
          ctx.restore()
        }

        const planetGlow = ctx.createRadialGradient(px, py, 0, px, py, planet.glowSize)
        planetGlow.addColorStop(0, `hsla(${planet.hue}, 80%, 70%, 0.4)`)
        planetGlow.addColorStop(0.3, `hsla(${planet.hue}, 70%, 60%, 0.15)`)
        planetGlow.addColorStop(1, 'transparent')
        ctx.fillStyle = planetGlow
        ctx.fillRect(px - planet.glowSize, py - planet.glowSize, planet.glowSize * 2, planet.glowSize * 2)

        const planetGrad = ctx.createRadialGradient(px - planet.size * 0.3, py - planet.size * 0.3, 0, px, py, planet.size)
        planetGrad.addColorStop(0, `hsla(${planet.hue}, 60%, 80%, 1)`)
        planetGrad.addColorStop(0.7, `hsla(${planet.hue}, 70%, 55%, 1)`)
        planetGrad.addColorStop(1, `hsla(${planet.hue}, 80%, 30%, 1)`)
        ctx.beginPath()
        ctx.arc(px, py, planet.size, 0, Math.PI * 2)
        ctx.fillStyle = planetGrad
        ctx.fill()
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    animationRef.current = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationRef.current)
    }
  }, [createGalaxy])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
