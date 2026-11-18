import { Midi } from '@tonejs/midi'
import { AudioError, type Note } from './audio'

export type MidiTrack = { name: string; channel: number; percussion: boolean; notes: Note[] }
export type MidiScore = { name: string; bpm: number; tempoChanges: number; tracks: MidiTrack[] }

export function readMidi(buffer: ArrayBuffer, name = ''): MidiScore {
  if (buffer.byteLength > 1024 * 1024) throw new AudioError('MIDI dosyası en fazla 1 MB olabilir.')
  const view = new DataView(buffer)
  if (buffer.byteLength < 14 || view.getUint32(0) !== 0x4d546864 || view.getUint32(4) !== 6) throw new AudioError('Geçerli bir .mid MIDI dosyası seç.')
  if (view.getUint16(8) > 1 || view.getUint16(12) & 0x8000 || !view.getUint16(12)) throw new AudioError('MIDI format 0 veya 1 ve vuruş tabanlı zamanlama kullan.')
  const tracks = view.getUint16(10)
  if (!tracks || tracks > 128) throw new AudioError('MIDI dosyasında en fazla 128 kanal izi olabilir.')
  let offset = 14
  for (let i = 0; i < tracks; i++) {
    if (offset + 8 > buffer.byteLength || view.getUint32(offset) !== 0x4d54726b) throw new AudioError('MIDI dosyası eksik veya bozulmuş.')
    offset += 8 + view.getUint32(offset + 4)
    if (offset > buffer.byteLength) throw new AudioError('MIDI dosyası eksik veya bozulmuş.')
  }
  try {
    const midi = new Midi(buffer)
    const result = midi.tracks.filter(track => track.notes.length).map(track => ({
      name: track.name || track.instrument.name, channel: track.channel, percussion: track.instrument.percussion,
      notes: track.notes.map(note => ({ midi: note.midi, startSeconds: note.time, durationSeconds: note.duration, duration: note.durationTicks * 2 / midi.header.ppq }))
        .sort((a, b) => a.startSeconds - b.startSeconds || a.midi - b.midi),
    }))
    if (!result.length) throw new AudioError('MIDI dosyasında nota bulunamadı.')
    if (result.some(track => track.notes.length > 8192 || track.notes.some(n => !Number.isFinite(n.startSeconds + n.durationSeconds + n.duration) || n.durationSeconds <= 0 || n.startSeconds < 0 || n.startSeconds + n.durationSeconds > 600))) throw new AudioError('Her MIDI izi en fazla 8192 nota ve 10 dakika içerebilir.')
    const bpm = Math.round(midi.header.tempos[0]?.bpm ?? 120)
    if (bpm < 1 || bpm > 999) throw new AudioError('MIDI temposu 1–999 BPM arasında olmalı.')
    return { name: midi.name || name, bpm, tempoChanges: midi.header.tempos.length, tracks: result }
  } catch (e) {
    if (e instanceof AudioError) throw e
    throw new AudioError('MIDI dosyası eksik veya bozulmuş.')
  }
}
