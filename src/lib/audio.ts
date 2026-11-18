/** Local, experimental NKTV v1 carrier. See docs/protocol.md. */
export const SAMPLE_RATE = 48_000
export const BLOCK_SIZE = 1024
export const MAX_FILE_BYTES = 50 * 1024 * 1024
export const MAX_CARRIER_BYTES = 60 * 1024 * 1024
export const DEFAULT_NOTES = '60:2, 62:2, 65:1, 64:1'
const STEP = 0.1
const MAGIC = [78, 75, 84, 86]
const BASE_HEADER = 28
const encoder = new TextEncoder()

export type Note = { midi: number; duration: number; startSeconds?: number; durationSeconds?: number }
export type Settings = {
  notes: Note[]; bpm: number; startSeconds: number; endSeconds?: number
  step?: number; harmonic?: number; pattern?: 'adaptive' | 'fixed'
  timing?: 'timeline' | 'loop'
}
export type DecodeOptions = { headerOffsetSamples?: number }
export type CarrierInfo = {
  version: number; headerBytes: number; ciphertextBytes: number; bpm: number; notes: Note[]
  startSeconds: number; endSeconds: number; step: number; harmonic: number
  pattern: 'adaptive' | 'fixed'; iv: string; headerHex: string; ciphertextHex: string
  meanDecisionMargin: number; headerOffsetSamples: number; authenticated: false
}
export function headerSize(settings: Settings) {
  if (settings.timing) return 36
  return (isAdvanced(settings) ? 36 : BASE_HEADER) + settings.notes.length * 2
}
function isAdvanced(settings: Settings) {
  return settings.step !== undefined || settings.harmonic !== undefined || settings.pattern !== undefined || settings.endSeconds !== undefined
}
export type AudioData = { samples: Float32Array; sampleRate: number }
export type Inspection = { duration: number; sampleCount: number; waveform: number[] }
export type Encoded = { wav: ArrayBuffer; key: string; bytes: number }

export class AudioError extends Error {}

export function parseNotes(input: string): Note[] {
  const tokens = input.split(',').map(s => s.trim())
  if (!tokens.length || tokens.length > 16 || tokens.some(s => !/^\d{2}:\d$/.test(s))) {
    throw new AudioError('Notaları 60:2, 62:2 biçiminde yaz. En fazla 16 nota kullanabilirsin.')
  }
  const notes = tokens.map(token => {
    const [midi, duration] = token.split(':').map(Number)
    return { midi, duration }
  })
  if (notes.some(n => n.midi < 36 || n.midi > 84 || n.duration < 1 || n.duration > 8)) {
    throw new AudioError('MIDI notası 36–84, süre ise 1–8 sekizlik arasında olmalı.')
  }
  return notes
}

function validateSettings(settings: Settings) {
  if (settings.timing && !['timeline', 'loop'].includes(settings.timing)) throw new AudioError('Geçersiz nota zamanlaması.')
  if (settings.endSeconds !== undefined && (!Number.isFinite(settings.endSeconds) || settings.endSeconds <= settings.startSeconds || settings.endSeconds > 600)) throw new AudioError('Bitiş, başlangıçtan sonra ve en fazla 600 saniye olmalı.')
  if (settings.step !== undefined && (!Number.isFinite(settings.step) || settings.step < 0.02 || settings.step > 0.2)) throw new AudioError('Yerleştirme gücü 0.02–0.20 arasında olmalı.')
  if (settings.harmonic !== undefined && (!Number.isInteger(settings.harmonic) || settings.harmonic < 2 || settings.harmonic > 6)) throw new AudioError('Harmonik 2–6 arasında olmalı.')
  if (settings.pattern !== undefined && !['adaptive', 'fixed'].includes(settings.pattern)) throw new AudioError('Geçersiz desen.')
  if (!Number.isInteger(settings.bpm) || settings.bpm < (settings.timing ? 1 : 40) || settings.bpm > (settings.timing ? 999 : 240)) {
    throw new AudioError('Tempo 40–240 BPM arasında bir tam sayı olmalı.')
  }
  if (!Number.isFinite(settings.startSeconds) || settings.startSeconds < 0 || settings.startSeconds > 3600) {
    throw new AudioError('Başlangıç saniyesi 0–3600 arasında olmalı.')
  }
  if (settings.timing) {
    if (!settings.notes.length || settings.notes.length > 8192 || settings.notes.some(n =>
      !Number.isInteger(n.midi) || n.midi < 0 || n.midi > 127 || !Number.isFinite(n.duration) || n.duration <= 0 || n.duration > 9600 ||
      !Number.isFinite(n.startSeconds) || n.startSeconds! < 0 || n.startSeconds! > 600 ||
      !Number.isFinite(n.durationSeconds) || n.durationSeconds! < 1 / SAMPLE_RATE || n.startSeconds! + n.durationSeconds! > 600.001)) {
      throw new AudioError('Nota zamanları geçersiz. En fazla 8192 nota ve 10 dakika kullan.')
    }
    return
  }
  if (!settings.notes.length || settings.notes.length > 16 || settings.notes.some(n =>
    !Number.isInteger(n.midi) || n.midi < 36 || n.midi > 84 ||
    !Number.isInteger(n.duration) || n.duration < 1 || n.duration > 8)) {
    throw new AudioError('Nota dizisi geçersiz.')
  }
}

