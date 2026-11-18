import { describe, expect, it } from 'vitest'
import { legacyFixture } from './fixtures/legacy'
import { audioStats, editSamples, keyToHex, spectrum, spectrogram } from '../src/lib/editor'
import { SAMPLE_RATE, capacity, decodeCarrier, decryptAudio, encryptAudio, headerSize, inspectCarrier, parseNotes, readWav, writeWav } from '../src/lib/audio'

const base = { notes: parseNotes('60:1, 62:1, 65:1, 64:1'), bpm: 180, startSeconds: 0 }
const advanced = { ...base, step: .07, harmonic: 3, pattern: 'adaptive' as const, endSeconds: 28 }
const source = writeWav(new Float32Array(SAMPLE_RATE * 30))

describe('manual audio edits', () => {
  const input = Float32Array.from([.1, .2, .3, .4, .5, .6])
  const selection = { start: 1 / SAMPLE_RATE, end: 5 / SAMPLE_RATE }
  it('trims only the selected samples and leaves the input intact', () => {
    const original = input.slice()
    expect(editSamples(input, { kind: 'trim', ...selection })).toEqual(input.slice(1, 5))
    expect(input).toEqual(original)
  })
  it('cuts the selected region and rejoins the remaining samples', () => {
    expect(editSamples(input, { kind: 'cut', ...selection })).toEqual(Float32Array.from([input[0], input[5]]))
    expect(() => editSamples(input, { kind: 'cut', start: 0, end: 6 / SAMPLE_RATE })).toThrow('Tüm sesi')
  })
  it('silences and reverses only the selected region', () => {
    expect(editSamples(input, { kind: 'silence', ...selection })).toEqual(Float32Array.from([input[0], 0, 0, 0, 0, input[5]]))
    expect(editSamples(input, { kind: 'reverse', ...selection })).toEqual(Float32Array.from([input[0], input[4], input[3], input[2], input[1], input[5]]))
  })
  it('applies fades with exact zero/full endpoints', () => {
    const fadeIn = editSamples(input, { kind: 'fade-in', ...selection })
    const fadeOut = editSamples(input, { kind: 'fade-out', ...selection })
    expect(fadeIn[1]).toBe(0); expect(fadeIn[4]).toBe(input[4]); expect(fadeIn[0]).toBe(input[0])
    expect(fadeOut[1]).toBe(input[1]); expect(fadeOut[4]).toBe(0)
  })
  it('applies dB gain, normalizes to −1 dBFS, and rejects clipping', () => {
    const gained = editSamples(input, { kind: 'gain', gainDb: -6, ...selection })
    expect(gained[2]).toBeCloseTo(input[2] * 10 ** (-6 / 20), 6)
    expect(() => editSamples(input, { kind: 'gain', gainDb: 24, ...selection })).toThrow('kırpılmaya')
    const normalized = editSamples(input, { kind: 'normalize', start: 0, end: 6 / SAMPLE_RATE })
    expect(audioStats(normalized).peak).toBeCloseTo(10 ** (-1 / 20), 6)
    expect(editSamples(new Float32Array(6), { kind: 'normalize', start: 0, end: 6 / SAMPLE_RATE }).every(n => n === 0)).toBe(true)
  })
  it('rejects invalid and zero-length regions', () => {
    for (const range of [{ start: -1, end: 1 }, { start: 0, end: 0 }, { start: NaN, end: 1 }, { start: 0, end: 5 }]) expect(() => editSamples(input, { kind: 'silence', ...range })).toThrow()
  })
  it('measures actual peak and RMS', () => {
    const stats = audioStats(Float32Array.from([.5, -.5, .5, -.5]))
    expect(stats.peak).toBe(.5); expect(stats.rms).toBe(.5); expect(stats.clippedSamples).toBe(0)
  })
})

describe('frequency inspection', () => {
  it('finds the frequency bin of a known sine and calibrates full-scale amplitude', () => {
    const bin = 20
    const signal = Float32Array.from({ length: 1024 }, (_, i) => Math.sin(2 * Math.PI * bin * i / 1024))
    const result = spectrum(signal, 0)
    expect(result.indexOf(Math.max(...result))).toBe(bin)
    expect(result[bin]).toBeCloseTo(0, 1)
  })
  it('returns bounded, finite data for silent and short audio', () => {
    const result = spectrogram(new Float32Array(64), 0, 64 / SAMPLE_RATE)
    expect(result.values).toHaveLength(result.columns * result.bins)
    expect(result.values.every(n => Number.isFinite(n) && n <= -90)).toBe(true)
  })
})

