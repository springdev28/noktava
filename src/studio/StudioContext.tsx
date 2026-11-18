import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_NOTES, MAX_FILE_BYTES, SAMPLE_RATE, parseNotes, type Settings, type CarrierInfo } from '../lib/audio'
import { audioTask } from '../lib/worker-client'
import type { AudioStats, EditCommand, EditorAudio, Selection } from '../lib/editor'
import { importMp3 } from '../lib/import-audio'
import type { MidiScore } from '../lib/midi'

export type Asset = { id: number; name: string; samples: Float32Array; blob: Blob; stats: AudioStats; sourceRate: number }
export type EncodedResult = { blob: Blob; key: string; name: string; bytes: number; sourceId: number; settingsSignature: string; preview: Asset }
const defaults: Settings = { notes: parseNotes(DEFAULT_NOTES), bpm: 120, startSeconds: 0, step: .1, harmonic: 4, pattern: 'adaptive' }
const editNames = { draw: 'Ses örnekleri çizildi', paste: 'Ses yapıştırıldı', duplicate: 'Seçim çoğaltıldı', trim: 'Seçime kırpıldı', cut: 'Seçim kesildi', silence: 'Seçim susturuldu', reverse: 'Seçim ters çevrildi', 'fade-in': 'Yavaş giriş uygulandı', 'fade-out': 'Yavaş çıkış uygulandı', gain: 'Kazanç değiştirildi', normalize: '−1 dB tepeye normalize edildi' }
let assetId = 0
const makeAsset = (data: EditorAudio, name: string): Asset => ({ id: ++assetId, name, samples: data.samples, blob: new Blob([data.wav], { type: 'audio/wav' }), stats: data.stats, sourceRate: data.sourceRate })