function ascii(view: DataView, start: number, length: number) {
  return String.fromCharCode(...new Uint8Array(view.buffer, view.byteOffset + start, length))
}

/** Strict, bounded RIFF parsing; import only uncompressed PCM / IEEE float WAV. */
export function readWav(buffer: ArrayBuffer): AudioData {
  if (buffer.byteLength > MAX_CARRIER_BYTES) throw new AudioError('WAV dosyası 60 MB sınırını aşıyor.')
  if (buffer.byteLength < 44) throw new AudioError('Geçerli bir WAV dosyası seç.')
  const view = new DataView(buffer)
  if (ascii(view, 0, 4) !== 'RIFF' || ascii(view, 8, 4) !== 'WAVE') {
    throw new AudioError('Bu dosya WAV biçiminde değil. Sıkıştırılmamış bir WAV dosyası seç.')
  }
  const riffEnd = view.getUint32(4, true) + 8
  if (riffEnd > buffer.byteLength || riffEnd < 44) throw new AudioError('WAV dosyası eksik veya bozulmuş.')
  let format: { kind: number; channels: number; rate: number; bits: number; align: number } | undefined
  let dataStart = 0
  let dataSize = 0
  for (let offset = 12; offset + 8 <= riffEnd;) {
    const id = ascii(view, offset, 4)
    const size = view.getUint32(offset + 4, true)
    const start = offset + 8
    if (start + size > riffEnd) throw new AudioError('WAV dosyasında eksik bir veri bölümü var.')
    if (id === 'fmt ') {
      if (size < 16) throw new AudioError('WAV ses başlığı geçersiz.')
      format = { kind: view.getUint16(start, true), channels: view.getUint16(start + 2, true),
        rate: view.getUint32(start + 4, true), align: view.getUint16(start + 12, true), bits: view.getUint16(start + 14, true) }
    } else if (id === 'data' && !dataStart) {
      dataStart = start
      dataSize = size
    }
    offset = start + size + (size % 2)
  }
  if (!format || !dataStart || !dataSize) throw new AudioError('WAV dosyasında ses verisi bulunamadı.')
  const { kind, channels, rate, bits, align } = format
  if (!((kind === 1 && [16, 24, 32].includes(bits)) || (kind === 3 && bits === 32)) ||
    channels < 1 || channels > 2 || rate < 8000 || rate > 192000 || align !== channels * bits / 8 || dataSize % align) {
    throw new AudioError('16/24/32 bit PCM veya 32 bit float, mono/stereo WAV kullan. Sıkıştırılmış WAV desteklenmiyor.')
  }
  const count = dataSize / align
  if (count / rate > 600) throw new AudioError('En fazla 10 dakikalık bir ses dosyası kullan.')
  const samples = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    let sample = 0
    for (let channel = 0; channel < channels; channel++) {
      const p = dataStart + i * align + channel * bits / 8
      let value: number
      if (kind === 3) value = view.getFloat32(p, true)
      else if (bits === 16) value = view.getInt16(p, true) / 32768
      else if (bits === 32) value = view.getInt32(p, true) / 2147483648
      else {
        let integer = view.getUint8(p) | (view.getUint8(p + 1) << 8) | (view.getUint8(p + 2) << 16)
        if (integer & 0x800000) integer -= 0x1000000
        value = integer / 8388608
      }
      if (!Number.isFinite(value) || Math.abs(value) > 1.0001) throw new AudioError('Ses dosyasında geçersiz örnekler var.')
      sample += value / channels
    }
    samples[i] = sample
  }
  return { samples, sampleRate: rate }
}

