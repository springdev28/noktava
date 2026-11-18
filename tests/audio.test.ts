import { beforeAll, describe, expect, it } from 'vitest'
import { BLOCK_SIZE, DEFAULT_NOTES, SAMPLE_RATE, capacity, decryptAudio, encryptAudio, inspectWav, makeDemo, parseNotes, quadraticWeights, readWav, writeWav, type Encoded } from '../src/lib/audio'

const settings = { notes: parseNotes(DEFAULT_NOTES), bpm: 120, startSeconds: 0 }
let source: ArrayBuffer
let encoded: Encoded

beforeAll(async () => {
  source = makeDemo(48)
  encoded = await encryptAudio(source, 'Şifre 🔐', settings)
}, 20_000)

/** Flip a fixed-header bit in the actual PCM carrier, without changing its structure. */
function flipHeaderBit(wav: ArrayBuffer, block: number) {
  const { samples } = readWav(wav)
  const weights = quadraticWeights(0, 0)
  const basis = Float64Array.from({ length: BLOCK_SIZE }, (_, t) => weights.reduce((sum, c, j) => sum + c * Math.sqrt(2 / BLOCK_SIZE) * Math.cos(Math.PI * (t + .5) * (256 + j) / BLOCK_SIZE), 0))
  let p = 0
  for (let i = 0; i < BLOCK_SIZE; i++) p += samples[block * BLOCK_SIZE + i] * basis[i]
  const next = (Math.round(p / .1) + 1) * .1
  for (let i = 0; i < BLOCK_SIZE; i++) samples[block * BLOCK_SIZE + i] += (next - p) * basis[i]
  return writeWav(samples)
}

describe('note-adaptive encrypted WAV carrier', () => {
  it('recovers Turkish and emoji text from the serialized WAV without the original', async () => {
    expect(await decryptAudio(encoded.wav, encoded.key)).toBe('Şifre 🔐')
    expect(encoded.key).toMatch(/^[a-f0-9]{64}$/)
    expect(readWav(encoded.wav).sampleRate).toBe(48000)
  })
  it('generates independent random keys and ciphertext for the same input', async () => {
    const second = await encryptAudio(source, 'Şifre 🔐', settings)
    expect(second.key).not.toBe(encoded.key)
    expect(new Uint8Array(second.wav)).not.toEqual(new Uint8Array(encoded.wav))
  })
  it('rejects a different well-formed key without releasing plaintext', async () => {
    const wrongKey = (encoded.key[0] === '0' ? '1' : '0') + encoded.key.slice(1)
    await expect(decryptAudio(encoded.wav, wrongKey)).rejects.toThrow('Mesaj doğrulanamadı')
  })
  it('authenticates the public header and rejects a modified IV', async () => {
    await expect(decryptAudio(flipHeaderBit(encoded.wav, 16 * 8), encoded.key)).rejects.toThrow('Mesaj doğrulanamadı')
  })
  it('rejects modified encrypted audio', async () => {
    const { samples } = readWav(encoded.wav)
    const headerBlocks = (28 + settings.notes.length * 2) * 8
    samples.fill(0, headerBlocks * BLOCK_SIZE)
    await expect(decryptAudio(writeWav(samples), encoded.key)).rejects.toThrow('Mesaj doğrulanamadı')
  })
  it('rejects an ordinary WAV and a malformed key', async () => {
    await expect(decryptAudio(source, encoded.key)).rejects.toThrow('noktava. mesajı bulunamadı')
    await expect(decryptAudio(encoded.wav, 'not-a-key')).rejects.toThrow('64')
  })
  it('matches the brief’s normalized Do quadratic pattern', () => {
    expect(quadraticWeights(0, 1)).toEqual([1,1,1,-1,-1,-1,-1,1,1,1,1,-1,1,1,1,-1].map(n => n / 4))
    for (const a of [0, 1]) for (const b of [0, 1]) expect(quadraticWeights(a, b).reduce((sum, n) => sum + n*n, 0)).toBe(1)
  })
  it('accepts exactly the capacity and rejects one extra UTF-8 byte', async () => {
    const max = capacity(readWav(source).samples.length, settings)
    const full = await encryptAudio(source, 'x'.repeat(max), settings)
    expect(await decryptAudio(full.wav, full.key)).toBe('x'.repeat(max))
    await expect(encryptAudio(source, 'x'.repeat(max + 1), settings)).rejects.toThrow('kapasitesi')
  })
  it('validates note, tempo and start settings', () => {
    for (const text of ['', '60', '60:0', '85:1', '60:1,', 'NaN:2']) expect(() => parseNotes(text)).toThrow()
    expect(() => capacity(48 * SAMPLE_RATE, { ...settings, bpm: 0 })).toThrow()
    expect(() => capacity(48 * SAMPLE_RATE, { ...settings, startSeconds: -1 })).toThrow()
    expect(capacity(SAMPLE_RATE, settings)).toBe(0)
  })
  it('honors a custom tempo, phrase and later start', async () => {
    const custom = { notes: parseNotes('67:1, 69:1, 72:2'), bpm: 180, startSeconds: 10 }
    const result = await encryptAudio(source, 'Noktava', custom)
    expect(await decryptAudio(result.wav, result.key)).toBe('Noktava')
  })
  it('leaves enough headroom to recover from full-scale input', async () => {
    const samples = new Float32Array(SAMPLE_RATE * 48).fill(.999)
    const result = await encryptAudio(writeWav(samples), 'M', settings)
    expect(await decryptAudio(result.wav, result.key)).toBe('M')
    expect(readWav(result.wav).samples.every(n => Math.abs(n) < .99)).toBe(true)
  })
  it('rejects truncated and forged RIFF chunks before processing', () => {
    expect(() => readWav(source.slice(0, 100))).toThrow('eksik')
    const corrupt = source.slice(0)
    new DataView(corrupt).setUint32(40, 0xffffffff, true)
    expect(() => readWav(corrupt)).toThrow('eksik')
    expect(() => readWav(new ArrayBuffer(44))).toThrow('WAV')
  })
  it('inspects duration and handles silent waveforms without NaN', () => {
    const result = inspectWav(writeWav(new Float32Array(SAMPLE_RATE)))
    expect(result.duration).toBe(1)
    expect(result.waveform).toHaveLength(80)
    expect(result.waveform.every(n => n === 0)).toBe(true)
  })
  it('normalizes a 44.1 kHz input to a recoverable 48 kHz output', async () => {
    const input = writeWav(new Float32Array(44100 * 48), 44100)
    const result = await encryptAudio(input, 'M', settings)
    expect(readWav(result.wav).sampleRate).toBe(48000)
    expect(await decryptAudio(result.wav, result.key)).toBe('M')
  })
})
