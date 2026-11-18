import { createDecipheriv } from 'node:crypto'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { capacity, decodeCarrier, decryptAudio, encryptAudio, headerBlocks, inspectCarrier, parseNotes, readWav, SAMPLE_RATE, writeWav, type Encoded } from '../src/lib/audio'
import { legacyFixture } from './fixtures/legacy'

const size = 1024, bootBlocks = 28 * 8
const settings = { notes: parseNotes('60:1, 62:1, 65:1, 64:1'), bpm: 240, startSeconds: 0 }
const text = 'Yeni yöntem 🔐'
const source = writeWav(new Float32Array(40 * SAMPLE_RATE))
let encoded: Encoded
beforeAll(async () => { encoded = await encryptAudio(source, text, settings) })

// Independent reference transport and Node/OpenSSL GCM reader. This deliberately
// does not call the application's projection, header, control or decoding helpers.
const vectors = new Map<string, Float64Array>()
function vector(bin: number, a = 0, b = 0) {
  const key = `${bin}/${a}/${b}`
  if (!vectors.has(key)) vectors.set(key, Float64Array.from({ length: size }, (_, t) => {
    let sum = 0
    for (let j = 0; j < 16; j++) {
      const x = [j >> 3 & 1, j >> 2 & 1, j >> 1 & 1, j & 1]
      const sign = (x[0] * x[1] + x[2] * x[3] + a * x[0] + b * x[1]) % 2 ? -1 : 1
      sum += sign / 4 * Math.sqrt(2 / size) * Math.cos(Math.PI * (t + .5) * (bin + j) / size)
    }
    return sum
  }))
  return vectors.get(key)!
}
function pcm(wav: ArrayBuffer) {
  const view = new DataView(wav)
  return Float32Array.from({ length: view.getUint32(40, true) / 2 }, (_, i) => view.getInt16(44 + i * 2, true) / 32768)
}
function project(samples: Float32Array, block: number, basis: Float64Array) {
  return basis.reduce((sum, value, i) => sum + value * samples[block * size + i], 0)
}
function bytesFromAudio(samples: Float32Array, length: number, control = false) {
  const result = Buffer.alloc(length)
  for (let i = 0; i < length * 8; i++) {
    const block = control ? bootBlocks + Math.floor(i / 16) : i
    const bin = control ? 256 + 16 * (i % 16) : 256
    const bit = ((Math.round(project(samples, block, vector(bin)) / .1) % 2) + 2) % 2
    result[i >> 3] |= bit << (7 - i % 8)
  }
  return result
}
function openPacket(bytes: Buffer, key: string, iv: Buffer, aad: Buffer) {
  const decipher = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), iv)
  decipher.setAAD(aad); decipher.setAuthTag(bytes.subarray(-16))
  return Buffer.concat([decipher.update(bytes.subarray(0, -16)), decipher.final()])
}
function referenceDecode(result: Encoded) {
  const samples = pcm(result.wav), bootstrap = bytesFromAudio(samples, 28)
  expect(bootstrap.subarray(0, 5)).toEqual(Buffer.from([78, 75, 84, 86, 4]))
  const encryptedControl = bytesFromAudio(samples, bootstrap.readUInt32LE(8), true)
  const iv = Buffer.from(bootstrap.subarray(16, 28))
  const control = openPacket(encryptedControl, result.key, iv, Buffer.concat([Buffer.from('NKTV4:control'), bootstrap]))
  const ciphertext = Buffer.alloc(control.readUInt32LE(8))
  const count = control.readUInt16LE(20), bpm = control.readUInt16LE(4), step = control.readUInt16LE(6) / 10000
  let cursor = control.readUInt32LE(12) * size, previous = control[24], index = 0, bitIndex = 0
  expect(control[0]).toBe(0)
  while (bitIndex < ciphertext.length * 8) {
    const note = index % count, midi = control[24 + note * 2], duration = control[25 + note * 2]
    const length = duration * 30 / bpm * SAMPLE_RATE
    const center = Math.floor((cursor + length / 2) / size)
    const a = index === 0 ? 0 : ((midi - previous) % 2 + 2) % 2
    const bin = Math.round(2 * size * control[1] * 440 * 2 ** ((midi - 69) / 12) / SAMPLE_RATE) - 7
    for (const block of [center, center + 1]) {
      if (bitIndex === ciphertext.length * 8) break
      expect((block + 1) * size).toBeLessThanOrEqual(control.readUInt32LE(16))
      const p = project(samples, block, vector(bin, control[2] ? 0 : a, control[2] ? 0 : duration % 2))
      ciphertext[bitIndex >> 3] |= (((Math.round(p / step) % 2) + 2) % 2) << (7 - bitIndex % 8)
      bitIndex++
    }
    previous = midi; index++; cursor += length
  }
  iv[11] ^= 1
  const plaintext = openPacket(ciphertext, result.key, iv, Buffer.concat([Buffer.from('NKTV4:message'), bootstrap, encryptedControl]))
  return { plaintext: plaintext.toString('utf8'), control, bootstrap, encryptedControl }
}
function changeBit(wav: ArrayBuffer, block: number, bin = 256) {
  const samples = pcm(wav), basis = vector(bin), value = project(samples, block, basis)
  const change = (Math.round(value / .1) + 1) * .1 - value
  for (let i = 0; i < size; i++) samples[block * size + i] += change * basis[i]
  return writeWav(samples)
}

