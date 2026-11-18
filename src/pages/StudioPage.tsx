import { useI18n } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, ClipboardPaste, CopyPlus, Crop, History, MousePointer2, MoveDownRight, MoveUpRight, Redo2, RotateCcw, Scissors, Undo2, VolumeX, Waves } from 'lucide-react'
import { Link } from '../lib/router'
import { SAMPLE_RATE } from '../lib/audio'
import type { EditKind } from '../lib/editor'
import { useStudio } from '../studio/StudioContext'
import { Timeline } from '../studio/Timeline'
import { NoteEditor } from '../studio/NoteEditor'
import { ImportButtons, DownloadButton, StatusBanner, decibels, time } from '../studio/shared'

export function StudioPage() {
  const { t, language } = useI18n()

  const studio = useStudio()
  const { asset, original, busy, selection, setSelection, settings, setSettings } = studio
  const [gain, setGain] = useState(0), [compare, setCompare] = useState(false)
  const [playhead, setPlayhead] = useState(0)
  const initialized = useRef(false)
  useEffect(() => { if (!initialized.current) { initialized.current = true; if (!asset) void studio.load() } }, [])
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName)) return
      const key = event.key.toLowerCase()
      if (key === 'z') { event.preventDefault(); if (event.shiftKey) studio.redo(); else studio.undo() }
      if (key === 'a' && asset) { event.preventDefault(); setSelection({ start: 0, end: asset.samples.length / SAMPLE_RATE }) }
      if (key === 'c') { event.preventDefault(); studio.copy() }
      if (key === 'x') { event.preventDefault(); studio.copy(); void studio.edit({ kind: 'cut', ...selection }) }
      if (key === 'v' && studio.clipboard) { event.preventDefault(); void studio.edit({ kind: 'paste', start: playhead, end: playhead, clipboard: studio.clipboard }) }
    }
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler)
  }, [studio, playhead])
  const duration = asset ? asset.samples.length / SAMPLE_RATE : 0
  const operations: { kind: EditKind; label: string; icon: typeof Crop }[] = [
    { kind: 'trim', label: 'Seçime kırp', icon: Crop }, { kind: 'cut', label: 'Seçimi kes', icon: Scissors },
    { kind: 'silence', label: 'Sustur', icon: VolumeX }, { kind: 'reverse', label: 'Ters çevir', icon: RotateCcw },
    { kind: 'duplicate', label: 'Çoğalt', icon: CopyPlus },
    { kind: 'fade-in', label: 'Yavaş giriş', icon: MoveUpRight }, { kind: 'fade-out', label: 'Yavaş çıkış', icon: MoveDownRight },
  ]
  return <>
    <div className="studio-page-heading"><div><h1>{t("Ses stüdyosu")}</h1><p>{t("Dalga formunu ve spektrogramı görüntüle. Ses dosyasını düzenle.")}</p></div><ImportButtons /></div>
    <StatusBanner />
    {!asset ? <div className="studio-empty"><Waves size={45} /><h2>{t("Ses dosyası seçilmedi")}</h2><p>{t("Bir MP3 veya WAV dosyası aç veya örnek melodiyle başla.", "Open an MP3 or WAV, or start with the sample melody.")}</p></div> : <>
      <div className="project-toolbar"><div><span className="project-dot" /><strong>{asset.name}</strong><span>{asset === original ? t('ÖZGÜN') : t('DÜZENLENDİ')}</span></div><div className="history-buttons"><button className="studio-icon-button" aria-label={t("Geri al")} title={t("Geri al / Ctrl/Cmd Z")} disabled={!studio.canUndo || !!busy} onClick={studio.undo}><Undo2 size={17} /></button><button className="studio-icon-button" aria-label={t("Yinele")} title={t("Yinele / Ctrl/Cmd Shift Z")} disabled={!studio.canRedo || !!busy} onClick={studio.redo}><Redo2 size={17} /></button><button className="studio-button subtle compact" disabled={!original || original === asset || !!busy} onClick={studio.reset}>{t("Özgüne dön")}</button></div></div>
      <div className="studio-work-grid"><div className="studio-work-main"><Timeline asset={asset} selection={selection} onSelection={setSelection} disabled={!!busy} onCursor={setPlayhead} compare={compare && original?.samples.length === asset.samples.length ? original.samples : undefined} />
        <div className="wave-hint"><span><MousePointer2 size={12} />{t("Sürükle: bölge seç / Tıkla: konumlandır / Boşluk: oynat")}</span><label><input type="checkbox" checked={compare} disabled={!original || original.samples.length !== asset.samples.length} onChange={e => setCompare(e.target.checked)} />{t("Özgün dalgayı göster")}</label></div>
        <section className="studio-card edit-tools"><div className="card-heading"><h2>{t("Manuel düzenleme")}</h2><span>{t("SEÇİLİ BÖLGEYE UYGULANIR")}</span></div><div className="clipboard-tools"><button className="studio-button subtle compact" disabled={!!busy || selection.end <= selection.start} onClick={studio.copy}><Copy size={14} />{t('Kopyala')}</button><button className="studio-button subtle compact" disabled={!!busy || !studio.clipboard} onClick={() => void studio.edit({ kind: 'paste', start: playhead, end: playhead, clipboard: studio.clipboard! })}><ClipboardPaste size={14} />{t('İmlece yapıştır', 'Paste at cursor')}</button><span>{t('İmleç', 'Cursor')}: {time(playhead, true)}</span></div><div className="edit-tool-grid">{operations.map(({ kind, label, icon: Icon }) => <button key={kind} disabled={!!busy || selection.end <= selection.start} onClick={() => { if (kind === 'cut') studio.copy(); void studio.edit({ kind, ...selection }) }}><Icon size={18} /><span>{t(label)}</span></button>)}</div><div className="gain-editor"><label>{t("Kazanç ")}<strong>{gain > 0 ? '+' : ''}{gain.toFixed(1)}{t(" dB")}</strong><input type="range" min="-24" max="24" step="0.5" value={gain} onChange={e => setGain(Number(e.target.value))} aria-label={t("Seçim kazancı")} /></label><button className="studio-button subtle" disabled={!!busy || selection.end <= selection.start} onClick={() => void studio.edit({ kind: 'gain', gainDb: gain, ...selection })}>{t("Kazancı uygula")}</button><button className="studio-button subtle" disabled={!!busy || selection.end <= selection.start} onClick={() => void studio.edit({ kind: 'normalize', ...selection })}>{t("Normalize et / −1 dB")}</button></div></section>
      </div><aside className="studio-inspector"><section className="studio-card"><div className="card-heading"><h2>{t("Seçim")}</h2><MousePointer2 size={14} /></div><div className="selection-time"><span>{time(selection.end - selection.start, true)}</span><small>{t("SEÇİLİ SÜRE")}</small></div><div className="setting-field"><label htmlFor="selection-start">{t("Başlangıç (saniye)")}</label><input id="selection-start" type="number" min="0" max={selection.end} step="0.01" value={Number(selection.start.toFixed(3))} onChange={e => { const n = Number(e.target.value); setSelection({ ...selection, start: Math.max(0, Math.min(n, selection.end)) }) }} /></div><div className="setting-field"><label htmlFor="selection-end">{t("Bitiş (saniye)")}</label><input id="selection-end" type="number" min={selection.start} max={duration} step="0.01" value={Number(selection.end.toFixed(3))} onChange={e => { const n = Number(e.target.value); setSelection({ ...selection, end: Math.max(selection.start, Math.min(n, duration)) }) }} /></div><button className="studio-button subtle full" onClick={() => setSelection({ start: 0, end: duration })}>{t("Tümünü seç")}</button><Link href="/encode" className="studio-button primary full" onClick={() => setSettings({ ...settings, startSeconds: selection.start, endSeconds: selection.end })}>{t("Seçimi şifrele ")}<ArrowRight size={14} /></Link></section>
        <section className="studio-card"><div className="card-heading"><h2>{t("Ses bilgisi")}</h2><Waves size={15} /></div><dl className="audio-facts"><div><dt>{t("Toplam süre")}</dt><dd>{time(duration, true)}</dd></div><div><dt>{t("Tepe genliği")}</dt><dd>{decibels(asset.stats.peak)}</dd></div><div><dt>{t("RMS seviyesi")}</dt><dd>{decibels(asset.stats.rms)}</dd></div><div><dt>{t("Örnek sayısı")}</dt><dd>{asset.samples.length.toLocaleString(language === 'tr' ? 'tr-TR' : 'en-US')}</dd></div><div><dt>{t("Çalışma biçimi")}</dt><dd>{t("48 kHz / Mono")}</dd></div><div><dt>{t("Kaynak hızı")}</dt><dd>{asset.sourceRate / 1000}{t(" kHz")}</dd></div></dl><DownloadButton blob={asset.blob} name={asset.name.replace(/\.(wav|mp3)$/i, '') + '-duzenlenmis.wav'}>{t("WAV dışa aktar")}</DownloadButton></section>
      </aside></div>
      <div className="studio-bottom-grid"><NoteEditor /><section className="studio-card history-card"><div className="card-heading"><h2><History size={16} />{t("İşlem geçmişi")}</h2><span>{t("BU OTURUM")}</span></div><ol>{studio.log.map((entry, i) => <li key={`${i}-${entry}`}><span>{i === 0 ? <Check size={12} /> : <i />}</span><div>{t(entry)}<small>{i === 0 ? t('Son işlem') : t(`${i} işlem önce`)}</small></div></li>)}</ol><p className="studio-help">{t("Geçmiş bellekte tutulur. Sayfayı yenilemeden önce WAV dosyanı dışa aktar. Şifrelenmiş sesi düzenlemek içindeki mesajı bozabilir.")}</p></section></div>
    </>}
  </>
}
