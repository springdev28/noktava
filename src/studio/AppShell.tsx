import { LanguageSwitch } from '../components/LanguageSwitch'
import { useI18n } from '../lib/i18n'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, AudioLines, BookOpen, ChevronDown, ChevronRight, Home, LockKeyhole, Menu, UnlockKeyhole, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { Link, useRouter } from '../lib/router'
import { useStudio } from './StudioContext'

const links = [
  { href: '/', label: 'Ana sayfa', icon: Home },
  { href: '/encode', label: 'Mesaj şifrele', icon: LockKeyhole },
  { href: '/decode', label: 'Mesaj çöz', icon: UnlockKeyhole },
]

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const { path } = useRouter(), { asset } = useStudio()
  const [open, setOpen] = useState(false)
  const title = t(links.find(link => link.href === path)?.label ?? (path === '/guide' ? 'Kullanım kılavuzu' : path === '/studio' ? 'Ses stüdyosu' : 'Sayfa bulunamadı'))
  useEffect(() => {
    setOpen(false)
    document.title = path === '/' ? 'noktava.' : `${title} | noktava.`
    document.getElementById('studio-main')?.focus({ preventScroll: true })
  }, [path, title])
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); document.getElementById('studio-menu')?.focus() } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  return <div className="app-shell">
    <a className="skip-link" href="#studio-main">{t('Çalışma alanına geç')}</a>
    <aside className={`app-sidebar ${open ? 'is-open' : ''}`} id="app-sidebar">
      <Link href="/" className="app-brand" aria-label={t('noktava. ana sayfa', 'noktava. home')}><Brand /></Link>
      <nav aria-label={t('Uygulama sayfaları')}>{links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={path === href ? 'active' : ''}><Icon size={19} /><span>{t(label)}</span></Link>)}</nav>
      <details className="sidebar-advanced" key={path} open={path === '/studio'}>
        <summary>{t('Gelişmiş', 'Advanced')}<ChevronDown size={13} /></summary>
        <nav aria-label={t('Gelişmiş araçlar', 'Advanced tools')}><Link href="/studio" aria-current={path === '/studio' ? 'page' : undefined} className={path === '/studio' ? 'active' : ''}><AudioLines size={19} /><span>{t('Ses stüdyosu')}</span></Link></nav>
      </details>
      <nav className="sidebar-help" aria-label={t('Yardım', 'Help')}><Link href="/guide" aria-current={path === '/guide' ? 'page' : undefined} className={path === '/guide' ? 'active' : ''}><BookOpen size={18} /><span>{t('Kullanım kılavuzu')}</span></Link></nav>
      <div className="sidebar-bottom"><p>{t('Dosyalar bu oturumda tutulur.', 'Files stay in this session.')}</p></div>
    </aside>
    {open && <button className="sidebar-overlay" aria-label={t('Gezinme menüsünü kapat')} onClick={() => setOpen(false)} />}
    <div className="app-body">
      <header className="app-topbar">
        <button className="studio-mobile-menu studio-icon-button" id="studio-menu" aria-label={open ? t('Uygulama menüsünü kapat') : t('Uygulama menüsünü aç')} aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button>
        <div className="app-breadcrumb"><span>noktava.</span><ChevronRight size={12} /><strong>{title}</strong></div>
        <div className="app-top-status"><span className="status-dot" /><span>{asset ? t('Ses dosyası açık') : t('Ses dosyası seçilmedi')}</span></div>
        <LanguageSwitch /><Link href="/guide" className="app-guide-link">{t('Yardım', 'Help')}<ArrowRight size={12} /></Link>
      </header>
      <main className="studio-main" id="studio-main" tabIndex={-1}>{children}</main>
      <footer className="app-footer"><span>noktava.</span><span>{t('Oturum bellekte tutulur. Çıkmadan önce dosyanı indir.')}</span></footer>
    </div>
  </div>
}