describe('encrypted in-audio control packets', () => {
  it('is independently recoverable from only PCM and the key', () => {
    const result = referenceDecode(encoded)
    expect(result.plaintext).toBe(text)
    expect(result.control.readUInt16LE(4)).toBe(240)
    expect(result.control.readUInt16LE(20)).toBe(4)
    expect(result.control.subarray(24)).toEqual(Buffer.from([60, 1, 62, 1, 65, 1, 64, 1]))
  })
  it('stores only ordinary WAV chunks and survives lossless PCM repackaging', async () => {
    const raw = new Uint8Array(encoded.wav), view = new DataView(encoded.wav), chunks: string[] = []
    for (let offset = 12; offset < raw.length;) {
      chunks.push(String.fromCharCode(...raw.slice(offset, offset + 4)))
      const length = view.getUint32(offset + 4, true); offset += 8 + length + length % 2
    }
    expect(chunks).toEqual(['fmt ', 'data'])
    expect(await decryptAudio(writeWav(pcm(encoded.wav)), encoded.key)).toBe(text)
  })
  it('exposes no notes, timing, payload length or settings before authentication', () => {
    const info = inspectCarrier(encoded.wav)
    expect(info).toMatchObject({ version: 4, locked: true, authenticated: false, controlEncrypted: true })
    for (const field of ['notes', 'bpm', 'step', 'harmonic', 'pattern', 'startSeconds', 'endSeconds', 'ciphertextBytes', 'ciphertextHex']) expect(info).not.toHaveProperty(field)
  })
  it('uses distinct IVs and binds both encrypted packets to the framing', async () => {
    const spy = vi.spyOn(crypto.subtle, 'encrypt')
    try {
      await encryptAudio(source, 'M', settings)
      expect(spy).toHaveBeenCalledTimes(2)
      const [control, message] = spy.mock.calls.map(call => call[0] as AesGcmParams)
      expect(new Uint8Array(control.iv as Uint8Array)).not.toEqual(new Uint8Array(message.iv as Uint8Array))
      expect(control.tagLength).toBe(128); expect(message.tagLength).toBe(128)
      expect(control.additionalData).not.toEqual(message.additionalData)
    } finally { spy.mockRestore() }
  })
  it.each([0, 24 * 8, 47 * 8])('rejects an altered control bit %s before opening the payload', async bit => {
    const damaged = changeBit(encoded.wav, bootBlocks + Math.floor(bit / 16), 256 + 16 * (bit % 16))
    const spy = vi.spyOn(crypto.subtle, 'decrypt')
    try {
      await expect(decodeCarrier(damaged, encoded.key)).rejects.toThrow('doğrulanamadı')
      expect(spy).toHaveBeenCalledTimes(1)
    } finally { spy.mockRestore() }
  })
  it('rejects truncation within the control packet before allocating from its header', async () => {
    const samples = pcm(encoded.wav).slice(0, (bootBlocks + 1) * size)
    await expect(decryptAudio(writeWav(samples), encoded.key)).rejects.toThrow('kesilmiş')
    // A changed high length bit advertises more bytes than either bounds permit.
    const enormousLength = changeBit(encoded.wav, 11 * 8)
    expect(() => inspectCarrier(enormousLength)).toThrow('geçersiz')
  })
  it('accounts for encrypted timing overhead before enabling encryption', async () => {
    const notes = Array.from({ length: 8192 }, (_, i) => ({ midi: 60, duration: 1, startSeconds: i / 20, durationSeconds: .1 }))
    const largeScore = { ...settings, notes, timing: 'timeline' as const }
    expect(headerBlocks(largeScore)).toBeGreaterThan(600 * SAMPLE_RATE / size)
    expect(capacity(600 * SAMPLE_RATE, largeScore)).toBe(0)
    await expect(encryptAudio(source, 'M', largeScore)).rejects.toThrow('kapasitesi 0')
  })
  it('matches capacity after sub-sample timing and rhythm are serialized', async () => {
    const timed = { ...settings, timing: 'loop' as const, notes: [
      { midi: 60, duration: 1.49999999, startSeconds: .00001, durationSeconds: .125001 },
      { midi: 65, duration: 1, startSeconds: .2, durationSeconds: .12501 },
    ] }
    const max = capacity(readWav(source).samples.length, timed)
    const full = await encryptAudio(source, 'x'.repeat(max), timed)
    expect(await decryptAudio(full.wav, full.key)).toBe('x'.repeat(max))
    await expect(encryptAudio(source, 'x'.repeat(max + 1), timed)).rejects.toThrow('kapasitesi')
  })
  it('preserves the last payload block at an exact serialized end sample', async () => {
    const bounded = { notes: [{ midi: 60, duration: 1, startSeconds: 0, durationSeconds: 2048 / SAMPLE_RATE }],
      bpm: 120, startSeconds: 0, endSeconds: (395 * size + .5) / SAMPLE_RATE, timing: 'loop' as const }
    const wav = writeWav(new Float32Array(10 * SAMPLE_RATE))
    expect(capacity(10 * SAMPLE_RATE, bounded)).toBe(2)
    const result = await encryptAudio(wav, 'OK', bounded)
    expect(await decryptAudio(result.wav, result.key)).toBe('OK')
  })
})

describe('saved legacy carriers', () => {
  it.each([1, 2, 3])('reads the pre-update v%s fixture', async version => {
    const fixture = legacyFixture(version)
    expect(inspectCarrier(fixture.wav)).toMatchObject({ version, locked: false, authenticated: false, controlEncrypted: false })
    expect(await decryptAudio(fixture.wav, fixture.key)).toBe(fixture.message)
    await expect(decryptAudio(fixture.wav, '00'.repeat(32))).rejects.toThrow('doğrulanamadı')
  })
  it('still authenticates every note in a legacy v3 metadata chunk', async () => {
    const fixture = legacyFixture(3), wav = fixture.wav.slice(0), view = new DataView(wav)
    const metadata = 44 + view.getUint32(40, true) + 8
    view.setFloat32(metadata + 8 + 9, 2, true)
    await expect(decryptAudio(wav, fixture.key)).rejects.toThrow('doğrulanamadı')
  })
})
