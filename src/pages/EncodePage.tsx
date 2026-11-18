import { useI18n } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CheckCheck, FileAudio, KeyRound, LockKeyhole, SlidersHorizontal } from 'lucide-react'
import { capacity, SAMPLE_RATE, type Encoded } from '../lib/audio'
import type { AudioStats } from '../lib/editor'
import { audioTask } from '../lib/worker-client'
import { Link } from '../lib/router'
import { useStudio, type Asset } from '../studio/StudioContext'
import { Timeline } from '../studio/Timeline'
import { EncodingSettings } from '../studio/EncodingSettings'
import { NoteEditor } from '../studio/NoteEditor'
import { CopyButton, DownloadButton, ImportButtons, StatusBanner, time, useBlobUrl } from '../studio/shared'

export function EncodePage() {
  const { t } = useI18n()
  const { asset, busy, load, settings, setSettings, message, setMessage, encoded, setEncoded, addLog, setDecoder } = useStudio()
  const [encoding, setEncoding] = useState(false), [error, setError] = useState('')
  const requestVersion = useRef(0)
  useEffect(() => () => { requestVersion.current++ }, [])
  const signature = JSON.stringify(settings), byteCount = new TextEncoder().encode(message).length
  let limit = 0, settingsError = ''
  try { limit = capacity(asset?.samples.length ?? 0, settings) } catch (e) { settingsError = (e as Error).message }
  const validOutput = encoded && encoded.sourceId === asset?.id && encoded.settingsSignature === signature ? encoded : null
  const sourceUrl = useBlobUrl(asset?.blob ?? null)
  useEffect(() => { setError('') }, [asset?.id, signature, message])
  const duration = asset ? asset.samples.length / SAMPLE_RATE : 0
  const selection = { start: Math.min(settings.startSeconds, duration), end: Math.min(settings.endSeconds ?? duration, duration) }
  async function encode(event: React.FormEvent) {
    event.preventDefault()
    if (!asset || encoding) return
    const request = ++requestVersion.current
    setEncoding(true); setError(''); setEncoded(null)
    try {
      const result = await audioTask<Encoded & { samples: Float32Array; stats: AudioStats }>('encrypt', { buffer: await asset.blob.arrayBuffer(), message, settings })
      if (request !== requestVersion.current) return
      const blob = new Blob([result.wav], { type: 'audio/wav' }), name = asset.name.replace(/\.(wav|mp3)$/i, '') + '-noktava.wav'
      const preview: Asset = { id: -Date.now(), name, samples: result.samples, blob, stats: result.stats, sourceRate: SAMPLE_RATE }
      setEncoded({ blob, key: result.key, bytes: result.bytes, name, sourceId: asset.id, settingsSignature: signature, preview })
      addLog(t('Mesaj şifrelendi ve WAV oluşturuldu.', 'Message encrypted and WAV created.'))
    } catch (e) { if (request === requestVersion.current) setError((e as Error).message) }
    finally { if (request === requestVersion.current) setEncoding(false) }
  }
  return <div className="simple-flow"><div className="studio-page-heading"><div><h1>{t('Mesaj şifrele')}</h1><p>{t('Şarkını seç. Mesajını yaz. Notaları ekle.', 'Choose a song. Write a message. Add the notes.')}</p></div><span className="flow-label">{t('GÖNDERİCİ', 'SENDER')}</span></div><StatusBanner />
    <div className="sender-layout"><form noValidate onSubmit={encode} className="sender-form"><fieldset disabled={encoding} className="flow-fields">
      <section className="studio-card flow-step"><div className="step-heading"><span>1</span><div><h2>{t('Şarkı yükle', 'Upload a song')}</h2><p>{t('MP3 veya WAV, en fazla 50 MB ve 10 dakika.', 'MP3 or WAV, up to 50 MB and 10 minutes.')}</p></div></div>
        <div className={`song-upload ${asset ? 'has-file' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!encoding && !busy && e.dataTransfer.files[0]) void load(e.dataTransfer.files[0]) }}>
          <FileAudio size={27} /><div>{asset ? <><strong>{asset.name}</strong><small>{time(duration)} / 48 kHz / {t('Mono çalışma kopyası', 'Mono working copy')}</small></> : <><strong>{t('Şarkını buraya bırak', 'Drop your song here')}</strong><small>{t('Dosya yalnızca tarayıcında işlenir.', 'Your file is processed in your browser.')}</small></>}</div><ImportButtons />
        </div>{sourceUrl && <audio controls src={sourceUrl} preload="metadata" aria-label={t('Kaynak şarkı', 'Source song')} />}
      </section>
      <section className="studio-card flow-step"><div className="step-heading"><span>2</span><div><h2><label htmlFor="encode-message">{t('Mesajını yaz', 'Write your message')}</label></h2><p>{t('Göndermek istediğin metni gir.', 'Enter the text you want to send.')}</p></div></div><textarea id="encode-message" value={message} maxLength={2000} placeholder={t('Merhaba, şifreli mesaj!', 'Hello, secret message!')} onChange={e => { setMessage(e.target.value); setEncoded(null) }} required /><div className="message-capacity"><span>{t('Türkçe harfler ve emojiler daha çok bayt kullanabilir.', 'Accented letters and emoji may use more bytes.')}</span><strong className={asset && byteCount > limit ? 'text-warning' : ''}>{byteCount} / {limit} {t('bayt', 'bytes')}</strong></div></section>
      <section className="flow-step note-step"><div className="step-heading"><span>3</span><div><h2>{t('Nota bilgilerini seç', 'Choose the notes')}</h2><p>{t('MIDI yükle veya nota, oktav ve zamanları elle gir.', 'Import MIDI or enter pitch, octave and timing yourself.')}</p></div></div><NoteEditor disabled={encoding} /></section>
      <details className="advanced-options"><summary><SlidersHorizontal size={16} />{t('Gelişmiş seçenekler', 'Advanced options')}</summary><EncodingSettings />{asset && <Timeline asset={asset} selection={selection} onSelection={range => setSettings(s => ({ ...s, startSeconds: range.start, endSeconds: range.end }))} disabled={encoding || !!busy} />}</details>
      {settingsError && <div className="studio-error" role="alert">{t(settingsError)}</div>}{error && <div className="studio-error" role="alert">{t(error)}</div>}
      {asset && !settingsError && (limit === 0 || byteCount > limit) && <div className="capacity-explanation" role="status">{limit === 0 ? t('Bu nota ve ses seçimi mesaj için yeterli alan sağlamıyor. Daha uzun bir şarkı, daha fazla kullanılabilir nota veya tekrar eden bir nota dizisi seç.', 'This audio and note selection does not have enough capacity. Use a longer song, more usable notes, or a repeating note sequence.') : t('Mesaj kapasiteyi aşıyor. Mesajı kısalt veya daha uzun bir ses kullan.', 'The message exceeds capacity. Shorten it or use a longer recording.')}</div>}
      <div className="flow-submit"><p>{t('Her şifrelemede yeni bir gizli anahtar oluşturulur.', 'A new secret key is generated each time you encrypt.')}</p><button className="studio-button primary" type="submit" disabled={!asset || encoding || !!busy || !message.trim() || byteCount > limit || !!settingsError}><LockKeyhole size={16} />{encoding ? t('Şifreleniyor…') : t('Şifrele', 'Encrypt')}<ArrowRight size={16} /></button></div>
    </fieldset></form><aside className="sender-aside"><div className="studio-card"><h2>{t('Ses düzenleme', 'Audio editing')}</h2><p>{t('Dalga formu, spektrogram, kesme, kopyalama ve ses kontrolleri stüdyoda.', 'Waveform, spectrogram, cut, copy and audio controls are in the studio.')}</p><Link href="/studio" className="studio-button subtle">{t('Ses stüdyosunu aç')}<ArrowRight size={14} /></Link></div><div className="sharing-note"><KeyRound size={19} /><h3>{t('Dosyayı paylaşma', 'Sharing the file')}</h3><p>{t('WAV dosyasını alıcıya gönder. Anahtarı ayrı ve güvenli bir kanaldan paylaş.', 'Send the WAV to your recipient. Share the key through a separate secure channel.')}</p></div></aside></div>
    {validOutput && <section className="studio-card encode-success flow-result" aria-live="polite"><div className="success-heading"><CheckCheck size={23} /><div><h2>{t('WAV dosyan hazır.', 'Your WAV is ready.')}</h2><p>{t('Dosyayı indir ve gizli anahtarını sakla.', 'Download the file and save your secret key.')}</p></div></div><div className="generated-key-heading"><label htmlFor="output-key"><KeyRound size={14} />{t('Gizli anahtar')}</label><CopyButton text={validOutput.key} /></div><textarea id="output-key" className="key-output" readOnly value={validOutput.key} /><p className="studio-help">{t('Anahtarını ayrıca sakla. Dosyayı ve anahtarı ayrı, güvenli kanallardan paylaş.')}</p><div className="success-actions"><DownloadButton blob={validOutput.blob} name={validOutput.name}>{t('Şifreli WAV indir')}</DownloadButton><Link href="/decode" className="studio-button subtle" onClick={() => setDecoder({ file: new File([validOutput.blob], validOutput.name, { type: 'audio/wav' }), key: validOutput.key, keyFormat: 'hex', offset: 0, manual: false, info: null, plaintext: null })}>{t('Çözücüde doğrula')}<ArrowRight size={14} /></Link></div><details className="advanced-options"><summary>{t('Özgün ve şifreli sesi karşılaştır', 'Compare original and encrypted audio')}</summary><Timeline asset={validOutput.preview} compare={asset!.samples} selection={selection} /></details></section>}
  </div>
}
