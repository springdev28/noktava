import { useI18n } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Download, FileAudio, LoaderCircle, Upload } from 'lucide-react'
import { useStudio } from './StudioContext'
export function time(seconds: number, precise = false) {
  const scale = precise ? 100 : 1
  const units = Math.max(0, precise ? Math.round(seconds * scale) : Math.floor(seconds))
  const minutes = Math.floor(units / (60 * scale)).toString().padStart(2, '0')
  const remainder = ((units % (60 * scale)) / scale).toFixed(precise ? 2 : 0).padStart(precise ? 5 : 2, '0')
  return `${minutes}:${remainder}`
}
export const decibels = (amplitude: number) => amplitude > 0 ? `${(20 * Math.log10(amplitude)).toFixed(1)} dB` : '−∞ dB'
export function useBlobUrl(blob: Blob | null) {
  const [url, setUrl] = useState('')
  useEffect(() => { if (!blob) { setUrl(''); return }; const next = URL.createObjectURL(blob); setUrl(next); return () => URL.revokeObjectURL(next) }, [blob])
  return url
}
export function DownloadButton({ blob, name, children }: { blob: Blob; name: string; children: React.ReactNode }) {
  const url = useBlobUrl(blob)
  return <a href={url || undefined} download={name} className="studio-button primary"><Download size={15} />{children}</a>
}
export function CopyButton({ text, label = 'Kopyala' }: { text: string; label?: string }) {
  const { t } = useI18n()

  const [status, setStatus] = useState('')
  useEffect(() => { if (status) { const timer = setTimeout(() => setStatus(''), 2500); return () => clearTimeout(timer) } }, [status])
  return <button type="button" className="studio-button subtle compact" onClick={async () => { try { await navigator.clipboard.writeText(text); setStatus('Kopyalandı') } catch { setStatus('Elle kopyalayabilirsin') } }}>{status === 'Kopyalandı' ? <Check size={14} /> : <Copy size={14} />}<span aria-live="polite">{t(status || label)}</span></button>
}
export function ImportButtons() {
  const { t } = useI18n()

  const { load, busy } = useStudio()
  const ref = useRef<HTMLInputElement>(null)
  return <div className="page-actions"><input ref={ref} aria-label={t("Stüdyoya ses dosyası yükle")} type="file" accept=".wav,.mp3,audio/wav,audio/mpeg" className="visually-hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void load(file); e.target.value = '' }} />
    <button className="studio-button subtle" disabled={!!busy} onClick={() => void load()}><FileAudio size={15} />{t("Örnek melodi")}</button>
    <button className="studio-button primary" disabled={!!busy} onClick={() => ref.current?.click()}><Upload size={15} />{t("Ses dosyası aç")}</button></div>
}
export function StatusBanner() {
  const { t } = useI18n()

  const { busy, error } = useStudio()
  return <>{busy && <div className="studio-notice" role="status"><LoaderCircle size={16} className="spin" />{t(busy)}</div>}{error && <div className="studio-error" role="alert">{t(error)}</div>}</>
}
