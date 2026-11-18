import { ArrowRight, AudioLines, FileAudio, LockKeyhole, UnlockKeyhole } from 'lucide-react'
import { Link } from '../lib/router'
import { useI18n } from '../lib/i18n'
import { SAMPLE_RATE } from '../lib/audio'
import { useStudio } from '../studio/StudioContext'
import { ImportButtons, StatusBanner, time } from '../studio/shared'
import './HomePage.css'

export default function HomePage() {
  const { t } = useI18n()
  const { asset } = useStudio()
  const tools = [
    { href: '/studio', icon: AudioLines, title: t('Ses stüdyosu'), description: t('Sesi dinle, bir bölge seç ve düzenle.', 'Listen, select a region and edit the audio.'), format: 'MP3 / WAV' },
    { href: '/encode', icon: LockKeyhole, title: t('Mesaj şifrele'), description: t('Ses dosyanı, mesajını ve notalarını ekle.', 'Add your audio, message and notes.'), format: t('Ses + metin', 'Audio + text') },
    { href: '/decode', icon: UnlockKeyhole, title: t('Mesaj çöz'), description: t('Gelen WAV dosyasını ve anahtarı kullan.', 'Open a received WAV with its key.'), format: t('WAV + anahtar', 'WAV + key') },
  ]
  return <div className="tool-home">
    <div className="studio-page-heading"><div><h1>Noktava</h1><p>{t('Bir ses dosyası aç veya aşağıdan bir araç seç.', 'Open an audio file or choose a tool below.')}</p></div></div>
    <StatusBanner />
    <section className="home-file" aria-labelledby="home-file-title">
      <div className="home-file-info"><FileAudio size={23} /><div><h2 id="home-file-title">{asset ? asset.name : t('Ses dosyası', 'Audio file')}</h2><p>{asset ? `${time(asset.samples.length / SAMPLE_RATE)} / WAV` : t('MP3 veya WAV, en fazla 50 MB ve 10 dakika.', 'MP3 or WAV, up to 50 MB and 10 minutes.')}</p></div></div>
      <ImportButtons />
    </section>
    <nav className="home-tools" aria-label={t('Araçlar', 'Tools')}>
      {tools.map(({ href, icon: Icon, title, description, format }) => <Link href={href} key={href} className="home-tool">
        <span className="home-tool-icon"><Icon size={24} strokeWidth={1.5} /></span>
        <span className="home-tool-copy"><strong>{title}</strong><span>{description}</span></span>
        <span className="home-tool-format">{format}</span><ArrowRight size={18} />
      </Link>)}
    </nav>
  </div>
}
