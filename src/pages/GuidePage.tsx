import { useI18n } from '../lib/i18n'
import { ArrowRight, AudioLines, BookOpen, Command, FileAudio, LockKeyhole, UnlockKeyhole } from 'lucide-react'
import { Link } from '../lib/router'

export function GuidePage() {
  const { t } = useI18n()
  return <>
    <div className="studio-page-heading"><div><h1>{t('Kullanım kılavuzu')}</h1><p>{t('Mesaj şifreleme ve gelen mesajı açma.', 'Encrypting a message and opening a received message.')}</p></div><BookOpen size={28} strokeWidth={1.5} /></div>
    <div className="guide-grid">
      <nav className="studio-card guide-toc" aria-label={t('Kılavuz bölümleri')}>
        <a href="#guide-encoding">{t('Mesaj şifrele')}</a><a href="#guide-decoding">{t('Mesaj çöz')}</a><a href="#guide-files">{t('Dosyalar', 'Files')}</a><a href="#guide-editor">{t('Ses stüdyosu')} <small>({t('İsteğe bağlı', 'Optional')})</small></a><a href="#guide-shortcuts">{t('Klavye kısayolları', 'Keyboard shortcuts')}</a>
      </nav>
      <div className="guide-content">
        <section className="studio-card" id="guide-encoding"><LockKeyhole size={23} /><h2>{t('Mesaj şifrele')}</h2>
          <ol className="guide-steps">
            <li>{t('MP3 veya WAV dosyanı aç.', 'Open your MP3 or WAV.')}</li>
            <li>{t('Mesajını yaz. Gösterilen uzunluk sınırını aşma.', 'Write your message within the displayed limit.')}</li>
            <li>{t('Bir MIDI dosyası yükle veya notaları elle gir. MIDI birden fazla iz içeriyorsa kullanacağın izi seç.', 'Import a MIDI file or enter the notes. If the MIDI has several tracks, choose the one to use.')}</li>
            <li>{t('Şifrele düğmesine bas. Mesaj dosyaya otomatik olarak eklenir.', 'Press Encrypt. The message is added to the file automatically.')}</li>
            <li>{t('WAV dosyasını indir ve gizli anahtarı kaydet. Dosyayı alıcıya gönder; anahtarı ayrı ve güvenli bir kanaldan paylaş.', 'Download the WAV and save the secret key. Send the file to your recipient and share the key through a separate secure channel.')}</li>
          </ol>
          <p>{t('Notaların başlangıç ve sürelerini tabloda değiştirebilirsin. Sesi kestikten sonra bu zamanları tekrar kontrol et.', 'You can change note start times and durations in the table. Check those times again after cutting the audio.')}</p>
          <Link href="/encode" className="text-link">{t('Mesaj şifrele')}<ArrowRight size={14} /></Link>
        </section>
        <section className="studio-card" id="guide-decoding"><UnlockKeyhole size={23} /><h2>{t('Mesaj çöz')}</h2>
          <ol className="guide-steps">
            <li>{t('Göndericiden gelen WAV dosyasını aç.', 'Open the WAV received from the sender.')}</li>
            <li>{t('Paylaşılan gizli anahtarı yapıştır.', 'Paste the shared secret key.')}</li>
            <li>{t('Deşifre et düğmesine bas. Açılan mesajı kopyalayabilir veya metin dosyası olarak indirebilirsin.', 'Press Decrypt. Copy the opened message or download it as a text file.')}</li>
          </ol>
          <p>{t('MIDI dosyası gerekmez. Dosya açılamıyorsa anahtarı kontrol et ve göndericiden gelen özgün WAV dosyasını kullan.', 'No MIDI file is needed. If the message cannot be opened, check the key and use the original WAV from the sender.')}</p>
          <Link href="/decode" className="text-link">{t('Mesaj çöz')}<ArrowRight size={14} /></Link>
        </section>
        <section className="studio-card" id="guide-files"><FileAudio size={23} /><h2>{t('Dosyalar', 'Files')}</h2>
          <dl className="guide-definitions">
            <div><dt>{t('Ses dosyası', 'Audio file')}</dt><dd>{t('MP3 veya WAV, en fazla 50 MB ve 10 dakika.', 'MP3 or WAV, up to 50 MB and 10 minutes.')}</dd></div>
            <div><dt>{t('Gelen mesaj', 'Received message')}</dt><dd>{t('WAV, en fazla 60 MB.', 'WAV, up to 60 MB.')}</dd></div>
            <div><dt>MIDI</dt><dd>{t('.mid veya .midi, en fazla 1 MB.', '.mid or .midi, up to 1 MB.')}</dd></div>
          </dl>
          <p>{t('Sayfayı yenilemeden veya kapatmadan önce dosyanı ve anahtarını kaydet. Şifrelenmiş WAV dosyasını düzenlemeden ve MP3’e dönüştürmeden paylaş.', 'Save your file and key before reloading or closing the page. Share the encrypted WAV without editing it or converting it to MP3.')}</p>
        </section>
        <section className="studio-card" id="guide-editor"><AudioLines size={23} /><h2>{t('Ses stüdyosu')}</h2><p>{t('İsteğe bağlıdır. Mesaj şifrelemek için sesi elle düzenlemen gerekmez.', 'Optional. You do not need to edit the audio manually to encrypt a message.')}</p>
          <ol className="guide-steps">
            <li>{t('Ses dosyası aç düğmesiyle bir MP3 veya WAV seç.', 'Choose an MP3 or WAV with Open audio.')}</li>
            <li>{t('Üstteki küçük dalgada gezin. 10 s, 1 s ve 10 ms düğmeleriyle yakınlaş.', 'Move through the recording in the small overview. Use 10 s, 1 s and 10 ms to zoom.')}</li>
            <li>{t('Büyük dalgada sürükleyerek bir bölge seç. Turuncu tutamaçlarla başlangıcı ve bitişi ayarla.', 'Drag across the main waveform to select a region. Move the orange handles to adjust its start and end.')}</li>
            <li>{t('Kes, kopyala veya kırp. Örnekleri çiz ile dalgayı elle değiştirebilirsin. Geri al, son düzenlemeyi geri getirir.', 'Cut, copy or trim. Use Draw samples to edit the waveform by hand. Undo restores the previous edit.')}</li>
            <li>{t('Bitirdiğinde WAV dışa aktar düğmesiyle dosyanı kaydet.', 'When finished, save your file with Export WAV.')}</li>
          </ol>
          <p>{t('Dalga formunda yatay eksen zaman, dikey eksen ses seviyesidir. Spektrogramdaki parlak alanlar daha güçlü frekansları gösterir. Dikey ölçek, oynatma hızı ve dinleme ses seviyesi yalnızca önizlemeyi etkiler.', 'In the waveform, time runs horizontally and audio level vertically. Brighter areas in the spectrogram show stronger frequencies. Vertical scale, playback speed and listening volume affect only the preview.')}</p>
          <Link href="/studio" className="text-link">{t('Ses stüdyosunu aç')}<ArrowRight size={14} /></Link>
        </section>
        <section className="studio-card" id="guide-shortcuts"><Command size={23} /><h2>{t('Klavye kısayolları', 'Keyboard shortcuts')}</h2>
          <dl className="shortcut-list">
            <div><dt>{t('Zaman çizelgesinde oynat / duraklat')}</dt><dd><kbd>{t('Boşluk')}</kbd></dd></div>
            <div><dt>{t('İmleci hareket ettir', 'Move the cursor')}</dt><dd><kbd>←</kbd><kbd>→</kbd></dd></div>
            <div><dt>{t('Yakınlaştır / uzaklaştır', 'Zoom in / out')}</dt><dd><kbd>+</kbd><kbd>-</kbd></dd></div>
            <div><dt>{t('Kopyala / kes / yapıştır', 'Copy / cut / paste')}</dt><dd><kbd>Ctrl / ⌘</kbd><kbd>C / X / V</kbd></dd></div>
            <div><dt>{t('Tümünü seç')}</dt><dd><kbd>Ctrl / ⌘</kbd><kbd>A</kbd></dd></div>
            <div><dt>{t('Geri al')}</dt><dd><kbd>Ctrl / ⌘</kbd><kbd>Z</kbd></dd></div>
            <div><dt>{t('Yinele')}</dt><dd><kbd>Ctrl / ⌘</kbd><kbd>Shift</kbd><kbd>Z</kbd></dd></div>
          </dl>
        </section>
      </div>
    </div>
  </>
}
