import { useI18n } from '../lib/i18n'

export function LanguageSwitch() {
  const { language, setLanguage } = useI18n()
  return <div className="language-switch" role="group" aria-label={language === 'tr' ? 'Dil seçimi' : 'Language'}>
    <button type="button" lang="tr" aria-label="Türkçe" aria-pressed={language === 'tr'} onClick={() => setLanguage('tr')}>TR</button>
    <button type="button" lang="en" aria-label="English" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>EN</button>
  </div>
}