function useStudioState() {
  const [asset, setAsset] = useState<Asset | null>(null)
  const [original, setOriginal] = useState<Asset | null>(null)
  const [past, setPast] = useState<Asset[]>([]), [future, setFuture] = useState<Asset[]>([])
  const [clipboard, setClipboard] = useState<Float32Array | null>(null)
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 })
  const [settings, setSettings] = useState<Settings>(defaults)
  const [midiScore, setMidiScore] = useState<MidiScore | null>(null)
  const [midiTrack, setMidiTrack] = useState(0)
  const [midiHelpSeen, setMidiHelpSeen] = useState(false)
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  const [log, setLog] = useState<string[]>([])
  const [message, setMessage] = useState('')
  const [encoded, setEncoded] = useState<EncodedResult | null>(null)
  const [decoder, setDecoder] = useState<{ file: File | null; key: string; keyFormat: 'hex' | 'base64'; offset: number; manual: boolean; info: CarrierInfo | null; plaintext: string | null }>({ file: null, key: '', keyFormat: 'hex', offset: 0, manual: false, info: null, plaintext: null })
  const busyRef = useRef(false)
  const addLog = (entry: string) => setLog(list => [entry, ...list].slice(0, 12))
  const replace = useCallback((next: Asset) => {
    setAsset(next); setOriginal(next); setPast([]); setFuture([])
    setSelection({ start: 0, end: 0 })
    setSettings(s => ({ ...s, startSeconds: 0, endSeconds: undefined })); setEncoded(null)
  }, [])
  const load = useCallback(async (file?: File) => {
    if (busyRef.current) return
    busyRef.current = true; setBusy(file ? 'Ses dosyası hazırlanıyor…' : 'Örnek melodi hazırlanıyor…'); setError('')
    try {
      if (file && file.size > MAX_FILE_BYTES) throw new Error('Dosya en fazla 50 MB olabilir.')
      if (file && !/\.(mp3|wav)$/i.test(file.name)) throw new Error('MP3 veya WAV dosyası seç.')
      const result = file && /\.mp3$/i.test(file.name) ? await importMp3(file) : await audioTask<EditorAudio>(file ? 'load' : 'editor-demo', file ? { buffer: await file.arrayBuffer() } : {})
      const next = makeAsset(result, file?.name ?? 'noktava-melodi.wav')
      replace(next); setLog([file ? `${file.name} içe aktarıldı` : '90 saniyelik örnek melodi açıldı'])
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(''); busyRef.current = false }
  }, [replace])
  async function edit(command: EditCommand) {
    if (!asset || busyRef.current) return
    busyRef.current = true; setBusy('Ses düzenleniyor…'); setError('')
    try {
      const result = await audioTask<EditorAudio>('edit', { samples: asset.samples, command })
      // Keep bounded full-buffer history, rather than growing memory indefinitely.
      const limit = Math.max(1, Math.min(8, Math.floor(64 * 1024 * 1024 / Math.max(1, asset.samples.byteLength))))
      setPast(list => [...list, asset].slice(-limit)); setFuture([])
      const next = makeAsset({ ...result, sourceRate: asset.sourceRate }, asset.name); setAsset(next); setEncoded(null)
      if (['cut', 'trim', 'paste', 'duplicate'].includes(command.kind)) {
        const inserted = (next.samples.length - asset.samples.length) / SAMPLE_RATE
        if (command.kind === 'cut') setSelection({ start: Math.min(command.start, next.samples.length / SAMPLE_RATE), end: Math.min(command.start, next.samples.length / SAMPLE_RATE) })
        else if (command.kind === 'paste') setSelection({ start: command.start, end: command.start + inserted })
        else if (command.kind === 'duplicate') setSelection({ start: command.end, end: command.end + inserted })
        else setSelection({ start: 0, end: next.samples.length / SAMPLE_RATE })
        setSettings(s => ({ ...s, startSeconds: 0, endSeconds: undefined }))
      }
      addLog(editNames[command.kind])
    } catch (e) { setError((e as Error).message) }
    finally { setBusy(''); busyRef.current = false }
  }
  function restore(next: Asset) {
    setAsset(next); setEncoded(null); setError(''); setSelection(s => ({ start: Math.min(s.start, next.samples.length / SAMPLE_RATE), end: Math.min(s.end, next.samples.length / SAMPLE_RATE) }))
    setSettings(s => ({ ...s, startSeconds: 0, endSeconds: undefined }))
  }
  function undo() {
    if (!asset || !past.length || busyRef.current) return
    setFuture(list => [...list, asset]); restore(past[past.length - 1]); setPast(list => list.slice(0, -1)); addLog('Son düzenleme geri alındı')
  }
  function redo() {
    if (!asset || !future.length || busyRef.current) return
    setPast(list => [...list, asset]); restore(future[future.length - 1]); setFuture(list => list.slice(0, -1)); addLog('Düzenleme yeniden uygulandı')
  }
  function reset() {
    if (!asset || !original || busyRef.current || original === asset) return
    setPast(list => [...list.slice(-2), asset]); setFuture([]); restore(original); addLog('Özgün sese dönüldü')
  }
  function copy() {
    if (!asset || busyRef.current || selection.end <= selection.start) return
    setClipboard(asset.samples.slice(Math.round(selection.start * SAMPLE_RATE), Math.round(selection.end * SAMPLE_RATE)))
    addLog('Seçim kopyalandı')
  }
  return { clipboard, copy, asset, original, selection, setSelection, settings, setSettings, busy, error, setError, load, edit, undo, redo, reset,
    canUndo: past.length > 0, canRedo: future.length > 0, log, addLog, message, setMessage, encoded, setEncoded, decoder, setDecoder, midiScore, setMidiScore, midiTrack, setMidiTrack, midiHelpSeen, setMidiHelpSeen }
}
const StudioContext = createContext<ReturnType<typeof useStudioState> | null>(null)
export function StudioProvider({ children }: { children: ReactNode }) {
  const value = useStudioState()
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>
}
export function useStudio() {
  const value = useContext(StudioContext)
  if (!value) throw new Error('StudioProvider is required')
  return value
}
