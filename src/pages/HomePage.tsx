import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUpRight, AudioLines, ChevronDown, FileAudio, Github, KeyRound, LockKeyhole, Menu, Play, ShieldCheck, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { SoundSculpture } from '../components/SoundSculpture'
import { LanguageSwitch } from '../components/LanguageSwitch'
import { Link } from '../lib/router'
import { useI18n } from '../lib/i18n'

const repo = 'https://github.com/springdev28/noktava'

function Header() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); document.getElementById('menu-toggle')?.focus() } }
    if (open) document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open])
  return <header className="site-header"><div className="nav-container">
    <Link href="/" className="brand-link" aria-label={t('Noktava ana sayfa')}><Brand /></Link>
    <nav className={`nav-links ${open ? 'is-open' : ''}`} id="site-nav" aria-label={t('Ana menü', 'Main navigation')}>
      <Link href="/studio" onClick={() => setOpen(false)}>{t('Ses stüdyosu')}</Link>
      <Link href="/encode" onClick={() => setOpen(false)}>{t('Şifrele', 'Encrypt')}</Link>
      <Link href="/decode" onClick={() => setOpen(false)}>{t('Mesaj çöz')}</Link>
      <Link href="/guide" onClick={() => setOpen(false)}>{t('Kılavuz', 'Guide')}</Link>
    </nav>
    <div className="nav-actions"><LanguageSwitch /><Link className="button nav-cta" href="/encode">{t('Mesaj şifrele')}<ArrowUpRight size={16} /></Link>
      <button id="menu-toggle" type="button" className="menu-toggle" aria-label={open ? t('Menüyü kapat', 'Close menu') : t('Menüyü aç', 'Open menu')} aria-expanded={open} aria-controls="site-nav" onClick={() => setOpen(!open)}>{open ? <X size={23} /> : <Menu size={23} />}</button>
    </div>
  </div></header>
}

function WaveBars({ count = 70 }: { count?: number }) {
  return <div className="brand-wave" aria-hidden="true">{Array.from({ length: count }, (_, i) => <i key={i} style={{ height: `${12 + 80 * Math.abs(Math.sin(i * .39) * Math.cos(i * .13))}%` }} />)}</div>
}

function Hero() {
  const { t } = useI18n()
  return <section className="home-hero" aria-labelledby="hero-title">
    <div className="hero-copy">
      <p className="home-kicker"><span />{t('SES STÜDYOSU & MÜZİKAL KRİPTOGRAFİ', 'SOUND STUDIO & MUSICAL CRYPTOGRAPHY')}</p>
      <h1 id="hero-title">{t('Sese başka', 'Give sound')}<br /><em>{t('bir anlam kat.', 'a second meaning.')}</em></h1>
      <p className="hero-intro">{t('Bir melodiyi düzenle. İçine kısa bir mesaj yerleştir. Sesi paylaş, anahtarı ayrı tut.', 'Edit a melody. Tuck a short message inside. Share the sound. Keep the key separate.')}</p>
      <div className="home-hero-actions"><Link href="/encode" className="button button-primary">{t('Mesaj şifrele')}<ArrowUpRight size={19} /></Link><Link href="/decode" className="button button-quiet">{t('Mesaj çöz')}<KeyRound size={17} /></Link></div>
      <p className="hero-local"><ShieldCheck size={15} />{t('Dosyan, mesajın ve anahtarın tarayıcında kalır.', 'Your audio, message and key stay in your browser.')}</p>
    </div>
    <div className="hero-art" aria-hidden="true"><div className="art-ring ring-one" /><div className="art-ring ring-two" /><span className="art-coordinate">N / 01</span><SoundSculpture /><div className="art-caption"><span>{t('Bir ses.', 'One sound.')}</span><strong>{t('İki katman.', 'Two layers.')}</strong><i /></div><span className="art-format">WAV / 48 kHz</span></div>
    <div className="hero-baseline"><span>{t('SESİ DÜZENLE. MESAJI ŞİFRELE.', 'EDIT THE SOUND. ENCRYPT THE MESSAGE.')}</span><a href="#inside">{t('İçeriye bak', 'Take a look inside')}<ArrowDown size={14} /></a></div>
  </section>
}

