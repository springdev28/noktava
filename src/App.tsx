import { useEffect } from 'react'
import { I18nProvider, useI18n } from './lib/i18n'
import { Router, Link, useRouter } from './lib/router'
import { StudioProvider } from './studio/StudioContext'
import { AppShell } from './studio/AppShell'
import HomePage from './pages/HomePage'
import { StudioPage } from './pages/StudioPage'
import { EncodePage } from './pages/EncodePage'
import { DecodePage } from './pages/DecodePage'
import { GuidePage } from './pages/GuidePage'
import './studio/studio.css'
import './brand.css'
function Pages() {
  const { t } = useI18n()
  const { path } = useRouter()
  useEffect(() => { if (path === '/') document.title = t('Noktava | Sese başka bir anlam kat', 'Noktava | Give sound a second meaning') }, [path, t])
  if (path === '/') return <HomePage />
  return <AppShell>{path === '/studio' ? <StudioPage /> : path === '/encode' ? <EncodePage /> : path === '/decode' ? <DecodePage /> : path === '/guide' ? <GuidePage /> : <div className="studio-empty"><h1>{t('Bu sayfa bulunamadı.')}</h1><Link href="/studio" className="studio-button primary">{t('Stüdyoya dön')}</Link></div>}</AppShell>
}
export default function App() { return <I18nProvider><Router><StudioProvider><Pages /></StudioProvider></Router></I18nProvider> }
