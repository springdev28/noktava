import { AudioError, SAMPLE_RATE, readWav, resample, writeWav } from './audio'

export type Selection = { start: number; end: number }
export type EditKind = 'trim' | 'cut' | 'silence' | 'reverse' | 'fade-in' | 'fade-out' | 'gain' | 'normalize' | 'paste' | 'duplicate'
export type EditCommand = Selection & { kind: EditKind; gainDb?: number; clipboard?: Float32Array }
export type AudioStats = { peak: number; rms: number; clippedSamples: number }
export type EditorAudio = { samples: Float32Array; wav: ArrayBuffer; stats: AudioStats; sourceRate: number }
export type Spectrogram = { values: Float32Array; columns: number; bins: number; maxHz: number }

export function audioStats(samples: Float32Array): AudioStats {
  let peak = 0, energy = 0, clippedSamples = 0
  for (const value of samples) {
    peak = Math.max(peak, Math.abs(value)); energy += value * value
    if (Math.abs(value) >= .9999) clippedSamples++
  }
  return { peak, rms: Math.sqrt(energy / Math.max(1, samples.length)), clippedSamples }
}

export function packAudio(samples: Float32Array, sourceRate = SAMPLE_RATE): EditorAudio {
  return { samples, wav: writeWav(samples), stats: audioStats(samples), sourceRate }
}

export function loadEditorAudio(buffer: ArrayBuffer): EditorAudio {
  const audio = readWav(buffer)
  return packAudio(resample(audio), audio.sampleRate)
}

export function editSamples(input: Float32Array, command: EditCommand): Float32Array {
  const duration = input.length / SAMPLE_RATE
  if (!Number.isFinite(command.start) || !Number.isFinite(command.end) || command.start < 0 || command.end > duration + .0001 || (command.kind === 'paste' ? command.end < command.start : command.end <= command.start)) throw new AudioError('Geçerli bir zaman aralığı seç.')
  const start = Math.round(command.start * SAMPLE_RATE), end = Math.min(input.length, Math.round(command.end * SAMPLE_RATE))
  if (command.kind === 'paste' || command.kind === 'duplicate') {
    const insert = command.kind === 'duplicate' ? input.subarray(start, end) : command.clipboard
    if (!insert?.length || insert.some(n => !Number.isFinite(n) || Math.abs(n) > 1)) throw new AudioError('Önce bir ses bölgesi kopyala.')
    const at = command.kind === 'duplicate' ? end : start
    if (input.length + insert.length > SAMPLE_RATE * 600) throw new AudioError('En fazla 10 dakikalık bir ses dosyası kullan.')
    const output = new Float32Array(input.length + insert.length)
    output.set(input.subarray(0, at)); output.set(insert, at); output.set(input.subarray(at), at + insert.length)
    return output
  }
  if (end <= start) throw new AudioError('Seçim en az bir örnek içermeli.')
  if (command.kind === 'trim') return input.slice(start, end)
  if (command.kind === 'cut') {
    if (end - start === input.length) throw new AudioError('Tüm sesi kesmek yerine daha küçük bir bölge seç.')
    const result = new Float32Array(input.length - (end - start))
    result.set(input.subarray(0, start)); result.set(input.subarray(end), start)
    return result
  }
  const output = input.slice()
  if (command.kind === 'silence') output.fill(0, start, end)
  else if (command.kind === 'reverse') output.subarray(start, end).reverse()
  else if (command.kind === 'fade-in' || command.kind === 'fade-out') {
    for (let i = start; i < end; i++) {
      const factor = (i - start) / Math.max(1, end - start - 1)
      output[i] *= command.kind === 'fade-in' ? factor : 1 - factor
    }
  } else if (command.kind === 'gain' || command.kind === 'normalize') {
    if (command.kind === 'gain' && (!Number.isFinite(command.gainDb) || Math.abs(command.gainDb!) > 24)) throw new AudioError('Kazanç −24 ile +24 dB arasında olmalı.')
    const peak = audioStats(input.subarray(start, end)).peak
    const gain = command.kind === 'normalize' ? (peak === 0 ? 1 : 10 ** (-1 / 20) / peak) : 10 ** (command.gainDb! / 20)
    if (peak * gain > 1) throw new AudioError('Bu kazanç seste kırpılmaya yol açar. Daha düşük bir dB değeri seç veya normalize et.')
    for (let i = start; i < end; i++) output[i] *= gain
  } else throw new AudioError('Bilinmeyen düzenleme işlemi.')
  return output
}

/** Radix-2 FFT with a Hann window; returns relative amplitude in dBFS. */
export function spectrum(samples: Float32Array, offset: number, size = 1024): Float32Array {
  if (size < 16 || size > 8192 || (size & (size - 1))) throw new AudioError('FFT boyutu 16–8192 arasında ikinin kuvveti olmalı.')
  const re = new Float64Array(size), im = new Float64Array(size)
  for (let i = 0; i < size; i++) re[i] = (samples[offset + i] ?? 0) * (.5 - .5 * Math.cos(2 * Math.PI * i / (size - 1)))
  for (let i = 1, j = 0; i < size; i++) {
    let bit = size >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) [re[i], re[j]] = [re[j], re[i]]
  }
  for (let length = 2; length <= size; length *= 2) {
    const angle = -2 * Math.PI / length
    for (let start = 0; start < size; start += length) {
      for (let j = 0; j < length / 2; j++) {
        const c = Math.cos(angle * j), s = Math.sin(angle * j)
        const even = start + j, odd = even + length / 2
        const tr = re[odd] * c - im[odd] * s, ti = re[odd] * s + im[odd] * c
        re[odd] = re[even] - tr; im[odd] = im[even] - ti
        re[even] += tr; im[even] += ti
      }
    }
  }
  return Float32Array.from({ length: size / 2 }, (_, i) => 20 * Math.log10(Math.max(1e-6, Math.hypot(re[i], im[i]) * 4 / size)))
}

export function spectrogram(samples: Float32Array, start: number, end: number, maxHz = 12000): Spectrogram {
  const columns = 320, bins = 128, size = 1024
  const values = new Float32Array(columns * bins)
  const first = Math.max(0, Math.floor(start * SAMPLE_RATE)), last = Math.min(samples.length, Math.ceil(end * SAMPLE_RATE))
  for (let x = 0; x < columns; x++) {
    const offset = Math.max(0, Math.min(samples.length - size, first + Math.floor((last - first) * x / columns)))
    const power = spectrum(samples, offset, size)
    for (let y = 0; y < bins; y++) {
      const frequency = (y / (bins - 1)) ** 2 * maxHz
      values[x * bins + y] = power[Math.min(power.length - 1, Math.round(frequency / SAMPLE_RATE * size))]
    }
  }
  return { values, columns, bins, maxHz }
}

export function keyToHex(input: string, format: 'hex' | 'base64') {
  const clean = input.replace(/\s/g, '')
  if (format === 'hex') {
    if (!/^[\da-f]{64}$/i.test(clean)) throw new AudioError('Hex anahtar 64 karakter olmalı (0–9, a–f).')
    return clean.toLowerCase()
  }
  try {
    const bytes = atob(clean)
    if (bytes.length !== 32) throw new Error()
    return Array.from(bytes, char => char.charCodeAt(0).toString(16).padStart(2, '0')).join('')
  } catch { throw new AudioError('Base64 anahtar tam olarak 32 bayt içermeli.') }
}