function StudioPreview() {
  const { t } = useI18n()
  return <section className="home-section studio-feature" id="inside">
    <div className="section-lead"><div><span className="home-kicker">01 / {t('SES', 'SOUND')}</span><h2>{t('Önce sesi şekillendir.', 'Start with the sound.')}</h2></div><p>{t('Dalga formundan tek bir notaya kadar. Kırp, dinle, düzenle ve kendi sesini hazırla.', 'From the waveform down to a single note. Trim, listen, edit and make the sound your own.')}</p></div>
    <Link href="/studio" className="studio-preview" aria-label={t('Ses stüdyosunu aç')}>
      <div className="preview-top"><span><AudioLines size={18} />{t('Ses stüdyosu')}</span><span className="preview-open">{t('Stüdyoyu aç', 'Open studio')}<ArrowUpRight size={16} /></span></div>
      <div className="preview-file"><span><i />noktava-melodi.wav</span><span>48 kHz / MONO</span></div>
      <div className="preview-wave"><WaveBars /><div className="preview-selection"><span>00:18 / 00:36</span></div><div className="preview-playhead" /></div>
      <div className="preview-ticks"><span>00:00</span><span>00:18</span><span>00:36</span><span>00:54</span><span>01:12</span><span>01:30</span></div>
      <div className="preview-bottom"><span className="preview-play"><Play size={15} fill="currentColor" /></span><span>00:18.00 <small>/ 01:30.00</small></span><div className="preview-tools"><span>{t('Kırp', 'Trim')}</span><span>{t('Ters çevir')}</span><span>{t('Yavaş giriş')}</span><span>{t('Spektrogram')}</span></div></div>
    </Link>
    <div className="feature-foot"><span>{t('Dalga düzenleme', 'Waveform editing')}</span><span>{t('Manuel düzenleme')}</span><span>{t('Nota ve ritim', 'Notes and rhythm')}</span><span>{t('WAV dışa aktar')}</span></div>
  </section>
}

function MessageSteps() {
  const { t } = useI18n()
  const steps = [
    { number: '01', icon: FileAudio, title: t('Bir ses seç.', 'Choose a sound.'), description: t('MP3 veya WAV yükle, mesajını yaz. MIDI ekle veya notaları elle gir.', 'Upload an MP3 or WAV and write your message. Import MIDI or enter the notes.') },
    { number: '02', icon: LockKeyhole, title: t('İçine bir şey bırak.', 'Leave something in it.'), description: t('Kısa mesajını yaz. Noktava mesajı şifreler ve nota düzenine göre sese yerleştirir.', 'Write a short message. Noktava encrypts it and embeds it in the audio according to your note sequence.') },
    { number: '03', icon: KeyRound, title: t('Anahtarı ayrı tut.', 'Keep the key separate.'), description: t('WAV dosyasını indir. Mesaj, doğru anahtarla çözülüp doğrulandığında okunabilir.', 'Download the WAV. The message can be read after it is decoded and verified with the correct key.') },
  ]
  return <section className="home-section message-section"><div className="section-lead"><div><span className="home-kicker">02 / {t('MESAJ', 'MESSAGE')}</span><h2>{t('Notaların arasında bir not.', 'A note between the notes.')}</h2></div><Link href="/encode" className="text-link">{t('Mesaj şifrele')}<ArrowUpRight size={17} /></Link></div><div className="message-steps">{steps.map(({number,icon:Icon,title,description})=><article key={number}><div><span>{number}</span><Icon size={25} strokeWidth={1.4} /></div><h3>{title}</h3><p>{description}</p></article>)}</div></section>
}

