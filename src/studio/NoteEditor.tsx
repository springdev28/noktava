import { useRef, useState } from 'react'
import { HelpCircle, Music2, Plus, Trash2, Upload, X } from 'lucide-react'
import { useI18n } from '../lib/i18n'
import { type Note } from '../lib/audio'
import { readMidi, type MidiScore } from '../lib/midi'
import { useStudio } from './StudioContext'
const names = { tr: ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'], en: ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] }
export const noteName = (midi: number, language: 'tr' | 'en' = 'tr') => `${names[language][midi % 12]}${Math.floor(midi / 12) - 1}`
export function NoteEditor({ disabled = false }: { disabled?: boolean }) {
  const { t, language } = useI18n()
  const { settings, setSettings, busy, midiScore, setMidiScore, midiTrack, setMidiTrack, midiHelpSeen, setMidiHelpSeen } = useStudio()
  const [mode, setMode] = useState<'manual' | 'midi'>(midiScore ? 'midi' : 'manual')
  const [error, setError] = useState(''), [loading, setLoading] = useState(false), [page, setPage] = useState(0)
  const [help, setHelp] = useState(!midiHelpSeen)
  const input = useRef<HTMLInputElement>(null)
  const locked = disabled || !!busy || loading
  let cursor = 0
  const notes = settings.notes.map(note => { const startSeconds = note.startSeconds ?? cursor; const durationSeconds = note.durationSeconds ?? note.duration * 30 / settings.bpm; cursor = startSeconds + durationSeconds; return { ...note, startSeconds, durationSeconds } })
  const end = Math.max(...notes.map(n => n.startSeconds + n.durationSeconds), 1)
  const low = Math.max(0, Math.min(...notes.map(n => n.midi)) - 3), high = Math.min(127, Math.max(...notes.map(n => n.midi)) + 3)
  const visible = notes.slice(page * 32, (page + 1) * 32)
  const putNotes = (next: Note[]) => setSettings(s => ({ ...s, timing: s.timing ?? 'loop', notes: next }))
  const update = (index: number, patch: Partial<Note>) => putNotes(notes.map((note, i) => i === index ? { ...note, ...patch } : note))
  function useTrack(score: MidiScore, index: number) {
    setMidiTrack(index); setPage(0)
    setSettings(s => ({ ...s, notes: score.tracks[index].notes, bpm: score.bpm, timing: 'timeline' }))
  }
  async function loadMidi(file: File) {
    setLoading(true); setError('')
    try { const score = readMidi(await file.arrayBuffer(), file.name); setMidiScore(score); useTrack(score, Math.max(0, score.tracks.findIndex(track => !track.percussion))); setMode('midi') }
    catch (e) { setError((e as Error).message) }
    finally { setLoading(false) }
  }
  function closeHelp() { setHelp(false); setMidiHelpSeen(true) }
  return <section className="studio-card note-editor">
    <div className="card-heading"><h2><Music2 size={16} />{t('Notalar', 'Notes')}</h2><button type="button" className="text-button" aria-expanded={help} aria-controls="midi-help" onClick={() => help ? closeHelp() : setHelp(true)}><HelpCircle size={14} />{t('MIDI nedir?', 'What is MIDI?')}</button></div>
    {help && <div className="midi-help" id="midi-help"><button type="button" className="studio-icon-button" aria-label={t('Yardımı kapat', 'Close help')} onClick={closeHelp}><X size={16} /></button><ol>
      <li><strong>{t('MIDI bir ses kaydı değildir.', 'MIDI is not an audio recording.')}</strong><span>{t('Nota, oktav, başlangıç ve süre bilgilerini içerir. MP3 veya WAV dosyan şarkının kendisidir.', 'It contains notes, octaves, start times and durations. Your MP3 or WAV contains the song itself.')}</span></li>
      <li><strong>{t('MIDI yükle veya elle gir.', 'Import MIDI or enter notes.')}</strong><span>{t('Şarkının ilgili bölümüne ait .mid dosyasını kullan. MIDI yoksa notaları aşağıda düzenle.', 'Use a .mid file for the relevant part of your song, or enter the notes below.')}</span></li>
      <li><strong>{t('Önizlemeyi kontrol et.', 'Check the preview.')}</strong><span>{t('Notaları kontrol edip şifrele. Alıcının MIDI dosyasına ihtiyacı yok.', 'Check the notes, then encrypt. The recipient does not need the MIDI file.')}</span></li>
    </ol></div>}
    <div className="note-mode" role="group" aria-label={t('Nota kaynağı', 'Note source')}><button type="button" disabled={locked} className={mode === 'manual' ? 'active' : ''} onClick={() => setMode('manual')}>{t('Notaları elle gir', 'Enter notes')}</button><button type="button" disabled={locked} className={mode === 'midi' ? 'active' : ''} onClick={() => setMode('midi')}>{t('MIDI yükle', 'Import MIDI')}</button></div>
    <input ref={input} className="visually-hidden" type="file" accept=".mid,.midi,audio/midi" aria-label={t('MIDI dosyası', 'MIDI file')} disabled={locked} onChange={e => { if (e.target.files?.[0]) void loadMidi(e.target.files[0]); e.target.value = '' }} />
    {mode === 'midi' && <div className="midi-import"><button type="button" className="studio-button subtle" disabled={locked} onClick={() => input.current?.click()}><Upload size={15} />{loading ? t('Okunuyor…', 'Reading…') : t('.mid dosyası seç', 'Choose .mid file')}</button>{midiScore ? <><span>{midiScore.name}</span><label>{t('MIDI izi', 'MIDI track')}<select disabled={locked} value={midiTrack} onChange={e => useTrack(midiScore, Number(e.target.value))}>{midiScore.tracks.map((track, i) => <option key={i} value={i}>{i + 1}: {track.name} ({track.notes.length} {t('nota', 'notes')}){track.percussion ? ' / ' + t('vurmalı', 'percussion') : ''}</option>)}</select></label><small>{midiScore.tempoChanges > 1 ? t('Tempo değişimleri zamanlara işlendi.', 'Tempo changes are preserved in note timing.') : `${settings.bpm} BPM`}</small></> : <p className="studio-help">{t('Dosya seçilene kadar mevcut nota dizisi kullanılır.', 'The current notes remain in use until you choose a file.')}</p>}</div>}
    {error && <div className="studio-error" role="alert">{t(error)}</div>}
    <div className="timed-piano" aria-label={t('Nota önizlemesi', 'Note preview')}><span className="piano-time">0:00</span><span className="piano-end">{end.toFixed(2)} s</span>{notes.slice(0, 8192).map((note, i) => <i key={i} title={`${noteName(note.midi, language)} / ${note.startSeconds.toFixed(3)} s / ${note.durationSeconds.toFixed(3)} s`} style={{ left: `${note.startSeconds / end * 100}%`, width: `${Math.max(.15, note.durationSeconds / end * 100)}%`, bottom: `${12 + (note.midi - low) / Math.max(1, high - low) * 65}%` }} />)}</div>
    <div className="note-table-heading"><span>{notes.length} {t('nota', 'notes')}</span><span>{t('Adı / oktav', 'Pitch / octave')}</span><span>{t('Başlangıç (sn)', 'Start (s)')}</span><span>{t('Süre (sn)', 'Duration (s)')}</span><span /></div>
    <div className="note-rows timed-note-rows">{visible.map((note, j) => { const i = page * 32 + j; return <div className="timed-note-row" key={i}><span>{i + 1}</span><select aria-label={t(`${i + 1}. nota perdesi`)} value={note.midi} disabled={locked} onChange={e => update(i, { midi: Number(e.target.value) })}>{Array.from({ length: 128 }, (_, midi) => <option key={midi} value={midi}>{noteName(midi, language)}</option>)}</select><input type="number" min="0" max="600" step="any" aria-label={t(`${i + 1}. nota başlangıcı`, `Note ${i + 1} start`)} value={Number(note.startSeconds.toFixed(4))} disabled={locked} onChange={e => update(i, { startSeconds: Number(e.target.value) })} /><input type="number" min="0.001" max="600" step="any" aria-label={t(`${i + 1}. nota süresi`)} value={Number(note.durationSeconds.toFixed(4))} disabled={locked} onChange={e => update(i, { durationSeconds: Number(e.target.value), duration: Number(e.target.value) * settings.bpm / 30 })} /><button type="button" className="studio-icon-button" aria-label={t(`${i + 1}. notayı sil`)} disabled={notes.length === 1 || locked} onClick={() => { putNotes(notes.filter((_, j) => j !== i)); setPage(0) }}><Trash2 size={14} /></button></div> })}</div>
    {notes.length > 32 && <div className="note-pages"><button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('Önceki', 'Previous')}</button><span>{page + 1} / {Math.ceil(notes.length / 32)}</span><button type="button" disabled={(page + 1) * 32 >= notes.length} onClick={() => setPage(page + 1)}>{t('Sonraki', 'Next')}</button></div>}
    <div className="note-footer"><button type="button" className="studio-button subtle compact" disabled={notes.length >= 8192 || locked} onClick={() => { putNotes([...notes, { midi: 60, duration: 2, startSeconds: end, durationSeconds: 60 / settings.bpm }]); setPage(Math.floor(notes.length / 32)) }}><Plus size={14} />{t('Nota ekle')}</button><label>{t('Tempo ')}<input aria-label={t('Tempo (BPM)')} type="number" min="40" max="240" value={settings.bpm} disabled={locked || settings.timing === 'timeline'} onChange={e => { const bpm = Number(e.target.value); if (bpm >= 40 && bpm <= 240) setSettings(s => ({ ...s, bpm, notes: s.timing ? notes.map(n => ({ ...n, startSeconds: n.startSeconds * s.bpm / bpm, durationSeconds: n.durationSeconds * s.bpm / bpm })) : s.notes })) }} />BPM</label></div>
    <label className="repeat-notes"><input type="checkbox" checked={!settings.timing || settings.timing === 'loop'} disabled={locked} onChange={e => setSettings(s => ({ ...s, notes, timing: e.target.checked ? 'loop' : 'timeline' }))} />{t('Nota dizisini tekrarla', 'Repeat the note sequence')}</label>
    <p className="studio-help">{settings.timing === 'timeline' ? t('Başlangıçlar şarkının başından ölçülür. Notalar otomatik tekrarlanmaz.', 'Start times are measured from the beginning of the song. Notes do not repeat automatically.') : t('Dizi seçili aralıkta tekrarlanır.', 'The sequence repeats in the selected range.')}</p>
  </section>
}