export function resample(audio: AudioData): Float32Array {
  if (audio.sampleRate === SAMPLE_RATE) return audio.samples
  const output = new Float32Array(Math.floor(audio.samples.length * SAMPLE_RATE / audio.sampleRate))
  for (let i = 0; i < output.length; i++) {
    const source = i * audio.sampleRate / SAMPLE_RATE
    const left = Math.floor(source)
    const t = source - left
    output[i] = audio.samples[left] * (1 - t) + (audio.samples[Math.min(left + 1, audio.samples.length - 1)] ?? 0) * t
  }
  return output
}

export function writeWav(samples: Float32Array, rate = SAMPLE_RATE): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const label = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)))
  label(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); label(8, 'WAVE')
  label(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true)
  view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  for (let i = 0; i < samples.length; i++) view.setInt16(44 + i * 2, Math.max(-32768, Math.min(32767, Math.round(samples[i] * 32768))), true)
  return buffer
}

export function inspectWav(buffer: ArrayBuffer): Inspection {
  const audio = readWav(buffer)
  const waveform = Array.from({ length: 80 }, (_, i) => {
    const start = Math.floor(i * audio.samples.length / 80)
    const end = Math.floor((i + 1) * audio.samples.length / 80)
    let sum = 0
    for (let j = start; j < end; j++) sum += audio.samples[j] ** 2
    return Math.sqrt(sum / Math.max(1, end - start))
  })
  const peak = Math.max(...waveform, 0.0001)
  return { duration: audio.samples.length / audio.sampleRate,
    sampleCount: Math.floor(audio.samples.length * SAMPLE_RATE / audio.sampleRate), waveform: waveform.map(n => n / peak) }
}

function startBlock(settings: Settings) {
  return Math.max(headerSize(settings) * 8, Math.ceil(settings.startSeconds * SAMPLE_RATE / BLOCK_SIZE))
}

/** Two blocks around each note's midpoint, with the supplied phrase repeated. */
function* positions(sampleCount: number, settings: Settings, firstBlock = startBlock(settings)) {
  sampleCount = Math.min(sampleCount, settings.endSeconds === undefined ? sampleCount : Math.floor(settings.endSeconds * SAMPLE_RATE))
  if (settings.timing) {
    const notes = [...settings.notes].sort((a, b) => a.startSeconds! - b.startSeconds! || a.midi - b.midi)
    const period = Math.max(...notes.map(n => Math.round(n.startSeconds! * SAMPLE_RATE) + Math.round(n.durationSeconds! * SAMPLE_RATE)))
    if (period < BLOCK_SIZE * 2) return
    if (settings.timing === 'loop' && Math.ceil(sampleCount / period) * notes.length > 1_000_000) throw new AudioError('Nota dizisi çok yoğun. Tekrarı kapat veya daha az nota kullan.')
    const used = new Set<number>()
    let previous = notes[0].midi, index = 0
    for (let offset = settings.timing === 'loop' ? firstBlock * BLOCK_SIZE : 0; offset < sampleCount; offset += period) {
      for (const note of notes) {
        const from = offset + Math.round(note.startSeconds! * SAMPLE_RATE)
        const to = from + Math.round(note.durationSeconds! * SAMPLE_RATE)
        const center = Math.max(Math.ceil(from / BLOCK_SIZE), Math.floor((from + to) / (2 * BLOCK_SIZE)) - 1)
        const bin = Math.round(2 * BLOCK_SIZE * (settings.harmonic ?? 4) * 440 * 2 ** ((note.midi - 69) / 12) / SAMPLE_RATE) - 7
        const a = index++ === 0 ? 0 : ((note.midi - previous) % 2 + 2) % 2
        previous = note.midi
        // Never overwrite another note or the bootstrap header. Very short,
        // overlapping and out-of-band notes remain in the preview/metadata.
        if (center < firstBlock || (center + 2) * BLOCK_SIZE > Math.min(to, sampleCount) ||
          used.has(center) || used.has(center + 1) || bin < 1 || bin + 15 >= BLOCK_SIZE) continue
        for (const block of [center, center + 1]) {
          used.add(block)
          yield { block, midi: note.midi, a, b: Math.round(note.duration) % 2 }
        }
      }
      if (settings.timing !== 'loop') break
    }
    return
  }
  let cursor = firstBlock * BLOCK_SIZE
  let index = 0
  let previous = settings.notes[0].midi
  while (cursor < sampleCount) {
    const note = settings.notes[index % settings.notes.length]
    const length = note.duration * (30 / settings.bpm) * SAMPLE_RATE
    const center = Math.floor((cursor + length / 2) / BLOCK_SIZE)
    const a = index === 0 ? 0 : ((note.midi - previous) % 2 + 2) % 2
    for (const block of [center, center + 1]) {
      if ((block + 1) * BLOCK_SIZE > sampleCount) return
      yield { block, midi: note.midi, a, b: note.duration % 2 }
    }
    cursor += length
    previous = note.midi
    index++
  }
}

