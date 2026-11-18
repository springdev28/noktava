import { describe, expect, it } from 'vitest'
import { Midi } from '@tonejs/midi'
import { readMidi } from '../src/lib/midi'
import { capacity, decodeCarrier, decryptAudio, encryptAudio, inspectCarrier, SAMPLE_RATE, writeWav, type Settings } from '../src/lib/audio'
import { editSamples } from '../src/lib/editor'

function score() {
  const midi = new Midi()
  midi.header.fromJSON({ name: 'Tempo test', ppq: 480, tempos: [{ ticks: 0, bpm: 120 }, { ticks: 1920, bpm: 90 }], timeSignatures: [], keySignatures: [], meta: [] })
  const track = midi.addTrack(); track.name = 'Piano'
  for (let i = 0; i < 320; i++) track.addNote({ midi: [60, 62, 65, 64][i % 4], ticks: i * 240, durationTicks: 180, velocity: .7 })
  midi.addTrack().addNote({ midi: 36, ticks: 0, durationTicks: 240, velocity: 1 })
  return midi
}
const bytes = (midi: Midi) => Uint8Array.from(midi.toArray()).buffer
const wav = () => writeWav(new Float32Array(120 * SAMPLE_RATE))
const getSettings = (): Settings => {
  const midi = readMidi(bytes(score()))
  return { notes: midi.tracks[0].notes, bpm: midi.bpm, startSeconds: 0, timing: 'timeline', step: .1, harmonic: 4, pattern: 'adaptive' }
}
describe('MIDI import and authenticated note timing', () => {
  it('preserves tracks, pitch, starts, durations and tempo changes', () => {
    const midi = score(), parsed = readMidi(bytes(midi))
    expect(parsed.tracks).toHaveLength(2)
    expect(parsed.tracks[0].notes).toHaveLength(320)
    expect(parsed.tempoChanges).toBe(2)
    for (const i of [0, 7, 8, 319]) {
      const note = parsed.tracks[0].notes[i], original = midi.tracks[0].notes[i]
      expect(note.startSeconds).toBeCloseTo(Math.min(original.ticks, 1920) / 480 * .5 + Math.max(0, original.ticks - 1920) / 480 * .666666, 6)
      expect(note.durationSeconds).toBeCloseTo(original.durationTicks / 480 * (original.ticks < 1920 ? .5 : .666666), 6)
      expect(note.midi).toBe(original.midi)
      expect(note.duration).toBe(.75)
    }
  })
  it('rejects renamed audio, truncated tracks and SMPTE timing', () => {
    expect(() => readMidi(wav())).toThrow('MIDI')
    const source = bytes(score())
    expect(() => readMidi(source.slice(0, -1))).toThrow('eksik')
    const invalid = source.slice(0); new DataView(invalid).setUint16(12, 0x8000)
    expect(() => readMidi(invalid)).toThrow('zamanlama')
  })
  it('recovers a message with 320 timed notes using only WAV and key', async () => {
    const settings = getSettings(), message = 'Merhaba, şifreli mesaj!'
    expect(capacity(120 * SAMPLE_RATE, settings)).toBeGreaterThan(new TextEncoder().encode(message).length)
    const result = await encryptAudio(wav(), message, settings)
    expect(await decryptAudio(result.wav, result.key)).toBe(message)
    const info = (await decodeCarrier(result.wav, result.key)).info
    expect(info.version).toBe(4); expect(info.notes).toHaveLength(320)
    expect(info.notes[40].startSeconds).toBeCloseTo(settings.notes[40].startSeconds!, 4)
    expect(info.notes[40].durationSeconds).toBeCloseTo(settings.notes[40].durationSeconds!, 4)
    await expect(decryptAudio(result.wav, '00'.repeat(32))).rejects.toThrow('doğrulanamadı')
  })
  it('keeps note details locked and does not append a readable timing chunk', async () => {
    const result = await encryptAudio(wav(), 'M', getSettings())
    const info = inspectCarrier(result.wav)
    expect(info).toMatchObject({ version: 4, locked: true, controlEncrypted: true, authenticated: false })
    expect(info).not.toHaveProperty('notes')
    expect(info).not.toHaveProperty('ciphertextBytes')
    expect(result.wav.byteLength).toBe(44 + 120 * SAMPLE_RATE * 2)
  })
  it('handles overlapping notes without overwriting the same audio blocks', async () => {
    const settings = getSettings()
    settings.notes = settings.notes.slice(0, 12)
    settings.timing = 'loop'
    settings.notes = settings.notes.flatMap(n => [n, { ...n, midi: n.midi + 7 }])
    const max = capacity(120 * SAMPLE_RATE, settings)
    expect(max).toBeGreaterThan(0)
    expect(max).toBeLessThanOrEqual(capacity(120 * SAMPLE_RATE, { ...settings, notes: settings.notes.filter((_, i) => i % 2 === 0) }))
    const result = await encryptAudio(wav(), 'x'.repeat(max), settings)
    expect(await decryptAudio(result.wav, result.key)).toBe('x'.repeat(max))
  })
  it('retains manual gaps and repeating note times', async () => {
    const settings: Settings = { notes: [{ midi: 60, duration: 1, startSeconds: .1, durationSeconds: .25 }, { midi: 65, duration: 1, startSeconds: .5, durationSeconds: .25 }], bpm: 120, startSeconds: 10, timing: 'loop' }
    const result = await encryptAudio(wav(), 'A gap', settings)
    expect(await decryptAudio(result.wav, result.key)).toBe('A gap')
  })
  it('does not fabricate capacity for notes before the header or too short', () => {
    const settings = getSettings(); settings.notes = settings.notes.slice(0, 4)
    expect(capacity(120 * SAMPLE_RATE, settings)).toBe(0)
    settings.notes = [{ midi: 60, startSeconds: 10, durationSeconds: .001, duration: .01 }]
    expect(capacity(120 * SAMPLE_RATE, settings)).toBe(0)
  })
})
describe('clipboard editing', () => {
  it('inserts at the cursor and duplicates the selection without changing its source', () => {
    const source = Float32Array.of(.1, .2, .3, .4)
    const paste = editSamples(source, { kind: 'paste', start: 2 / SAMPLE_RATE, end: 2 / SAMPLE_RATE, clipboard: Float32Array.of(.8, .9) })
    expect(Array.from(paste)).toEqual(Array.from(Float32Array.of(.1, .2, .8, .9, .3, .4)))
    expect(editSamples(source, { kind: 'duplicate', start: 1 / SAMPLE_RATE, end: 3 / SAMPLE_RATE })).toEqual(Float32Array.of(.1, .2, .3, .2, .3, .4))
    expect(source).toEqual(Float32Array.of(.1, .2, .3, .4))
  })
  it('rejects invalid clipboard samples and duration overflow', () => {
    expect(() => editSamples(Float32Array.of(0), { kind: 'paste', start: 0, end: 0, clipboard: Float32Array.of(NaN) })).toThrow()
    expect(() => editSamples(new Float32Array(SAMPLE_RATE * 600), { kind: 'paste', start: 0, end: 0, clipboard: Float32Array.of(0) })).toThrow('10 dakika')
  })
})
