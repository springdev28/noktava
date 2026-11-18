import { useI18n } from '../lib/i18n'
import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { AudioLines, Focus, Maximize2, Pause, Play, Repeat2, SkipBack, Square, Volume2, Waves, ZoomIn, ZoomOut } from 'lucide-react'
import { SAMPLE_RATE } from '../lib/audio'
import type { Selection, Spectrogram } from '../lib/editor'
import { audioTask } from '../lib/worker-client'
import type { Asset } from './StudioContext'
import { time, useBlobUrl } from './shared'

export function Timeline({ asset, selection, onSelection, disabled = false, compare, onCursor }: {
  asset: Asset; selection: Selection; onSelection?: (selection: Selection) => void; disabled?: boolean; compare?: Float32Array; onCursor?: (seconds: number) => void
}) {
  const { t } = useI18n()

  const canvasRef = useRef<HTMLCanvasElement>(null), hostRef = useRef<HTMLDivElement>(null), audioRef = useRef<HTMLAudioElement>(null)
  const url = useBlobUrl(asset.blob)
  const duration = asset.samples.length / SAMPLE_RATE
  const [zoom, setZoom] = useState(1), [pan, setPan] = useState(0), [width, setWidth] = useState(800)
  const [mode, setMode] = useState<'wave' | 'spectrum'>('wave')
  const [spectrumData, setSpectrumData] = useState<Spectrogram | null>(null), [spectrumBusy, setSpectrumBusy] = useState(false), [error, setError] = useState('')
  const [playing, setPlaying] = useState(false), [cursor, setCursor] = useState(0), [volume, setVolume] = useState(.75), [speed, setSpeed] = useState(1), [loop, setLoop] = useState(false)
  const rangePlayback = useRef(false), dragging = useRef<{ x: number; time: number } | null>(null)
  const visibleDuration = duration / zoom
  const viewStart = Math.min(pan, Math.max(0, duration - visibleDuration)), viewEnd = viewStart + visibleDuration
  const leftPercent = (seconds: number) => (seconds - viewStart) / visibleDuration * 100
  useEffect(() => {
    setZoom(1); setPan(0); setCursor(0); setPlaying(false); setError('')
  }, [asset.id])
  useEffect(() => {
    if (!hostRef.current) return
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
    observer.observe(hostRef.current); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (mode !== 'spectrum') return
    let active = true
    setSpectrumBusy(true); setSpectrumData(null)
    const timeout = setTimeout(() => {
      void audioTask<Spectrogram>('spectrum', { samples: asset.samples, start: viewStart, end: viewEnd, maxHz: 12000 })
        .then(value => { if (active) { setSpectrumData(value); setSpectrumBusy(false) } })
        .catch(e => { if (active) { setError(e.message); setSpectrumBusy(false) } })
    }, 120)
    return () => { active = false; clearTimeout(timeout) }
  }, [asset, mode, viewStart, viewEnd])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const height = 244, ratio = Math.min(devicePixelRatio, 2)
    canvas.width = width * ratio; canvas.height = height * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = '#0b1413'; ctx.fillRect(0, 0, width, height)
    if (mode === 'spectrum' && spectrumData) {
      const image = document.createElement('canvas'); image.width = spectrumData.columns; image.height = spectrumData.bins
      const imageCtx = image.getContext('2d')!
      const pixels = imageCtx.createImageData(image.width, image.height)
      for (let x = 0; x < image.width; x++) for (let y = 0; y < image.height; y++) {
        const value = Math.max(0, Math.min(1, (spectrumData.values[x * image.height + y] + 90) / 90))
        const index = ((image.height - 1 - y) * image.width + x) * 4
        pixels.data[index] = 8 + Math.pow(value, 3) * 225
        pixels.data[index + 1] = 22 + value * 224
        pixels.data[index + 2] = 29 + value * 158
        pixels.data[index + 3] = 255
      }
      imageCtx.putImageData(pixels, 0, 0); ctx.drawImage(image, 0, 29, width, height - 29)
    }
    ctx.font = '10px monospace'; ctx.lineWidth = 1
    for (let i = 0; i <= 8; i++) {
      const x = i * width / 8
      ctx.strokeStyle = '#91c5b415'; ctx.beginPath(); ctx.moveTo(x, 28); ctx.lineTo(x, height); ctx.stroke()
      ctx.fillStyle = '#718e83'; ctx.textAlign = i === 8 ? 'right' : 'left'; ctx.fillText(time(viewStart + i * visibleDuration / 8, zoom > 8), x + (i === 8 ? -7 : 7), 17)
    }
    for (const y of [30, 83, 136, 189, 242]) {
      ctx.strokeStyle = y === 136 ? '#82ba9d38' : '#91c5b40e'; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }
    if (mode === 'wave') {
      const drawWave = (samples: Float32Array, color: string) => {
        ctx.strokeStyle = color; ctx.lineWidth = 1
        const from = Math.floor(viewStart * SAMPLE_RATE), step = visibleDuration * SAMPLE_RATE / width
        ctx.beginPath()
        for (let x = 0; x < width; x++) {
          const start = from + Math.floor(x * step), end = Math.min(samples.length, from + Math.max(Math.floor((x + 1) * step), Math.floor(x * step) + 1))
          let min = 0, max = 0
          for (let j = start; j < end; j++) { min = Math.min(min, samples[j]); max = Math.max(max, samples[j]) }
          ctx.moveTo(x, 136 - max * 105); ctx.lineTo(x, 136 - min * 105)
        }
        ctx.stroke()
      }
      if (compare) drawWave(compare, '#b7c3c075')
      drawWave(asset.samples, '#68e3be')
      ctx.textAlign = 'right'; ctx.fillStyle = '#6f9988'; ctx.fillText('+1.0', width - 8, 42); ctx.fillText('−1.0', width - 8, 233)
    } else {
      ctx.textAlign = 'right'; ctx.fillStyle = '#c5e9dc'; ctx.fillText('12 kHz', width - 8, 42); ctx.fillText('3 kHz', width - 8, 137); ctx.fillText('0 Hz', width - 8, 233)
    }
  }, [asset, width, mode, spectrumData, viewStart, visibleDuration, zoom, compare])
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const update = () => {
      const audio = audioRef.current
      if (audio) {
        if (rangePlayback.current && audio.currentTime >= selection.end) {
          if (loop) audio.currentTime = selection.start
          else audio.pause()
        }
        setCursor(audio.currentTime)
      }
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update)
    return () => cancelAnimationFrame(frame)
  }, [playing, selection, loop])
  useEffect(() => { if (audioRef.current) { audioRef.current.volume = volume; audioRef.current.playbackRate = speed } }, [volume, speed, url])
  useEffect(() => { if (disabled) audioRef.current?.pause() }, [disabled])
  function seek(seconds: number) {
    const value = Math.max(0, Math.min(duration, seconds))
    if (audioRef.current) audioRef.current.currentTime = value
    setCursor(value)
  }
  async function play(selected = false) {
    const audio = audioRef.current
    if (!audio) return
    setError(''); rangePlayback.current = selected || loop
    if (selected || (loop && (audio.currentTime < selection.start || audio.currentTime >= selection.end))) seek(selection.start)
    try { await audio.play() } catch { setError('Ses oynatılamadı. Yeniden oynatmayı dene.') }
  }
  function pointerTime(event: PointerEvent) {
    const rect = event.currentTarget.getBoundingClientRect()
    return viewStart + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * visibleDuration
  }
  function zoomToSelection() {
    const length = selection.end - selection.start
    if (length > 0) { setZoom(Math.max(1, Math.min(64, duration / length))); setPan(selection.start) }
  }
  useEffect(() => { onCursor?.(cursor) }, [cursor, onCursor])
  const selLeft = Math.max(0, Math.min(100, leftPercent(selection.start)))
  const selRight = Math.max(0, Math.min(100, leftPercent(selection.end)))
  return <div className="timeline-panel">
    <div className="timeline-heading"><div className="timeline-tabs" role="group" aria-label={t("Ses görünümü")}><button className={mode === 'wave' ? 'active' : ''} onClick={() => setMode('wave')}><AudioLines size={15} />{t("Dalga formu")}</button><button className={mode === 'spectrum' ? 'active' : ''} onClick={() => setMode('spectrum')}><Waves size={15} />{t("Spektrogram")}</button></div><span className="timeline-format">{t("48 kHz ")}<b>/</b>{t(" MONO")}</span></div>
    <div className="timeline-track-title"><span><i /> {asset.name}</span><span>{mode === 'spectrum' ? spectrumBusy ? t('Frekanslar hesaplanıyor…') : t('Hann / 1024 FFT / 0–12 kHz') : t('PCM DALGA FORMU')}</span></div>
    <div ref={hostRef} className="waveform-host" tabIndex={0} role="group" aria-label={t("Ses zaman çizelgesi. Sürükleyerek bölge seç; ok tuşlarıyla oynatma konumunu değiştir.")} onKeyDown={e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seek(cursor + (e.key === 'ArrowRight' ? 1 : -1) * .5) }
      if (e.code === 'Space') { e.preventDefault(); if (playing) audioRef.current?.pause(); else void play() }
    }} onPointerDown={e => {
      if (disabled || e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId); dragging.current = { x: e.clientX, time: pointerTime(e) }
    }} onPointerMove={e => {
      if (!dragging.current || !onSelection || disabled || Math.abs(e.clientX - dragging.current.x) < 3) return
      const t = pointerTime(e); onSelection({ start: Math.min(t, dragging.current.time), end: Math.max(t, dragging.current.time) })
    }} onPointerUp={e => {
      if (!dragging.current) return
      if (Math.abs(e.clientX - dragging.current.x) < 3) seek(pointerTime(e))
      dragging.current = null
    }} onPointerCancel={() => { dragging.current = null }}>
      <canvas ref={canvasRef} aria-label={mode === 'wave' ? t('Gerçek ses örneklerinden dalga formu') : t('Sesin hesaplanmış frekans spektrogramı')} />
      {onSelection && selRight > selLeft && <div className="wave-selection" style={{ left: `${selLeft}%`, width: `${selRight - selLeft}%` }}><span>{time(selection.end - selection.start, true)}</span></div>}
      {cursor >= viewStart && cursor <= viewEnd && <div className="wave-playhead" style={{ left: `${leftPercent(cursor)}%` }}><i /></div>}
    </div>
    <div className="timeline-scroll"><input type="range" min="0" max={Math.max(0, duration - visibleDuration)} step="0.01" value={viewStart} onChange={e => setPan(Number(e.target.value))} disabled={zoom === 1} aria-label={t("Zaman çizelgesini kaydır")} /></div>
    <div className="timeline-tools"><span>{time(viewStart, true)} – {time(viewEnd, true)}</span><div><button title={t("Uzaklaştır")} aria-label={t("Uzaklaştır")} disabled={zoom <= 1} onClick={() => { setZoom(Math.max(1, zoom / 2)); }}><ZoomOut size={15} /></button><span className="zoom-value">{zoom.toFixed(zoom % 1 ? 1 : 0)}×</span><button title={t("Yakınlaştır")} aria-label={t("Yakınlaştır")} disabled={zoom >= 64} onClick={() => setZoom(Math.min(64, zoom * 2))}><ZoomIn size={15} /></button><button title={t("Seçime yakınlaş")} aria-label={t("Seçime yakınlaş")} onClick={zoomToSelection}><Focus size={15} /></button><button title={t("Tüm sesi göster")} aria-label={t("Tüm sesi göster")} onClick={() => { setZoom(1); setPan(0) }}><Maximize2 size={14} /></button></div></div>
    <div className="transport"><div className="transport-primary"><button aria-label={t("Başa dön")} title={t("Başa dön")} onClick={() => seek(0)}><SkipBack size={16} /></button><button className="play-button" aria-label={playing ? t('Duraklat') : t('Oynat')} disabled={disabled} onClick={() => { if (playing) audioRef.current?.pause(); else void play() }}>{playing ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}</button><button aria-label={t("Durdur")} title={t("Durdur")} onClick={() => { audioRef.current?.pause(); seek(0) }}><Square size={13} fill="currentColor" /></button><strong className="playback-clock">{time(cursor, true)}<span> / {time(duration, true)}</span></strong></div>
      <div className="transport-secondary"><button className="selection-play" disabled={disabled || selection.end <= selection.start} onClick={() => void play(true)}>{t("Seçimi dinle")}</button><button className={loop ? 'is-active' : ''} aria-label={t("Seçimi döngüye al")} aria-pressed={loop} title={t("Seçimi döngüye al")} onClick={() => { setLoop(!loop); rangePlayback.current = !loop }}><Repeat2 size={17} /></button><select aria-label={t("Oynatma hızı")} value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.5, .75, 1, 1.25, 1.5, 2].map(value => <option value={value} key={value}>{value}×</option>)}</select><Volume2 size={15} /><input aria-label={t("Dinleme ses seviyesi")} type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} /></div>
    </div>
    <audio ref={audioRef} src={url || undefined} preload="metadata" onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} onTimeUpdate={e => setCursor(e.currentTarget.currentTime)} />
    {error && <div className="studio-error" role="alert">{t(error)}</div>}
  </div>
}