/** v3 carries exact note timing in an authenticated RIFF chunk, so a long MIDI
 * score does not consume the entire song as an in-audio bootstrap header. */
function timingMetadata(settings: Settings) {
  const bytes = new Uint8Array(8 + settings.notes.length * 13), view = new DataView(bytes.buffer)
  bytes.set([78, 84, 77, 1]); bytes[4] = settings.timing === 'loop' ? 1 : 0
  view.setUint16(6, settings.notes.length, true)
  settings.notes.forEach((n, i) => {
    const at = 8 + i * 13
    bytes[at] = n.midi
    view.setUint32(at + 1, Math.round(n.startSeconds! * SAMPLE_RATE), true)
    view.setUint32(at + 5, Math.round(n.durationSeconds! * SAMPLE_RATE), true)
    view.setFloat32(at + 9, n.duration, true)
  })
  return bytes
}
function readTiming(bytes: Uint8Array) {
  if (bytes.length < 8 || bytes[0] !== 78 || bytes[1] !== 84 || bytes[2] !== 77 || bytes[3] !== 1 || bytes[4] > 1 || bytes[5] !== 0) throw new AudioError('Nota zaman başlığı eksik veya bozulmuş.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), count = view.getUint16(6, true)
  if (!count || count > 8192 || bytes.length !== 8 + count * 13) throw new AudioError('Nota zaman başlığı eksik veya bozulmuş.')
  return { timing: bytes[4] ? 'loop' as const : 'timeline' as const, notes: Array.from({ length: count }, (_, i) => {
    const at = 8 + i * 13
    return { midi: bytes[at], startSeconds: view.getUint32(at + 1, true) / SAMPLE_RATE, durationSeconds: view.getUint32(at + 5, true) / SAMPLE_RATE, duration: view.getFloat32(at + 9, true) }
  }) }
}
function getTimingChunk(buffer: ArrayBuffer) {
  const view = new DataView(buffer), end = view.getUint32(4, true) + 8
  let result: Uint8Array | undefined
  for (let offset = 12; offset + 8 <= end;) {
    const length = view.getUint32(offset + 4, true), start = offset + 8
    if (start + length > end) throw new AudioError('Nota zaman başlığı eksik veya bozulmuş.')
    if (ascii(view, offset, 4) === 'nktm') {
      if (result) throw new AudioError('Nota zaman başlığı eksik veya bozulmuş.')
      result = new Uint8Array(buffer, start, length)
    }
    offset = start + length + length % 2
  }
  if (!result) throw new AudioError('Nota zaman başlığı eksik veya bozulmuş.')
  return result
}
function joinBytes(a: Uint8Array, b: Uint8Array) { const bytes = new Uint8Array(a.length + b.length); bytes.set(a); bytes.set(b, a.length); return bytes }
function withTimingChunk(wav: ArrayBuffer, metadata: Uint8Array) {
  const result = new ArrayBuffer(wav.byteLength + 8 + metadata.length + metadata.length % 2), bytes = new Uint8Array(result), view = new DataView(result)
  bytes.set(new Uint8Array(wav)); bytes.set([110, 107, 116, 109], wav.byteLength)
  view.setUint32(wav.byteLength + 4, metadata.length, true); bytes.set(metadata, wav.byteLength + 8)
  view.setUint32(4, result.byteLength - 8, true)
  return result
}

export function capacity(sampleCount: number, settings: Settings): number {
  validateSettings(settings)
  let bits = 0
  for (const position of positions(sampleCount, settings)) { void position; bits++ }
  return Math.max(0, Math.floor(bits / 8) - 16)
}

const basisCache = new Map<string, Float64Array>()
export function quadraticWeights(a: number, b: number): number[] {
  return Array.from({ length: 16 }, (_, j) => {
    const x1 = (j >> 3) & 1, x2 = (j >> 2) & 1, x3 = (j >> 1) & 1, x4 = j & 1
    return ((x1 * x2 + x3 * x4 + a * x1 + b * x2) % 2 ? -1 : 1) / 4
  })
}

function basis(firstBin: number, a: number, b: number): Float64Array {
  const key = `${firstBin}:${a}:${b}`
  const cached = basisCache.get(key)
  if (cached) return cached
  const weights = quadraticWeights(a, b)
  const vector = new Float64Array(BLOCK_SIZE)
  // A projection onto this vector equals the weighted 16-bin orthonormal DCT.
  for (let t = 0; t < BLOCK_SIZE; t++) {
    for (let j = 0; j < 16; j++) vector[t] += weights[j] * Math.sqrt(2 / BLOCK_SIZE) * Math.cos(Math.PI * (t + 0.5) * (firstBin + j) / BLOCK_SIZE)
  }
  if (basisCache.size > 128) basisCache.clear()
  basisCache.set(key, vector)
  return vector
}

function noteBasis(midi: number, a: number, b: number, harmonic = 4) {
  const frequency = 440 * 2 ** ((midi - 69) / 12)
  return basis(Math.round(2 * BLOCK_SIZE * harmonic * frequency / SAMPLE_RATE) - 7, a, b)
}

function projection(samples: Float32Array, block: number, vector: Float64Array) {
  let result = 0
  const offset = block * BLOCK_SIZE
  for (let i = 0; i < BLOCK_SIZE; i++) result += samples[offset + i] * vector[i]
  return result
}

function writeBit(samples: Float32Array, block: number, vector: Float64Array, bit: number, step = STEP) {
  const p = projection(samples, block, vector)
  const target = step * (2 * Math.round((p / step - bit) / 2) + bit)
  for (let i = 0; i < BLOCK_SIZE; i++) samples[block * BLOCK_SIZE + i] += (target - p) * vector[i]
}

function readBit(samples: Float32Array, block: number, vector: Float64Array, step = STEP) {
  return ((Math.round(projection(samples, block, vector) / step) % 2) + 2) % 2
}

function bitAt(bytes: Uint8Array, i: number) { return (bytes[i >> 3] >> (7 - (i % 8))) & 1 }

function readHeaderBytes(samples: Float32Array, length: number) {
  if (samples.length < length * 8 * BLOCK_SIZE) throw new AudioError('Bu ses dosyası noktava. başlığı için çok kısa.')
  const bytes = new Uint8Array(length)
  const vector = basis(256, 0, 0)
  for (let i = 0; i < length * 8; i++) bytes[i >> 3] |= readBit(samples, i, vector) << (7 - (i % 8))
  return bytes
}

export async function encryptAudio(buffer: ArrayBuffer, message: string, settings: Settings): Promise<Encoded> {
  validateSettings(settings)
  const metadata = settings.timing ? timingMetadata(settings) : undefined
  if (metadata) settings = { ...settings, ...readTiming(metadata) }
  if (settings.step !== undefined) settings = { ...settings, step: Math.round(settings.step * 10000) / 10000 }
  const plaintext = encoder.encode(message)
  if (!message.trim()) throw new AudioError('Önce gizlemek istediğin mesajı yaz.')
  const samples = resample(readWav(buffer))
  const available = capacity(samples.length, settings)
  if (plaintext.length > available) throw new AudioError(`Bu sesin kapasitesi ${available} bayt; mesajın ${plaintext.length} bayt. Daha uzun bir ses seç veya mesajını kısalt.`)
  if (!globalThis.crypto?.subtle) throw new AudioError('Şifreleme için HTTPS veya localhost üzerinden açmalısın.')
  const rawKey = crypto.getRandomValues(new Uint8Array(32))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const advanced = !!settings.timing || isAdvanced(settings)
  const base = advanced ? 36 : BASE_HEADER
  const header = new Uint8Array(headerSize(settings))
  const view = new DataView(header.buffer)
  header.set(MAGIC); header[4] = metadata ? 3 : advanced ? 2 : 1; header[5] = metadata ? 0 : settings.notes.length
  view.setUint16(6, settings.bpm, true); view.setUint32(8, plaintext.length + 16, true)
  view.setUint32(12, startBlock(settings), true); header.set(iv, 16)
  if (advanced) {
    view.setUint16(28, Math.round((settings.step ?? STEP) * 10000), true)
    header[30] = settings.harmonic ?? 4; header[31] = settings.pattern === 'fixed' ? 1 : 0
    view.setUint32(32, Math.min(samples.length, Math.floor((settings.endSeconds ?? samples.length / SAMPLE_RATE) * SAMPLE_RATE)), true)
  }
  if (!metadata) settings.notes.forEach((n, i) => { header[base + 2 * i] = n.midi; header[base + 2 * i + 1] = n.duration })
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: metadata ? joinBytes(header, metadata) : header, tagLength: 128 }, key, plaintext))
  // Leave headroom for the bounded QIM perturbation; never clip an embedded bit.
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  if (peak > 0.8) for (let i = 0; i < samples.length; i++) samples[i] *= 0.8 / peak
  const fixedBasis = basis(256, 0, 0)
  for (let i = 0; i < header.length * 8; i++) writeBit(samples, i, fixedBasis, bitAt(header, i))
  let i = 0
  for (const p of positions(samples.length, settings)) {
    writeBit(samples, p.block, noteBasis(p.midi, settings.pattern === 'fixed' ? 0 : p.a, settings.pattern === 'fixed' ? 0 : p.b, settings.harmonic), bitAt(ciphertext, i++), settings.step)
    if (i === ciphertext.length * 8) break
  }
  const keyText = Array.from(rawKey, n => n.toString(16).padStart(2, '0')).join('')
  rawKey.fill(0)
  const wav = writeWav(samples)
  return { wav: metadata ? withTimingChunk(wav, metadata) : wav, key: keyText, bytes: plaintext.length }
}