function Details() {
  const { t } = useI18n()
  const questions = [
    [t('Dosyalarım bir yere yükleniyor mu?', 'Are my files uploaded anywhere?'), t('Hayır. Ses düzenleme, şifreleme ve çözme işlemleri tarayıcında yapılır. Hesap gerekmez. Sayfayı yenilemeden önce dosyanı ve anahtarını kaydet.', 'No. Editing, encryption and decoding happen in your browser. No account is needed. Save your file and key before refreshing.')],
    [t('Ne kadar mesaj saklayabilirim?', 'How much text can I embed?'), t('Kapasite sesin uzunluğuna, tempoya ve nota dizisine bağlıdır. 90 saniyelik örnek melodi yaklaşık 40 UTF-8 bayt taşır. Dosyanı açınca gerçek sınır gösterilir.', 'Capacity depends on audio duration, tempo and the note sequence. The 90-second sample holds around 40 UTF-8 bytes. The app calculates the exact limit for your file.')],
    [t('Hangi dosyalar destekleniyor?', 'Which files are supported?'), t('50 MB ve 10 dakikaya kadar mono veya stereo MP3 ve WAV. Nota bilgisi için .mid dosyaları da desteklenir. Stüdyo 48 kHz mono sesle çalışır ve 16 bit PCM WAV üretir. Şifreli çıktıyı MP3’e çevirmek veya düzenlemek mesajı bozabilir.', 'Mono or stereo MP3 and WAV up to 50 MB and 10 minutes. Import .mid files for note information. The studio works at 48 kHz mono and exports 16-bit PCM WAV. Converting encoded audio to MP3 or editing it can damage the message.')],
    [t('Anahtarımı kaybedersem?', 'What if I lose the key?'), t('Anahtar sunucuda saklanmaz ve kurtarılamaz. Ayrı bir yerde tut. Yanlış anahtar veya değiştirilmiş mesaj verisi doğrulamadan geçemez.', 'The key is never stored on a server and cannot be recovered. Keep it separately. A wrong key or altered message data will fail verification.')],
  ]
  return <section className="home-section home-details"><div className="research-note"><span className="home-kicker">03 / {t('YÖNTEM', 'METHOD')}</span><h2>{t('Müzik. Matematik.', 'Music. Mathematics.')}<br /><span>{t('Biraz merak.', 'A little curiosity.')}</span></h2><p>{t('Noktava, AES-256-GCM şifrelemeyi nota tabanlı DCT-QIM ile bir araya getiren deneysel bir araştırma projesi. Ses değişiklikleri duyulabilir; düzenlemeler mesajı bozabilir.', 'Noktava is an experimental research project combining AES-256-GCM encryption with note-adaptive DCT-QIM. Audio changes can be audible, and edits may damage the message.')}</p><Link href="/guide" className="text-link">{t('Yöntemi ve sınırlarını oku', 'Read about the method and its limits')}<ArrowUpRight size={16} /></Link><div className="method-chips"><span>AES-256-GCM</span><span>DCT-QIM</span><span>MIDI</span></div></div><div className="home-faq"><h3>{t('Birkaç iyi soru.', 'A few good questions.')}</h3>{questions.map(([question,answer])=><details key={question} name="faq"><summary>{question}<ChevronDown size={17} /></summary><p>{answer}</p></details>)}</div></section>
}

function Footer() {
  const { t } = useI18n()
  return <footer className="home-footer"><div className="footer-invitation"><h2>{t('Sıradaki ses senin.', 'The next sound is yours.')}</h2><Link href="/encode" className="button button-primary">{t('Mesaj şifrele')}<ArrowUpRight size={18} /></Link></div><div className="home-footer-bottom"><Link href="/" className="brand-link" aria-label={t('Noktava ana sayfa')}><Brand /></Link><span>© {new Date().getFullYear()} Noktava</span><a href={repo} target="_blank" rel="noreferrer"><Github size={16} />GitHub<ArrowUpRight size={14} /></a></div></footer>
}

export default function HomePage() {
  const { t } = useI18n()
  return <div className="home-v3"><a href="#main" className="skip-link">{t('İçeriğe geç', 'Skip to content')}</a><Header /><main id="main"><Hero /><StudioPreview /><MessageSteps /><Details /></main><Footer /></div>
}
