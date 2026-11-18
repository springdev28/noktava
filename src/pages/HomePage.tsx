import { useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUpRight, AudioLines, Github, Menu, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { SoundSculpture } from '../components/SoundSculpture'
import { useI18n } from '../lib/i18n'
import { Link } from '../lib/router'
import { SAMPLE_RATE } from '../lib/audio'
import { useStudio } from '../studio/StudioContext'
import { ImportButtons, StatusBanner, time } from '../studio/shared'
import './HomePage.css'

function Header() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!open) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); document.getElementById('home-menu')?.focus() }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  return <header className="visual-header"><div className="visual-nav">
    <Link href="/" aria-label={t('Noktava ana sayfa')} className="brand-link"><Brand /></Link>
    <nav id="home-navigation" className={open ? 'is-open' : ''} aria-label={t('Ana menü', 'Main navigation')}>
      <Link href="/studio" onClick={() => setOpen(false)}>{t('Ses stüdyosu')}</Link>
      <Link href="/encode" onClick={() => setOpen(false)}>{t('Mesaj şifrele')}</Link>
      <Link href="/decode" onClick={() => setOpen(false)}>{t('Mesaj çöz')}</Link>
      <Link href="/guide" onClick={() => setOpen(false)}>{t('Kılavuz', 'Guide')}</Link>
    </nav>
    <div className="visual-nav-actions"><LanguageSwitch /><button id="home-menu" type="button" aria-label={open ? t('Menüyü kapat', 'Close menu') : t('Menüyü aç', 'Open menu')} aria-expanded={open} aria-controls="home-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button></div>
  </div></header>
}

function WavePreview() {
  const { asset } = useStudio()
  const bars = useMemo(() => {
    if (!asset) return Array.from({ length: 128 }, (_, i) => 10 + 80 * Math.abs(Math.sin(i * .19) * Math.cos(i * .07)))
    const stride = asset.samples.length / 128, scale = Math.max(.01, asset.stats.peak)
    return Array.from({ length: 128 }, (_, column) => {
      let peak = 0
      for (let i = Math.floor(column * stride); i < Math.min(asset.samples.length, (column + 1) * stride); i++) peak = Math.max(peak, Math.abs(asset.samples[i]))
      return Math.max(1, peak / scale * 88)
    })
  }, [asset])
  return <div className="visual-wave" aria-hidden="true">{bars.map((height, i) => <i key={i} style={{ height: `${height}%` }} />)}<span className="visual-wave-marker" /></div>
}

export default function HomePage() {
  const { t } = useI18n()
  const { asset } = useStudio()
  useEffect(() => { document.title = 'Noktava' }, [])
  return <div className="visual-home">
    <a href="#home-main" className="skip-link">{t('İçeriğe geç', 'Skip to content')}</a><Header />
    <main id="home-main">
      <section className="visual-hero" aria-labelledby="home-title">
        <div className="visual-hero-copy">
          <h1 id="home-title">noktava</h1>
          <p>{t('Ses düzenle. Mesaj şifrele veya çöz.', 'Edit audio. Encrypt or decode a message.')}</p>
          <div className="visual-hero-actions"><Link href="/studio" className="studio-button primary">{t('Ses stüdyosu')}<ArrowUpRight size={18} /></Link><Link href="/encode">{t('Mesaj şifrele')}<ArrowRight size={15} /></Link><Link href="/decode">{t('Mesaj çöz')}<ArrowRight size={15} /></Link></div>
        </div>
        <div className="visual-art" aria-hidden="true"><div className="visual-orbit" /><div className="visual-orbit outer" /><SoundSculpture /><div className="visual-art-wave">{Array.from({ length: 29 }, (_, i) => <i key={i} style={{ height: `${8 + 30 * Math.abs(Math.sin(i * .47) * Math.cos(i * .21))}px` }} />)}</div></div>
        <div className="visual-hero-bottom"><span>MP3 / WAV / MIDI</span><a href="#home-studio">{t('Ses dosyası aç')}<ArrowDown size={15} /></a></div>
      </section>
      <section id="home-studio" className="visual-studio" aria-labelledby="home-studio-title">
        <div className="visual-section-heading"><h2 id="home-studio-title">{t('Ses stüdyosu')}</h2><ImportButtons /></div>
        <StatusBanner />
        <Link href="/studio" className="visual-preview" aria-label={t('Ses stüdyosunu aç')}>
          <div className="visual-preview-heading"><span><AudioLines size={18} />{asset ? asset.name : t('Dalga formu')}</span><span>{t('Stüdyoda düzenle', 'Edit in studio')}<ArrowUpRight size={17} /></span></div>
          <WavePreview />
          <div className="visual-preview-footer"><span>{asset ? `${time(asset.samples.length / SAMPLE_RATE)} / WAV` : t('Ses dosyası seçilmedi')}</span><span>{t('Kırp, kes, kopyala', 'Trim, cut, copy')}</span></div>
        </Link>
        <p className="visual-file-note">{t('MP3 veya WAV, en fazla 50 MB ve 10 dakika.', 'MP3 or WAV, up to 50 MB and 10 minutes.')}</p>
      </section>
    </main>
    <footer className="visual-footer"><Brand /><span>© {new Date().getFullYear()} Noktava</span><a href="https://github.com/springdev28/noktava" target="_blank" rel="noreferrer"><Github size={16} />GitHub<ArrowUpRight size={14} /></a></footer>
  </div>
}
