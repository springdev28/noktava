import { useEffect, useRef } from 'react'

/** A slowly rotating, folded sound wave, drawn locally without image assets. */
export function SoundSculpture() {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let visible = true
    let width = 620, height = 560
    const resize = new ResizeObserver(entries => {
      const rect = entries[0].contentRect
      width = rect.width; height = rect.height
      const ratio = Math.min(devicePixelRatio, 2)
      canvas.width = width * ratio; canvas.height = height * ratio
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw(reduced.matches ? 0 : last)
    })
    const visibility = new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting
      if (visible) draw(reduced.matches ? 0 : last)
    })
    const draw = (time: number) => {
      context.clearRect(0, 0, width, height)
      const size = Math.min(width, height) * 0.36
      const rotation = reduced.matches ? 0.27 : time * 0.00006 + 0.27
      const cx = width / 2, cy = height / 2
      const project = (u: number, v: number) => {
        const tube = 0.39 + 0.1 * Math.cos(3 * u + rotation)
        const r = 0.88 + tube * Math.cos(v)
        const x = r * Math.cos(u), y = r * Math.sin(u), z = tube * Math.sin(v) + 0.15 * Math.sin(3 * u)
        const ry = y * Math.cos(rotation) - z * Math.sin(rotation)
        const rz = y * Math.sin(rotation) + z * Math.cos(rotation)
        const tilt = 0.7
        const rx = x * Math.cos(tilt) + rz * Math.sin(tilt)
        const depth = -x * Math.sin(tilt) + rz * Math.cos(tilt)
        const perspective = 3.7 / (3.7 - depth)
        return { x: cx + rx * size * perspective, y: cy + ry * size * perspective * 0.95, depth }
      }
      // Fine ribbons create the metallic, woven surface of the wave.
      for (let ring = 0; ring < 100; ring++) {
        const u = ring / 100 * Math.PI * 2
        for (let section = 0; section < 5; section++) {
          const start = section / 5 * Math.PI * 2
          const depth = project(u, start + 0.6).depth
          const light = Math.max(0, Math.min(1, (depth + 1.3) / 2.6))
          const lit = Math.pow(light, 2.1)
          context.beginPath()
          for (let j = 0; j <= 18; j++) {
            const p = project(u, start + j / 18 * Math.PI * 2 / 5)
            if (j === 0) context.moveTo(p.x, p.y)
            else context.lineTo(p.x, p.y)
          }
          context.strokeStyle = `rgba(${Math.round(85 + 170 * lit)},${Math.round(67 + 137 * lit)},${Math.round(42 + 117 * lit)},${0.13 + light * 0.71})`
          context.lineWidth = 0.45 + lit * 1.2
          context.stroke()
        }
      }
      // Cyan tracer filaments and quiet nodes along the surface.
      for (let j = 0; j < 8; j++) {
        const v = j / 8 * Math.PI * 2 + 0.2
        context.beginPath()
        for (let k = 0; k <= 150; k++) {
          const p = project(k / 150 * Math.PI * 2, v)
          if (k === 0) context.moveTo(p.x, p.y); else context.lineTo(p.x, p.y)
        }
        context.strokeStyle = j % 3 === 0 ? 'rgba(255, 133, 74, 0.38)' : 'rgba(120, 217, 181, 0.18)'
        context.lineWidth = 0.65; context.stroke()
      }
      for (let j = 0; j < 17; j++) {
        const p = project(j * 2.399, j * 1.8)
        if (p.depth < 0.2) continue
        context.fillStyle = 'rgba(255,179,138,0.9)'
        context.shadowColor = '#ff854a'; context.shadowBlur = 9
        context.fillRect(p.x - 1.2, p.y - 1.2, 2.4, 2.4)
      }
      context.shadowBlur = 0
    }
    let last = 0
    const animate = (time: number) => {
      if (visible && !document.hidden && time - last > 32) { draw(time); last = time }
      frame = requestAnimationFrame(animate)
    }
    resize.observe(canvas); visibility.observe(canvas)
    if (!reduced.matches) frame = requestAnimationFrame(animate)
    return () => { cancelAnimationFrame(frame); resize.disconnect(); visibility.disconnect() }
  }, [])
  return <canvas ref={ref} className="sound-sculpture" aria-hidden="true" />
}