describe('encrypted settings and decoder controls', () => {
  it('authenticates advanced settings and round-trips non-default parameters', async () => {
    const result = await encryptAudio(source, 'Yeni 🔑', advanced)
    const info = (await decodeCarrier(result.wav, result.key)).info
    expect(info).toMatchObject({ version: 4, step: .07, harmonic: 3, pattern: 'adaptive', bpm: 180, endSeconds: 28, authenticated: true })
    expect(info.meanDecisionMargin).toBeGreaterThan(.45)
    expect(await decryptAudio(result.wav, result.key)).toBe('Yeni 🔑')
  })
  it.each([.02, .2])('round-trips the supported strength boundary %s', async step => {
    const result = await encryptAudio(source, 'M', { ...advanced, step, harmonic: 6, pattern: 'fixed' })
    expect((await decodeCarrier(result.wav, result.key)).info).toMatchObject({ step, harmonic: 6, pattern: 'fixed' })
    expect(await decryptAudio(result.wav, result.key)).toBe('M')
  })
  it('keeps payload samples after the selected end unchanged', async () => {
    const settings = { ...advanced, endSeconds: 25 }
    const result = await encryptAudio(source, 'M', settings)
    const samples = readWav(result.wav).samples
    expect(samples.subarray(25 * SAMPLE_RATE).every(n => n === 0)).toBe(true)
    expect(capacity(samples.length, settings)).toBeLessThan(capacity(samples.length, { ...settings, endSeconds: 30 }))
    expect(headerSize(advanced)).toBe(76)
  })
  it('supports exact manual alignment after an unmodified carrier is prefixed', async () => {
    const result = await encryptAudio(source, 'Hizala', advanced)
    const { samples } = readWav(result.wav)
    const shift = 1537
    const prefixed = new Float32Array(samples.length + shift)
    prefixed.set(samples, shift)
    const wav = writeWav(prefixed)
    await expect(decryptAudio(wav, result.key)).rejects.toThrow()
    expect(await decryptAudio(wav, result.key, { headerOffsetSamples: shift })).toBe('Hizala')
    await expect(decryptAudio(wav, result.key, { headerOffsetSamples: shift - 1024 })).rejects.toThrow()
    await expect(decryptAudio(wav, '0'.repeat(64), { headerOffsetSamples: shift })).rejects.toThrow('doğrulanamadı')
  })
  it('continues to read NKTV v1 files', async () => {
    const result = legacyFixture(1)
    expect(inspectCarrier(result.wav).version).toBe(1)
    expect(await decryptAudio(result.wav, result.key)).toBe(result.message)
  })
  it('normalizes arbitrary strength precision to the authenticated header', async () => {
    const result = await encryptAudio(source, 'M', { ...advanced, step: .073827 })
    expect((await decodeCarrier(result.wav, result.key)).info.step).toBe(.0738)
    expect(await decryptAudio(result.wav, result.key)).toBe('M')
  })
  it('rejects invalid advanced parameters and header offsets', async () => {
    for (const patch of [{ step: 0 }, { harmonic: 9 }, { endSeconds: -1 }]) await expect(encryptAudio(source, 'M', { ...advanced, ...patch })).rejects.toThrow()
    expect(() => inspectCarrier(source, { headerOffsetSamples: -1 })).toThrow()
    expect(() => inspectCarrier(source, { headerOffsetSamples: .5 })).toThrow()
  })
  it('accepts only full-length Hex or Base64 keys', () => {
    const key = '0123456789abcdef'.repeat(4)
    const base64 = btoa(String.fromCharCode(...Uint8Array.from(key.match(/../g)!, n => parseInt(n, 16))))
    expect(keyToHex(base64, 'base64')).toBe(key)
    expect(keyToHex(key.toUpperCase(), 'hex')).toBe(key)
    expect(() => keyToHex('YWJj', 'base64')).toThrow()
    expect(() => keyToHex('z'.repeat(64), 'hex')).toThrow()
  })
})