function readCarrier(buffer: ArrayBuffer, options: DecodeOptions = {}) {
  const audio = readWav(buffer)
  if (audio.sampleRate !== SAMPLE_RATE) throw new AudioError('noktava. çıktısı 48 kHz olmalı. Yeniden örneklenmemiş özgün çıktıyı kullan.')
  const offset = options.headerOffsetSamples ?? 0
  if (!Number.isInteger(offset) || offset < 0 || offset > SAMPLE_RATE * 60 || offset >= audio.samples.length) throw new AudioError('Başlık konumu 0–2.880.000 örnek arasında ve dosyanın içinde olmalı.')
  const samples = audio.samples.subarray(offset)
  const preliminary = readHeaderBytes(samples, BASE_HEADER)
  if (!MAGIC.every((n, i) => preliminary[i] === n) || ![1, 2, 3].includes(preliminary[4])) throw new AudioError('noktava. mesajı bulunamadı. Dosya değiştirilmiş veya başlık konumu yanlış olabilir.')
  const noteCount = preliminary[5]
  const metadata = preliminary[4] === 3 ? getTimingChunk(buffer) : undefined
  if (metadata ? noteCount !== 0 : noteCount < 1 || noteCount > 16) throw new AudioError('Dosyanın nota başlığı bozulmuş.')
  const base = preliminary[4] >= 2 ? 36 : BASE_HEADER
  const header = readHeaderBytes(samples, base + noteCount * 2)
  const view = new DataView(header.buffer)
  const length = view.getUint32(8, true)
  const firstBlock = view.getUint32(12, true)
  const notes = Array.from({ length: noteCount }, (_, i) => ({ midi: header[base + 2 * i], duration: header[base + 2 * i + 1] }))
  const settings: Settings = { notes, bpm: view.getUint16(6, true), startSeconds: 0 }
  if (metadata) Object.assign(settings, readTiming(metadata))
  if (preliminary[4] >= 2) {
    settings.step = view.getUint16(28, true) / 10000
    settings.harmonic = header[30]
    if (header[31] > 1) throw new AudioError('Geçersiz desen başlığı.')
    settings.pattern = header[31] === 1 ? 'fixed' : 'adaptive'
    settings.endSeconds = view.getUint32(32, true) / SAMPLE_RATE
  }
  validateSettings(settings)
  if (length < 17 || length > 4096 || firstBlock < header.length * 8 || firstBlock * BLOCK_SIZE >= samples.length || (settings.endSeconds !== undefined && settings.endSeconds * SAMPLE_RATE > samples.length)) throw new AudioError('Dosyanın mesaj başlığı geçersiz veya dosya kesilmiş.')
  const ciphertext = new Uint8Array(length)
  let i = 0, totalMargin = 0
  for (const p of positions(samples.length, settings, firstBlock)) {
    const vector = noteBasis(p.midi, settings.pattern === 'fixed' ? 0 : p.a, settings.pattern === 'fixed' ? 0 : p.b, settings.harmonic)
    const value = projection(samples, p.block, vector) / (settings.step ?? STEP)
    totalMargin += Math.max(0, .5 - Math.abs(value - Math.round(value)))
    ciphertext[i >> 3] |= readBit(samples, p.block, vector, settings.step) << (7 - (i % 8))
    if (++i === length * 8) break
  }
  if (i !== length * 8) throw new AudioError('Ses dosyası kesilmiş; mesajın tamamı okunamıyor.')
  return { samples, settings, header, ciphertext, firstBlock, meanDecisionMargin: totalMargin / i, offset, additionalData: metadata ? joinBytes(header, metadata) : header }
}

