import { LanguageSwitch } from '../components/LanguageSwitch'
import { useI18n } from '../lib/i18n'
import { useEffect, useState, type ReactNode } from 'react'
import { ArrowUpRight, AudioLines, BookOpen, ChevronRight, Home, LockKeyhole, Menu, ShieldCheck, UnlockKeyhole, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { Link, useRouter } from '../lib/router'
import { useStudio } from './StudioContext'
const links = [
  { href: '/studio', label: 'Ses stüdyosu', icon: AudioLines, caption: 'Düzenle ve incele' },
  { href: '/encode', label: 'Mesaj şifrele', icon: LockKeyhole, caption: 'Şifrele ve yerleştir' },
  { href: '/decode', label: 'Mesaj çöz', icon: UnlockKeyhole, caption: 'Çıkar ve doğrula' },
]
export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n()

  const { path } = useRouter(), { asset } = useStudio()
  const [open, setOpen] = useState(false)
  const title = t(links.find(link => link.href === path)?.label ?? (path === '/guide' ? 'Kullanım kılavuzu' : 'Sayfa bulunamadı'))
  useEffect(() => { setOpen(false); document.title = `${title} | Noktava`; document.getElementById('studio-main')?.focus({ preventScroll: true }) }, [path, title])
  useEffect(() => {
    if (!open) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); document.getElementById('studio-menu')?.focus() } }
    window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close)
  }, [open])
  return <div className="app-shell"><a className="skip-link" href="#studio-main">{t("Çalışma alanına geç")}</a><aside className={`app-sidebar ${open ? 'is-open' : ''}`} id="app-sidebar"><Link href="/" className="app-brand" aria-label={t("Noktava ana sayfa")}><Brand /><small>{t("STUDIO")}</small></Link><span className="sidebar-section-label">{t("ÇALIŞMA ALANI")}</span><nav aria-label={t("Uygulama sayfaları")}>{links.map(({ href, label, icon: Icon, caption }) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={path === href ? 'active' : ''}><Icon size={19} /><span>{t(label)}<small>{t(caption)}</small></span>{path === href && <i />}</Link>)}</nav><span className="sidebar-section-label secondary">{t("KEŞFET")}</span><nav aria-label={t("Diğer sayfalar")}><Link href="/guide" aria-current={path === '/guide' ? 'page' : undefined} className={path === '/guide' ? 'active' : ''}><BookOpen size={18} /><span>{t("Kullanım kılavuzu")}</span></Link><Link href="/"><Home size={18} /><span>{t("Ana sayfa")}</span><ArrowUpRight size={13} /></Link></nav><div className="sidebar-bottom"><ShieldCheck size={20} /><strong>{t("Yerel işlem")}</strong><p>{t("Sesin, mesajın ve anahtarın sunucuya gönderilmez.")}</p><span><i />{t("YEREL OTURUM ")}<b>{t("v0.2")}</b></span></div></aside>
    {open && <button className="sidebar-overlay" aria-label={t("Gezinme menüsünü kapat")} onClick={() => setOpen(false)} />}
    <div className="app-body"><header className="app-topbar"><button className="studio-mobile-menu studio-icon-button" id="studio-menu" aria-label={open ? t('Uygulama menüsünü kapat') : t('Uygulama menüsünü aç')} aria-expanded={open} aria-controls="app-sidebar" onClick={() => setOpen(!open)}>{open ? <X size={20} /> : <Menu size={20} />}</button><div className="app-breadcrumb"><span>{t("Çalışma alanı")}</span><ChevronRight size={12} /><strong>{t(title)}</strong></div><div className="app-top-status"><span className="status-dot" /><span>{asset ? t('Ses dosyası açık') : t('Oturum hazır')}</span></div><LanguageSwitch /><Link href="/guide" className="app-guide-link">{t("Yardım ")}<ArrowUpRight size={12} /></Link></header><main className="studio-main" id="studio-main" tabIndex={-1}>{children}</main><footer className="app-footer"><span>{t("NOKTAVA STUDIO ")}<b>/</b>{t(" v0.2")}</span><span>{t("Oturum bellekte tutulur. Çıkmadan önce dosyanı indir.")}</span></footer></div>
  </div>
}
