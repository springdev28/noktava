import { useI18n } from '../lib/i18n'
import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from 'react'
import { AudioLines, Focus, Maximize2, Pause, Pencil, Play, Repeat2, SkipBack, Square, Volume2, Waves, ZoomIn, ZoomOut, MousePointer2 } from 'lucide-react'
import { SAMPLE_RATE } from '../lib/audio'
import type { Selection, Spectrogram } from '../lib/editor'
import { buildWavePyramid, clampView, preciseTime, timeTicks, waveRange, zoomView, type WavePyramid } from '../lib/waveform'
import { audioTask } from '../lib/worker-client'
import type { Asset } from './StudioContext'
import { time, useBlobUrl } from './shared'
import './Timeline.css'

const HEIGHT = 300, TOP = 34, BOTTOM = 20, MIDDLE = (HEIGHT + TOP - BOTTOM) / 2, HALF = (HEIGHT - TOP - BOTTOM) / 2
export function Timeline({ asset, selection, onSelection, disabled = false, compare, onCursor, resetKey, pointSelection = false, onDraw, selectionActions }: {
  asset: Asset; selection: Selection; onSelection?: (selection: Selection) => void; disabled?: boolean; compare?: Float32Array; onCursor?: (seconds: number) => void
  resetKey?: number; pointSelection?: boolean; selectionActions?: ReactNode; onDraw?: (start: number, samples: Float32Array) => void
}) {
  const { t } = useI18n()
  const canvasRef = useRef<HTMLCanvasElement>(null), overviewRef = useRef<HTMLCanvasElement>(null), hostRef = useRef<HTMLDivElement>(null), audioRef = useRef<HTMLAudioElement>(null)
  const duration = asset.samples.length / SAMPLE_RATE, url = useBlobUrl(asset.blob)
  const [view, setView] = useState({ start: 0, span: Math.min(10, duration) }), [width, setWidth] = useState(900), [verticalZoom, setVerticalZoom] = useState(1)
  const [mode, setMode] = useState<'wave' | 'spectrum'>('wave'), [tool, setTool] = useState<'select' | 'draw'>('select')
  const [spectrumData, setSpectrumData] = useState<Spectrogram | null>(null), [spectrumBusy, setSpectrumBusy] = useState(false), [error, setError] = useState('')
  const [playing, setPlaying] = useState(false), [cursor, setCursor] = useState(0), [volume, setVolume] = useState(.75), [speed, setSpeed] = useState(1), [loop, setLoop] = useState(false)
  const [draftVersion, setDraftVersion] = useState(0)
  const draft = useRef(new Map<number, number>()), playbackPosition = useRef(0)
  const rangePlayback = useRef(false), dragging = useRef<{ x: number; time: number; kind: 'select' | 'start' | 'end' | 'draw'; anchor: Selection; previous?: { index: number; value: number } } | null>(null)
  const overviewDrag = useRef<{ offset: number } | null>(null)
  const pyramid = useMemo(() => buildWavePyramid(asset.samples), [asset.samples])
  const comparison = useMemo(() => compare ? buildWavePyramid(compare) : null, [compare])
  const minSpan = Math.max(32, Math.ceil(width / 8)) / SAMPLE_RATE
  const currentView = clampView(view.start, view.span, duration, minSpan)
  const viewStart = currentView.start, span = currentView.span, viewEnd = viewStart + span
  const samplesPerPixel = span * SAMPLE_RATE / Math.max(1, width), detailed = samplesPerPixel <= 2
  const hasSelection = selection.end - selection.start >= 1 / SAMPLE_RATE - 1e-9
  const leftPercent = (seconds: number) => (seconds - viewStart) / span * 100
  useEffect(() => {
    setView({ start: 0, span: Math.min(10, duration) }); setCursor(0); playbackPosition.current = 0; setPlaying(false); setError(''); setTool('select'); setVerticalZoom(1)
  }, [resetKey ?? asset.id])
  useEffect(() => { draft.current.clear(); playbackPosition.current = Math.min(playbackPosition.current, duration); setCursor(playbackPosition.current); setPlaying(false) }, [asset.id])
  useEffect(() => { if (!detailed) setTool('select') }, [detailed])
  useEffect(() => {
    if (!hostRef.current) return
    const observer = new ResizeObserver(entries => setWidth(entries[0].contentRect.width))
    observer.observe(hostRef.current); return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (mode !== 'spectrum') return
    let active = true
    setSpectrumBusy(true); setSpectrumData(null)
    const timeout = setTimeout(() => { void audioTask<Spectrogram>('spectrum', { samples: asset.samples, start: viewStart, end: viewEnd, maxHz: 12000 })
      .then(value => { if (active) { setSpectrumData(value); setSpectrumBusy(false) } })
      .catch(e => { if (active) { setError(e.message); setSpectrumBusy(false) } }) }, 120)
    return () => { active = false; clearTimeout(timeout) }
  }, [asset.samples, mode, viewStart, viewEnd])
  useEffect(() => {
    const canvas = overviewRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const w = canvas.parentElement!.clientWidth, ratio = Math.min(devicePixelRatio, 2)
    canvas.width = w * ratio; canvas.height = 50 * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, w, 50); ctx.fillStyle = '#819c8b'
    for (let x = 0; x < w; x++) { const p = waveRange(pyramid, x * asset.samples.length / w, (x + 1) * asset.samples.length / w); ctx.fillRect(x, 25 - p.max * 22, 1, Math.max(1, (p.max - p.min) * 22)) }
  }, [pyramid, width])
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const ratio = Math.min(devicePixelRatio, 2)
    canvas.width = width * ratio; canvas.height = HEIGHT * ratio; ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.fillStyle = '#0b1512'; ctx.fillRect(0, 0, width, HEIGHT)
    if (mode === 'spectrum' && spectrumData) {
      const image = document.createElement('canvas'); image.width = spectrumData.columns; image.height = spectrumData.bins
      const imageCtx = image.getContext('2d')!, pixels = imageCtx.createImageData(image.width, image.height)
      for (let x = 0; x < image.width; x++) for (let y = 0; y < image.height; y++) {
        const value = Math.max(0, Math.min(1, (spectrumData.values[x * image.height + y] + 90) / 90)), index = ((image.height - 1 - y) * image.width + x) * 4
        pixels.data[index] = 10 + Math.pow(value, 2) * 245; pixels.data[index + 1] = 24 + value * 166; pixels.data[index + 2] = 24 + value * 75; pixels.data[index + 3] = 255
      }
      imageCtx.putImageData(pixels, 0, 0); ctx.drawImage(image, 0, TOP, width, HEIGHT - TOP - BOTTOM)
    }
    const { ticks, step } = timeTicks(viewStart, span, width)
    ctx.font = '11px monospace'
    let labelRight = -Infinity
    for (const seconds of ticks) {
      const x = (seconds - viewStart) / span * width
      ctx.strokeStyle = '#7da38c22'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, TOP); ctx.lineTo(x, HEIGHT - BOTTOM); ctx.stroke()
      const digits = step < .01 ? 5 : step < 1 ? 3 : 0
      const label = preciseTime(seconds, digits), labelWidth = ctx.measureText(label).width
      const labelLeft = Math.max(3, Math.min(x + 4, width - labelWidth - 5))
      if (labelLeft >= labelRight + 10) { ctx.textAlign = 'left'; ctx.fillStyle = '#b8c5bc'; ctx.fillText(label, labelLeft, 21); labelRight = labelLeft + labelWidth }
    }
    for (const value of [1, .5, 0, -.5, -1]) {
      const y = MIDDLE - value * HALF
      ctx.strokeStyle = value === 0 ? '#8eac9a66' : '#86a39418'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke()
    }
    if (mode === 'wave') {
      ctx.save(); ctx.beginPath(); ctx.rect(0, TOP, width, HEIGHT - TOP - BOTTOM); ctx.clip()
      const drawWave = (data: WavePyramid, overlay = false) => {
        if (detailed) {
          const from = Math.max(0, Math.floor(viewStart * SAMPLE_RATE)), end = Math.min(data.samples.length, Math.ceil(viewEnd * SAMPLE_RATE) + 1)
          ctx.strokeStyle = overlay ? '#a9b0a572' : '#83e2bd'; ctx.lineWidth = overlay ? 1 : 1.7; ctx.beginPath()
          for (let i = from; i < end; i++) { const x = (i / SAMPLE_RATE - viewStart) / span * width, y = MIDDLE - (overlay ? data.samples[i] : draft.current.get(i) ?? data.samples[i]) * HALF * verticalZoom; if (i === from) ctx.moveTo(x, y); else ctx.lineTo(x, y) }
          ctx.stroke()
          if (!overlay && samplesPerPixel < .25) for (let i = from; i < end; i++) { const x = (i / SAMPLE_RATE - viewStart) / span * width, y = MIDDLE - (draft.current.get(i) ?? data.samples[i]) * HALF * verticalZoom; ctx.fillStyle = draft.current.has(i) ? '#ff9d62' : '#b5f3d9'; ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill() }
        } else {
          const ranges = Array.from({ length: Math.ceil(width) }, (_, x) => waveRange(data, (viewStart + x / width * span) * SAMPLE_RATE, (viewStart + (x + 1) / width * span) * SAMPLE_RATE))
          ctx.fillStyle = overlay ? '#c3c2ad28' : '#75dab742'; ctx.beginPath()
          ranges.forEach((p, x) => { const y = MIDDLE - p.max * HALF * verticalZoom; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
          for (let x = ranges.length - 1; x >= 0; x--) ctx.lineTo(x, MIDDLE - ranges[x].min * HALF * verticalZoom)
          ctx.closePath(); ctx.fill()
          if (!overlay) {
            ctx.fillStyle = '#76cfa98c'; ctx.beginPath()
            ranges.forEach((p, x) => { const y = MIDDLE - Math.max(p.min, Math.min(p.max, p.rms)) * HALF * verticalZoom; if (!x) ctx.moveTo(x, y); else ctx.lineTo(x, y) })
            for (let x = ranges.length - 1; x >= 0; x--) { const p = ranges[x]; ctx.lineTo(x, MIDDLE - Math.min(p.max, Math.max(p.min, -p.rms)) * HALF * verticalZoom) }
            ctx.closePath(); ctx.fill()
          }
        }
      }
      if (comparison) drawWave(comparison, true)
      drawWave(pyramid); ctx.restore()
    }
  }, [pyramid, comparison, width, mode, spectrumData, viewStart, span, detailed, samplesPerPixel, verticalZoom, draftVersion])
  useEffect(() => {
    if (!playing) return
    let frame = 0
    const update = () => {
      const audio = audioRef.current
      if (audio) {
        if (rangePlayback.current && hasSelection && audio.currentTime >= selection.end) { if (loop) audio.currentTime = selection.start; else audio.pause() }
        playbackPosition.current = audio.currentTime; setCursor(audio.currentTime)
      }
      frame = requestAnimationFrame(update)
    }
    frame = requestAnimationFrame(update); return () => cancelAnimationFrame(frame)
  }, [playing, selection, loop, hasSelection])
  useEffect(() => { if (audioRef.current) { audioRef.current.volume = volume; audioRef.current.playbackRate = speed } }, [volume, speed, url])
  useEffect(() => { if (disabled) audioRef.current?.pause() }, [disabled])
  useEffect(() => { onCursor?.(cursor) }, [cursor, onCursor])
  function seek(seconds: number) { const value = Math.max(0, Math.min(duration, seconds)); playbackPosition.current = value; if (audioRef.current) audioRef.current.currentTime = value; setCursor(value) }
  async function play(selected = false) {
    const audio = audioRef.current
    if (!audio) return
    setError(''); rangePlayback.current = (selected || loop) && hasSelection
    if (rangePlayback.current && (selected || audio.currentTime < selection.start || audio.currentTime >= selection.end)) seek(selection.start)
    if (audio.currentTime >= duration) seek(0)
    try { await audio.play() } catch { setError('Ses oynatılamadı. Yeniden oynatmayı dene.') }
  }
  function pointerTime(event: PointerEvent) { const rect = hostRef.current!.getBoundingClientRect(); return Math.round((viewStart + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * span) * SAMPLE_RATE) / SAMPLE_RATE }
  function changeView(nextSpan: number, anchor = cursor >= viewStart && cursor <= viewEnd ? cursor : viewStart + span / 2) { setView(zoomView(viewStart, span, nextSpan, anchor, duration, minSpan)) }
  function zoomSelection() { if (hasSelection) setView(clampView(selection.start - (selection.end - selection.start) * .08, (selection.end - selection.start) * 1.16, duration, minSpan)) }
  function drawPoint(event: PointerEvent) {
    const drag = dragging.current
    if (!drag || !detailed) return
    const rect = hostRef.current!.getBoundingClientRect(), index = Math.max(0, Math.min(asset.samples.length - 1, Math.round(pointerTime(event) * SAMPLE_RATE)))
    const value = Math.max(-1, Math.min(1, (MIDDLE - (event.clientY - rect.top)) / HALF / verticalZoom))
    const previous = drag.previous ?? { index, value }, from = Math.min(index, previous.index), to = Math.max(index, previous.index)
    if (to - from > 16384) return
    for (let i = from; i <= to; i++) draft.current.set(i, previous.index === index ? value : previous.value + (value - previous.value) * (i - previous.index) / (index - previous.index))
    drag.previous = { index, value }; setDraftVersion(n => n + 1)
  }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (disabled || event.button !== 0) return
    const edge = (event.target as HTMLElement).closest('[data-edge]')?.getAttribute('data-edge') as 'start' | 'end' | undefined
    const kind = edge ?? (tool === 'draw' && detailed && onDraw ? 'draw' : 'select')
    audioRef.current?.pause(); event.currentTarget.setPointerCapture(event.pointerId); event.currentTarget.focus()
    dragging.current = { x: event.clientX, time: pointerTime(event), kind, anchor: selection }
    if (kind === 'draw') { draft.current.clear(); drawPoint(event) }
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragging.current
    if (!drag || disabled) return
    if (drag.kind === 'draw') { drawPoint(event); return }
    if (!onSelection || (drag.kind === 'select' && Math.abs(event.clientX - drag.x) < 3)) return
    const at = pointerTime(event)
    if (drag.kind === 'start') onSelection({ start: Math.min(at, drag.anchor.end - 1 / SAMPLE_RATE), end: drag.anchor.end })
    else if (drag.kind === 'end') onSelection({ start: drag.anchor.start, end: Math.max(at, drag.anchor.start + 1 / SAMPLE_RATE) })
    else onSelection({ start: Math.min(at, drag.time), end: Math.max(at, drag.time) })
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragging.current
    if (!drag) return
    if (drag.kind === 'draw' && draft.current.size && onDraw) {
      const indices = [...draft.current.keys()], start = Math.min(...indices), end = Math.max(...indices) + 1
      const values = asset.samples.slice(start, end); for (const [index, value] of draft.current) values[index - start] = value
      onDraw(start / SAMPLE_RATE, values); draft.current.clear(); setDraftVersion(n => n + 1)
    } else if (drag.kind === 'select' && Math.abs(event.clientX - drag.x) < 3) {
      seek(pointerTime(event)); if (pointSelection && onSelection) onSelection({ start: pointerTime(event), end: pointerTime(event) })
    } else if (drag.kind === 'select') seek(Math.min(drag.time, pointerTime(event)))
    dragging.current = null
  }
  function moveHandle(edge: 'start' | 'end', key: string, shift: boolean) {
    if (!onSelection || !['ArrowLeft', 'ArrowRight'].includes(key)) return
    const delta = (key === 'ArrowRight' ? 1 : -1) * (shift ? span / 100 : 1 / SAMPLE_RATE)
    onSelection(edge === 'start' ? { ...selection, start: Math.max(0, Math.min(selection.end - 1 / SAMPLE_RATE, selection.start + delta)) } : { ...selection, end: Math.min(duration, Math.max(selection.start + 1 / SAMPLE_RATE, selection.end + delta)) })
  }
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      const rect = host.getBoundingClientRect(), anchor = viewStart + (event.clientX - rect.left) / rect.width * span
      setView(zoomView(viewStart, span, span * (event.deltaY > 0 ? 1.5 : 1 / 1.5), anchor, duration, minSpan))
    }
    host.addEventListener('wheel', wheel, { passive: false }); return () => host.removeEventListener('wheel', wheel)
  }, [viewStart, span, duration, minSpan])
  const selectionLeft = Math.max(0, leftPercent(selection.start)), selectionRight = Math.min(100, leftPercent(selection.end))
  const overviewMove = (event: PointerEvent<HTMLDivElement>) => { if (!overviewDrag.current) return; const rect = event.currentTarget.getBoundingClientRect(); setView(clampView((event.clientX - rect.left) / rect.width * duration - overviewDrag.current.offset, span, duration, minSpan)) }
  return <section className="timeline-panel wave-editor" aria-label={t('Ses düzenleyici', 'Audio editor')}>
    <div className="we-heading"><div className="we-tabs" role="group" aria-label={t('Ses görünümü')}><button type="button" className={mode === 'wave' ? 'active' : ''} aria-pressed={mode === 'wave'} onClick={() => setMode('wave')}><AudioLines size={16} />{t('Dalga formu')}</button><button type="button" className={mode === 'spectrum' ? 'active' : ''} aria-pressed={mode === 'spectrum'} onClick={() => { setMode('spectrum'); setTool('select') }}><Waves size={16} />{t('Spektrogram')}</button></div><span className="we-format">48 kHz / {t('Mono', 'Mono')}</span></div>
    <div className="we-overview-label"><strong>{t('Tüm kayıt', 'Entire recording')}</strong><span>{t('Çerçeveyi sürükleyerek gezin.', 'Drag the frame to move through the recording.')} <b>{time(duration)}</b></span></div>
    <div className="we-overview" role="slider" tabIndex={0} aria-label={t('Görünen zaman aralığı', 'Visible time range')} aria-valuemin={0} aria-valuemax={Math.max(0, duration - span)} aria-valuenow={viewStart} aria-valuetext={`${preciseTime(viewStart)} / ${preciseTime(viewEnd)}`} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); setView(clampView(viewStart + (e.key === 'ArrowLeft' ? -1 : 1) * span / 2, span, duration, minSpan)) } }} onPointerDown={e => { if (e.button !== 0) return; const rect = e.currentTarget.getBoundingClientRect(), at = (e.clientX - rect.left) / rect.width * duration; overviewDrag.current = { offset: at >= viewStart && at <= viewEnd ? at - viewStart : span / 2 }; e.currentTarget.setPointerCapture(e.pointerId); overviewMove(e) }} onPointerMove={overviewMove} onPointerUp={() => { overviewDrag.current = null }} onPointerCancel={() => { overviewDrag.current = null }}><canvas ref={overviewRef} aria-hidden="true" /><div className="we-window" style={{ left: `${viewStart / duration * 100}%`, width: `${span / duration * 100}%` }} /></div>
    <div className="we-zoom"><div className="we-presets"><span>{t('Görünüm', 'View')}</span>{[[duration, t('Tümü', 'All')], [10, '10 s'], [1, '1 s'], [.01, '10 ms']].map(([seconds, label], i) => <button type="button" key={i} className={Math.abs(span - Math.min(duration, Number(seconds))) < 1e-6 ? 'active' : ''} onClick={() => changeView(Number(seconds))}>{label}</button>)}</div><div className="we-zoom-actions"><button type="button" aria-label={t('Uzaklaştır')} title={t('Uzaklaştır')} disabled={span >= duration} onClick={() => changeView(span * 2)}><ZoomOut size={16} /></button><button type="button" aria-label={t('Yakınlaştır')} title={t('Yakınlaştır')} disabled={span <= minSpan} onClick={() => changeView(span / 2)}><ZoomIn size={16} /></button>{onSelection && <button type="button" disabled={!hasSelection} onClick={zoomSelection}><Focus size={15} />{t('Seçime yakınlaş')}</button>}</div></div>
    <div className="we-explainer"><span>{mode === 'wave' ? detailed ? t('Gerçek ses örnekleri. Noktalar tek bir örneği gösterir.', 'Actual audio samples. Each dot is one sample.') : t('Yatay: zaman. Dikey: genlik. Açık alan tepe, koyu alan ortalama seviyeyi (RMS) gösterir.', 'Horizontal: time. Vertical: amplitude. Light fill shows peaks, darker fill shows average level (RMS).') : t('Yatay: zaman. Dikey: frekans. Parlak alanlar daha güçlü frekanslardır.', 'Horizontal: time. Vertical: frequency. Brighter areas show stronger frequencies.')}</span>{mode === 'wave' && <label>{t('Dikey ölçek', 'Vertical scale')}<select aria-label={t('Dikey ölçek', 'Vertical scale')} value={verticalZoom} onChange={e => setVerticalZoom(Number(e.target.value))}>{[1, 2, 4, 8].map(n => <option key={n} value={n}>{n}×</option>)}</select></label>}</div>
    <div className="we-track"><div className="we-axis" aria-hidden="true"><span className="we-axis-title">{mode === 'wave' ? t('GENLİK', 'AMP') : 'Hz'}</span>{[1, .5, 0, -.5, -1].map((value, i) => <span key={i} style={{ top: `${MIDDLE - value * HALF}px` }}>{mode === 'wave' ? `${value > 0 ? '+' : ''}${(value / verticalZoom).toFixed(verticalZoom > 2 ? 3 : 2)}` : ['12k', '6.75k', '3k', '750', '0'][i]}</span>)}</div>
      <div ref={hostRef} className={`waveform-host ${tool === 'draw' && detailed ? 'is-drawing' : ''}`} tabIndex={0} role="group" aria-label={t('Ses zaman çizelgesi. Sürükleyerek bölge seç; ok tuşlarıyla oynatma konumunu değiştir.')} onKeyDown={e => {
        if (disabled || (e.target as HTMLElement).dataset.edge) return
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seek(cursor + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 / SAMPLE_RATE : span / 100)) }
        if (e.code === 'Space') { e.preventDefault(); if (playing) audioRef.current?.pause(); else void play() }
        if (e.key === '+' || e.key === '=') { e.preventDefault(); changeView(span / 2) }
        if (e.key === '-') { e.preventDefault(); changeView(span * 2) }
        if (e.key === 'Escape' && pointSelection) onSelection?.({ start: cursor, end: cursor })
      }} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={() => { dragging.current = null; draft.current.clear(); setDraftVersion(n => n + 1) }}>
        <canvas ref={canvasRef} aria-label={mode === 'wave' ? t('Gerçek ses örneklerinden dalga formu') : t('Sesin hesaplanmış frekans spektrogramı')} />
        {onSelection && hasSelection && selectionRight > selectionLeft && <div className="we-selection" style={{ left: `${selectionLeft}%`, width: `${selectionRight - selectionLeft}%` }} />}
        {onSelection && hasSelection && (['start', 'end'] as const).map(edge => selection[edge] >= viewStart && selection[edge] <= viewEnd && <button type="button" key={edge} disabled={disabled} data-edge={edge} className={`we-handle ${edge}`} style={{ left: `${leftPercent(selection[edge])}%` }} aria-label={edge === 'start' ? t('Seçim başlangıcını sürükle', 'Drag selection start') : t('Seçim bitişini sürükle', 'Drag selection end')} title={`${edge === 'start' ? t('Başlangıç', 'Start') : t('Bitiş', 'End')}: ${preciseTime(selection[edge], 5)}`} onKeyDown={e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); moveHandle(edge, e.key, e.shiftKey) } }}><span>{edge === 'start' ? t('BAŞ', 'IN') : t('SON', 'OUT')}</span><i /></button>)}
        {cursor >= viewStart && cursor <= viewEnd && <div className="we-playhead" style={{ left: `${leftPercent(cursor)}%` }}><i /></div>}
        {spectrumBusy && mode === 'spectrum' && <div className="we-calculating" role="status">{t('Frekanslar hesaplanıyor…')}</div>}
      </div></div>
    <div className="we-readout"><span>{preciseTime(viewStart, span < .1 ? 5 : 3)} <span>→</span> {preciseTime(viewEnd, span < .1 ? 5 : 3)}</span><span>{span < 1 ? `${(span * 1000).toFixed(2)} ms` : `${span.toFixed(2)} s`} {t('görünür', 'visible')}{mode === 'wave' && verticalZoom > 1 && ` / ${t('Dikey büyütme sesi değiştirmez.', 'Vertical zoom does not change the audio.')}`}</span></div>
    <div className="we-interaction"><div className="we-tools"><button type="button" className={tool === 'select' ? 'active' : ''} aria-pressed={tool === 'select'} onClick={() => setTool('select')}><MousePointer2 size={15} />{t('Seç', 'Select')}</button>{onDraw && <button type="button" className={tool === 'draw' ? 'active' : ''} aria-pressed={tool === 'draw'} disabled={disabled} onClick={() => { setTool('draw'); setMode('wave'); if (!detailed) { const anchor = hasSelection ? (selection.start + selection.end) / 2 : cursor >= viewStart && cursor <= viewEnd ? cursor : viewStart + span / 2; seek(anchor); setView(clampView(anchor - Math.min(.01, width / SAMPLE_RATE) / 2, Math.min(.01, width / SAMPLE_RATE), duration, minSpan)) } }}><Pencil size={15} />{t('Örnekleri çiz', 'Draw samples')}</button>}</div>{selectionActions && <div className="we-quick-edits">{selectionActions}</div>}<p>{tool === 'draw' && detailed ? t('Dalgayı sürükleyerek örnekleri değiştir. Geri al ile düzeltebilirsin.', 'Drag the waveform to change samples. Undo restores the previous audio.') : t('Tıkla: dinleme konumu. Sürükle: seçim. Turuncu tutamaçlar: sınırları ayarla.', 'Click to seek. Drag to select. Move the orange handles to adjust the edges.')}</p></div>
    {onSelection && <div className="we-selection-fields"><strong>{hasSelection ? t('Seçili bölge', 'Selected region') : t('Bölge seçilmedi', 'No region selected')}</strong><label>{t('Başlangıç (s)', 'Start (s)')}<input id={pointSelection ? 'selection-start' : undefined} aria-label={t('Seçim başlangıcı', 'Selection start')} type="number" min="0" max={selection.end} step="any" value={Number(selection.start.toFixed(6))} disabled={disabled} onChange={e => { const start = Math.max(0, Math.min(duration, Number(e.target.value))); onSelection({ start, end: Math.max(start, selection.end) }) }} /></label><label>{t('Bitiş (s)', 'End (s)')}<input id={pointSelection ? 'selection-end' : undefined} aria-label={t('Seçim bitişi', 'Selection end')} type="number" min={selection.start} max={duration} step="any" value={Number(selection.end.toFixed(6))} disabled={disabled} onChange={e => onSelection({ ...selection, end: Math.max(selection.start, Math.min(duration, Number(e.target.value))) })} /></label><div><span>{t('Süre', 'Length')}</span><output>{hasSelection ? preciseTime(selection.end - selection.start, 5) : '00:00.00000'}</output></div><button type="button" disabled={disabled} onClick={() => onSelection({ start: 0, end: duration })}><Maximize2 size={14} />{t('Tümünü seç')}</button></div>}
    <div className="we-transport"><div className="we-playback"><button type="button" aria-label={t('Başa dön')} title={t('Başa dön')} onClick={() => { seek(0); setView(clampView(0, span, duration, minSpan)) }}><SkipBack size={17} /></button><button type="button" className="we-play" aria-label={playing ? t('Duraklat') : t('Oynat')} disabled={disabled} onClick={() => { if (playing) audioRef.current?.pause(); else void play() }}>{playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}</button><button type="button" aria-label={t('Durdur')} title={t('Durdur')} onClick={() => { audioRef.current?.pause(); seek(0) }}><Square size={14} fill="currentColor" /></button><label className="we-position">{t('İmleç (s)', 'Cursor (s)')}<input type="number" min="0" max={duration} step="any" aria-label={t('Oynatma konumu', 'Playback position')} value={Number(cursor.toFixed(6))} onChange={e => { const n = Math.min(duration, Math.max(0, Number(e.target.value))); seek(n); if (n < viewStart || n > viewEnd) setView(clampView(n - span / 2, span, duration, minSpan)) }} /></label></div><div className="we-listening"><button type="button" disabled={disabled || !hasSelection} onClick={() => void play(true)}>{t('Seçimi dinle')}</button><button type="button" className={loop ? 'active' : ''} aria-label={t('Seçimi döngüye al')} aria-pressed={loop} disabled={!hasSelection} onClick={() => { setLoop(!loop); rangePlayback.current = !loop && hasSelection }}><Repeat2 size={17} /></button><select aria-label={t('Oynatma hızı')} value={speed} onChange={e => setSpeed(Number(e.target.value))}>{[.5, .75, 1, 1.25, 1.5, 2].map(value => <option value={value} key={value}>{value}×</option>)}</select><Volume2 size={15} /><input aria-label={t('Dinleme ses seviyesi')} type="range" min="0" max="1" step="0.01" value={volume} onChange={e => setVolume(Number(e.target.value))} /></div></div>
    <audio ref={audioRef} src={url || undefined} preload="metadata" onLoadedMetadata={e => { e.currentTarget.currentTime = Math.min(playbackPosition.current, duration) }} onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => { setPlaying(false); playbackPosition.current = duration; setCursor(duration) }} />
    {error && <div className="studio-error" role="alert">{t(error)}</div>}
  </section>
}
