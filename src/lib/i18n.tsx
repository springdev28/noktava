import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { english } from './translations'

export type Language = 'tr' | 'en'
const storageKey = 'noktava.language'

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(storageKey)
    if (saved === 'tr' || saved === 'en') return saved
  } catch { /* Language selection still works when storage is unavailable. */ }
  return navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en'
}

const patterns: [RegExp, string][] = [
  [/^(\d+)\. nota perdesi$/, 'Note $1 pitch'],
  [/^(\d+)\. nota süresi$/, 'Note $1 duration'],
  [/^(\d+)\. notayı sil$/, 'Remove note $1'],
  [/^(\d+) işlem önce$/, '$1 actions ago'],
  [/^(.+) içe aktarıldı$/, '$1 imported'],
  [/^Bu sesin kapasitesi (\d+) bayt; mesajın (\d+) bayt\. Daha uzun bir ses seç veya mesajını kısalt\.$/, 'This audio holds $1 bytes; your message uses $2. Choose longer audio or shorten the message.'],
]

export function translate(text: string, language: Language, fallback?: string): string {
  if (language === 'tr' || !text) return text
  const key = text.trim()
  let result = fallback ?? english[key]
  if (result === undefined) {
    const pattern = patterns.find(([expression]) => expression.test(key))
    result = pattern ? key.replace(pattern[0], pattern[1]) : key
  }
  return text.slice(0, text.indexOf(key)) + result + text.slice(text.indexOf(key) + key.length)
}

type I18n = { language: Language; setLanguage: (language: Language) => void; t: (text: string, english?: string) => string }
const I18nContext = createContext<I18n | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState<Language>(initialLanguage)
  const setLanguage = useCallback((next: Language) => {
    updateLanguage(next)
    try { localStorage.setItem(storageKey, next) } catch { /* Optional preference storage. */ }
  }, [])
  const t = useCallback((text: string, english?: string) => translate(text, language, english), [language])
  useEffect(() => {
    document.documentElement.lang = language
    document.querySelector('meta[name="description"]')?.setAttribute('content', t(
      'Noktava: ses düzenleme, mesaj şifreleme ve mesaj çözme araçları.',
      'Noktava: tools for editing audio, encrypting messages and decoding messages.',
    ))
  }, [language, t])
  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) throw new Error('I18nProvider is required')
  return context
}
