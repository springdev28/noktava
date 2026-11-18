import { useEffect, useRef } from 'react'

/** Fine, flexible strands carrying a travelling wave between two fixed ends. */
export function SoundSculpture() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    const steps = 160, strandCount = 64, tau = Math.PI * 2
    const positions = Array.from({ length: steps + 1 }, (_, i) => {
      const s = i / steps
      return { s, envelope: i === 0 || i === steps ? 0 : Math.pow(Math.sin(Math.PI * s), .72) }
    })
    const strands = Array.from({ length: strandCount }, (_, i) => {
      const angle = i / strandCount * tau
      return { i, across: Math.cos(angle), depth: Math.sin(angle) }
    }).sort((a, b) => a.depth - b.depth)
    let frame = 0, elapsed = 0, previousTime: number | null = null
    let visible = true, width = 620, height = 560

    const draw = (seconds: number) => {
      context.clearRect(0, 0, width, height)
      const phase = seconds * 1.6
      // The camera stays fixed. Displacement travels along the string itself.
      const curve = positions.map(({ s, envelope }) => {
        const displacement = .64 * Math.sin(tau * s - phase + .45)
          + .19 * Math.sin(2 * tau * s + phase * .68 + .8)
        const twist = 2.7 * Math.sin(Math.PI * s) + .38 * Math.sin(tau * s - phase * .7)
        return {
          s,
          y: envelope * displacement,
          z: envelope * .27 * Math.sin(tau * s - phase * .8 + 1.2),
          radius: envelope * (.14 + .025 * Math.sin(tau * s - phase)),
          cosine: Math.cos(twist), sine: Math.sin(twist),
        }
      })
      const project = (point: typeof curve[number], across: number, depth: number) => {
        const y = point.y + point.radius * (across * point.cosine - depth * point.sine * .65)
        const z = point.z + point.radius * (across * point.sine + depth * point.cosine * .65)
        const perspective = 1 + z * .12
        return {
          x: width * .5 + (point.s - .5) * width * .83 * perspective,
          y: height * .49 + (y * height * .45 + (point.s - .5) * height * .08) * perspective,
        }
      }
      // Each filament follows the same travelling displacement with its own depth.
      for (const strand of strands) {
        const light = (strand.depth + 1) / 2
        const accent = strand.i % 19 === 0
        context.beginPath()
        curve.forEach((point, index) => {
          const p = project(point, strand.across, strand.depth)
          if (index === 0) context.moveTo(p.x, p.y)
          else context.lineTo(p.x, p.y)
        })
        context.strokeStyle = accent
          ? 'rgba(120, 217, 181, .55)'
          : `rgba(${Math.round(130 + light * 125)},${Math.round(82 + light * 116)},${Math.round(45 + light * 95)},${.19 + light * .55})`
        context.lineWidth = accent ? 1.1 : .55 + light * .65
        context.stroke()
      }
      // Sparse cross threads retain the woven texture without creating a rigid mesh.
      context.strokeStyle = 'rgba(255, 179, 138, .12)'
      context.lineWidth = .6
      for (let index = 4; index < steps; index += 4) {
        context.beginPath()
        for (let j = 0; j <= 24; j++) {
          const angle = j / 24 * tau, p = project(curve[index], Math.cos(angle), Math.sin(angle))
          if (j === 0) context.moveTo(p.x, p.y)
          else context.lineTo(p.x, p.y)
        }
        context.stroke()
      }
    }

    const animate = (timestamp: number) => {
      frame = 0
      if (!visible || document.hidden || reduced.matches) return
      if (previousTime !== null) elapsed += Math.min((timestamp - previousTime) / 1000, .05)
      previousTime = timestamp
      draw(elapsed)
      frame = requestAnimationFrame(animate)
    }
    const syncAnimation = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = 0; previousTime = null
      draw(reduced.matches ? 0 : elapsed)
      if (visible && !document.hidden && !reduced.matches) frame = requestAnimationFrame(animate)
    }
    const resize = new ResizeObserver(entries => {
      width = entries[0].contentRect.width; height = entries[0].contentRect.height
      const ratio = Math.min(devicePixelRatio, 2)
      canvas.width = width * ratio; canvas.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw(reduced.matches ? 0 : elapsed)
    })
    const visibility = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      syncAnimation()
    })
    resize.observe(canvas); visibility.observe(canvas)
    reduced.addEventListener('change', syncAnimation)
    document.addEventListener('visibilitychange', syncAnimation)
    syncAnimation()
    return () => {
      cancelAnimationFrame(frame)
      resize.disconnect(); visibility.disconnect()
      reduced.removeEventListener('change', syncAnimation)
      document.removeEventListener('visibilitychange', syncAnimation)
    }
  }, [])
  return <canvas ref={ref} className="sound-sculpture" aria-hidden="true" />
}