const hex = (bytes: Uint8Array) => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('')

/** Structural diagnostics only; they are explicitly untrusted until GCM verifies. */
export function inspectCarrier(buffer: ArrayBuffer, options: DecodeOptions = {}): CarrierInfo {
  const { samples, settings, header, ciphertext, firstBlock, meanDecisionMargin, offset } = readCarrier(buffer, options)
  return { version: header[4], headerBytes: header.length, ciphertextBytes: ciphertext.length,
    bpm: settings.bpm, notes: settings.notes, startSeconds: firstBlock * BLOCK_SIZE / SAMPLE_RATE,
    endSeconds: settings.endSeconds ?? samples.length / SAMPLE_RATE, step: settings.step ?? STEP,
    harmonic: settings.harmonic ?? 4, pattern: settings.pattern ?? 'adaptive', iv: hex(header.slice(16, 28)),
    headerHex: hex(header), ciphertextHex: hex(ciphertext), meanDecisionMargin, headerOffsetSamples: offset, authenticated: false }
}

export async function decryptAudio(buffer: ArrayBuffer, keyText: string, options: DecodeOptions = {}): Promise<string> {
  const cleanKey = keyText.replace(/\s/g, '')
  if (!/^[\da-fA-F]{64}$/.test(cleanKey)) throw new AudioError('Anahtar 64 onaltılık karakterden oluşmalı (0–9, a–f).')
  const { header, ciphertext, additionalData } = readCarrier(buffer, options)
  if (!globalThis.crypto?.subtle) throw new AudioError('Şifreleme için HTTPS veya localhost üzerinden açmalısın.')
  const rawKey = Uint8Array.from(cleanKey.match(/../g)!, hex => parseInt(hex, 16))
  try {
    const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt'])
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: header.slice(16, 28), additionalData, tagLength: 128 }, key, ciphertext)
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } catch {
    throw new AudioError('Mesaj doğrulanamadı. Anahtar yanlış veya ses dosyası değiştirilmiş. Metin gösterilmedi.')
  } finally { rawKey.fill(0) }
}

