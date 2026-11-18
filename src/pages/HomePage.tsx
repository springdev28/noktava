import { useEffect, useState } from 'react'
import { ArrowRight, ArrowUpRight, ChevronDown, Github, Menu, SlidersHorizontal, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { SoundSculpture } from '../components/SoundSculpture'
import { useI18n } from '../lib/i18n'
import { Link } from '../lib/router'
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
    <Link href="/" aria-label={t('noktava. ana sayfa', 'noktava. home')} className="brand-link"><Brand /></Link>
    <nav id="home-navigation" className={open ? 'is-open' : ''} aria-label={t('Ana menü', 'Main navigation')}>
      <Link href="/encode" onClick={() => setOpen(false)}>{t('Mesaj şifrele')}</Link>
      <Link href="/decode" onClick={() => setOpen(false)}>{t('Mesaj çöz')}</Link>
      <Link href="/guide" onClick={() => setOpen(false)}>{t('Kılavuz', 'Guide')}</Link>
      <details className="home-advanced" onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); e.currentTarget.open = false; e.currentTarget.querySelector('summary')?.focus() } }}>
        <summary>{t('Gelişmiş', 'Advanced')}<ChevronDown size={13} /></summary>
        <div><Link href="/studio" onClick={() => setOpen(false)}><SlidersHorizontal size={16} /><span>{t('Ses stüdyosu')}<small>{t('İsteğe bağlı ses düzenleme', 'Optional audio editing')}</small></span></Link></div>
      </details>
    </nav>
    <div className="visual-nav-actions"><LanguageSwitch /><button id="home-menu" type="button" aria-label={open ? t('Menüyü kapat', 'Close menu') : t('Menüyü aç', 'Open menu')} aria-expanded={open} aria-controls="home-navigation" onClick={() => setOpen(!open)}>{open ? <X size={22} /> : <Menu size={22} />}</button></div>
  </div></header>
}

export default function HomePage() {
  const { t } = useI18n()
  useEffect(() => { document.title = 'noktava.' }, [])
  return <div className="visual-home">
    <a href="#home-main" className="skip-link">{t('İçeriğe geç', 'Skip to content')}</a><Header />
    <main id="home-main">
      <section className="visual-hero" aria-labelledby="home-title">
        <div className="visual-hero-copy">
          <h1 id="home-title">noktava.</h1>
          <p>{t('Mesajını bir ses dosyasına ekle veya gelen mesajı anahtarla aç.', 'Add your message to an audio file, or open a received message with its key.')}</p>
          <div className="visual-hero-actions"><Link href="/encode" className="studio-button primary">{t('Mesaj şifrele')}<ArrowUpRight size={18} /></Link><Link href="/decode" className="studio-button subtle">{t('Mesaj çöz')}<ArrowRight size={16} /></Link></div>
        </div>
        <div className="visual-art" aria-hidden="true"><div className="visual-orbit" /><div className="visual-orbit outer" /><SoundSculpture /></div>
        <div className="visual-hero-bottom"><span>MP3 / WAV / MIDI</span><Link href="/guide">{t('Kullanım kılavuzu')}<ArrowRight size={15} /></Link></div>
      </section>
    </main>
    <footer className="visual-footer"><Brand /><span>© {new Date().getFullYear()} noktava.</span><a href="https://github.com/springdev28/noktava" target="_blank" rel="noreferrer"><Github size={16} />GitHub<ArrowUpRight size={14} /></a></footer>
  </div>
}
