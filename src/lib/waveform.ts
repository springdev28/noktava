import { SAMPLE_RATE } from './audio'

export type WaveLevel = { stride: number; min: Float32Array; max: Float32Array; energy: Float64Array; count: Uint32Array }
export type WavePyramid = { samples: Float32Array; levels: WaveLevel[] }
/** Cache real peaks and power at multiple resolutions. No decorative bars. */
export function buildWavePyramid(samples: Float32Array): WavePyramid {
  const stride = 64, size = Math.ceil(samples.length / stride)
  const first: WaveLevel = { stride, min: new Float32Array(size), max: new Float32Array(size), energy: new Float64Array(size), count: new Uint32Array(size) }
  for (let bucket = 0; bucket < size; bucket++) {
    let min = Infinity, max = -Infinity, energy = 0
    const start = bucket * stride, end = Math.min(samples.length, start + stride)
    for (let i = start; i < end; i++) { min = Math.min(min, samples[i]); max = Math.max(max, samples[i]); energy += samples[i] ** 2 }
    first.min[bucket] = min; first.max[bucket] = max; first.energy[bucket] = energy; first.count[bucket] = end - start
  }
  const levels = [first]
  while (levels[levels.length - 1].min.length > 1) {
    const previous = levels[levels.length - 1], length = Math.ceil(previous.min.length / 2)
    const next: WaveLevel = { stride: previous.stride * 2, min: new Float32Array(length), max: new Float32Array(length), energy: new Float64Array(length), count: new Uint32Array(length) }
    for (let i = 0; i < length; i++) {
      const a = i * 2, b = a + 1, hasB = b < previous.min.length
      next.min[i] = hasB ? Math.min(previous.min[a], previous.min[b]) : previous.min[a]
      next.max[i] = hasB ? Math.max(previous.max[a], previous.max[b]) : previous.max[a]
      next.energy[i] = previous.energy[a] + (hasB ? previous.energy[b] : 0)
      next.count[i] = previous.count[a] + (hasB ? previous.count[b] : 0)
    }
    levels.push(next)
  }
  return { samples, levels }
}

/** Exact extrema and RMS for a half-open sample range, using cached full buckets. */
export function waveRange(pyramid: WavePyramid, from: number, to: number) {
  const start = Math.max(0, Math.floor(from)), end = Math.min(pyramid.samples.length, Math.max(start + 1, Math.ceil(to)))
  let min = Infinity, max = -Infinity, energy = 0, at = start
  while (at < end) {
    let level = Math.min(pyramid.levels.length - 1, Math.floor(Math.log2(Math.max(1, (end - at) / 64))))
    while (level >= 0 && (at % pyramid.levels[level].stride || at + pyramid.levels[level].stride > end)) level--
    if (level < 0) {
      const value = pyramid.samples[at++]; min = Math.min(min, value); max = Math.max(max, value); energy += value * value
    } else {
      const data = pyramid.levels[level], index = at / data.stride
      min = Math.min(min, data.min[index]); max = Math.max(max, data.max[index]); energy += data.energy[index]; at += data.stride
    }
  }
  return end > start ? { min, max, rms: Math.sqrt(energy / (end - start)) } : { min: 0, max: 0, rms: 0 }
}

export function clampView(start: number, span: number, duration: number, minSpan = 32 / SAMPLE_RATE) {
  const length = Math.min(duration, Math.max(Math.min(minSpan, duration), span))
  return { start: Math.max(0, Math.min(duration - length, start)), span: length }
}
/** Keep the time beneath the mouse/cursor fixed while changing the visible span. */
export function zoomView(start: number, span: number, nextSpan: number, anchor: number, duration: number, minSpan = 32 / SAMPLE_RATE) {
  const fraction = Math.max(0, Math.min(1, (anchor - start) / span))
  const view = clampView(0, nextSpan, duration, minSpan)
  return clampView(anchor - fraction * view.span, view.span, duration, minSpan)
}
export function timeTicks(start: number, span: number, width: number) {
  const desired = span / Math.max(1, Math.floor(width / 92))
  const power = 10 ** Math.floor(Math.log10(Math.max(desired, 1e-7)))
  const step = [1, 2, 5, 10].map(n => n * power).find(n => n >= desired) ?? 10 * power
  const ticks: number[] = []
  for (let n = Math.ceil((start - step * 1e-6) / step); n * step <= start + span + step * 1e-6; n++) ticks.push(n * step)
  return { ticks, step }
}
export function preciseTime(seconds: number, digits = 3) {
  const scale = 10 ** digits, units = Math.round(Math.max(0, seconds) * scale)
  return `${Math.floor(units / (60 * scale)).toString().padStart(2, '0')}:${((units % (60 * scale)) / scale).toFixed(digits).padStart(digits ? 3 + digits : 2, '0')}`
}
