import { describe, expect, it } from 'vitest'
import { buildWavePyramid, clampView, preciseTime, timeTicks, waveRange, zoomView } from '../src/lib/waveform'
import { editSamples } from '../src/lib/editor'
import { SAMPLE_RATE } from '../src/lib/audio'

describe('waveform display and navigation', () => {
  it('retains true positive and negative extrema and RMS across cache boundaries', () => {
    const samples = Float32Array.from({ length: 5000 }, (_, i) => .3 + .5 * Math.sin(i / 17))
    samples[1024] = 1; samples[2177] = -1
    const pyramid = buildWavePyramid(samples)
    for (const [start, end] of [[0, 5000], [1, 127], [63, 128], [61, 4555], [1024, 1025], [4990, 5000]]) {
      const values = samples.slice(start, end), result = waveRange(pyramid, start, end)
      expect(result.min).toBe(Math.min(...values)); expect(result.max).toBe(Math.max(...values))
      expect(result.rms).toBeCloseTo(Math.sqrt(values.reduce((sum, n) => sum + n * n, 0) / values.length), 7)
    }
    const dc = waveRange(buildWavePyramid(new Float32Array(200).fill(.5)), 10, 190)
    expect(dc).toEqual({ min: .5, max: .5, rms: .5 })
  })
  it('keeps the anchor under the same screen position when zooming', () => {
    const result = zoomView(20, 10, 1, 23, 90)
    expect(result.start).toBeCloseTo(22.7)
    expect((23 - result.start) / result.span).toBeCloseTo(.3)
    expect(zoomView(0, 90, .002, 0, 90).span).toBe(.002)
  })
  it('bounds viewport navigation and supports sub-millisecond audio', () => {
    expect(clampView(89, 10, 90)).toEqual({ start: 80, span: 10 })
    expect(clampView(-1, 100, 90)).toEqual({ start: 0, span: 90 })
    expect(clampView(1, 0, 1 / SAMPLE_RATE)).toEqual({ start: 0, span: 1 / SAMPLE_RATE })
  })
  it('uses meaningful ticks and retains precision at sample scale', () => {
    const normal = timeTicks(0, 10, 1000)
    expect(normal.step).toBe(1)
    const detail = timeTicks(1.002, .002, 800)
    expect(detail.step).toBeLessThan(.001)
    expect(detail.ticks.every(n => n >= 1.002 - 1e-7 && n <= 1.004 + 1e-7)).toBe(true)
    expect(preciseTime(60.12345, 5)).toBe('01:00.12345')
  })
})
describe('direct sample drawing', () => {
  it('changes only the drawn samples and keeps the source intact for undo', () => {
    const input = Float32Array.of(.1, .2, .3, .4, .5)
    const result = editSamples(input, { kind: 'draw', start: 1 / SAMPLE_RATE, end: 3 / SAMPLE_RATE, drawnSamples: Float32Array.of(-.8, .9) })
    expect(result).toEqual(Float32Array.of(.1, -.8, .9, .4, .5))
    expect(input).toEqual(Float32Array.of(.1, .2, .3, .4, .5))
  })
  it('rejects non-finite, clipped or mismatched sample edits', () => {
    const input = new Float32Array(20)
    for (const values of [Float32Array.of(NaN), Float32Array.of(1.01), new Float32Array(2)]) {
      expect(() => editSamples(input, { kind: 'draw', start: 0, end: 1 / SAMPLE_RATE, drawnSamples: values })).toThrow()
    }
  })
})