/** Original synthesized carrier, not a downloaded recording. */
export function makeDemo(seconds = 90, advanced = false): ArrayBuffer {
  const samples = new Float32Array(SAMPLE_RATE * seconds)
  const phrase = parseNotes(DEFAULT_NOTES)
  // Restart the phrase immediately after the reserved header so that the demo's
  // actual pitches align with the default embedding schedule.
  const headerEnd = Math.min(samples.length, ((advanced ? 36 : BASE_HEADER) + phrase.length * 2) * 8 * BLOCK_SIZE)
  for (const [from, end] of [[0, headerEnd], [headerEnd, samples.length]]) {
    let start = from
    let index = 0
    while (start < end) {
      const note = phrase[index++ % phrase.length]
      const length = Math.min(note.duration * 0.25 * SAMPLE_RATE, end - start)
      const frequency = 440 * 2 ** ((note.midi - 69) / 12)
      for (let i = 0; i < length; i++) {
        const t = i / SAMPLE_RATE
        const envelope = Math.min(1, t / 0.012) * Math.exp(-t * 5) * Math.min(1, (length - i) / 600)
        samples[start + i] = envelope * (0.28 * Math.sin(2 * Math.PI * frequency * t) + 0.09 * Math.sin(4 * Math.PI * frequency * t) + 0.04 * Math.sin(8 * Math.PI * frequency * t))
      }
      start += length
    }
  }
  return writeWav(samples)
}
