import { useI18n } from '../lib/i18n'
import { useEffect, useRef, useState } from 'react'
import { CheckCheck, FileAudio, FileSearch, KeyRound, LockKeyhole, Upload, X } from 'lucide-react'
import { MAX_CARRIER_BYTES, SAMPLE_RATE, type CarrierInfo } from '../lib/audio'
import { keyToHex } from '../lib/editor'
import { audioTask } from '../lib/worker-client'
import { useStudio } from '../studio/StudioContext'
import { CopyButton, DownloadButton, time, useBlobUrl } from '../studio/shared'
import { noteName } from '../studio/NoteEditor'

export function DecodePage() {
  const { t, language } = useI18n()

  const { decoder, setDecoder } = useStudio()
  const { file, key, keyFormat, manual, offset, info, plaintext } = decoder
  const [busy, setBusy] = useState(''), [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const requestVersion = useRef(0)
  useEffect(() => () => { requestVersion.current++ }, [])
  const url = useBlobUrl(file)
  const update = (patch: Partial<typeof decoder>) => { setDecoder(s => ({ ...s, ...patch, info: null, plaintext: null })); setError('') }
  async function inspect(decrypt: boolean) {
    if (!file) return
    const request = ++requestVersion.current
    setBusy(decrypt ? 'Şifre çözülüyor ve doğrulanıyor…' : 'Dosya inceleniyor…'); setError('')
    setDecoder(s => ({ ...s, plaintext: null, info: null }))
    const options = { headerOffsetSamples: manual ? offset : 0 }
    try {
      const data = await audioTask<CarrierInfo>('carrier', { buffer: await file.arrayBuffer(), options })
      if (request !== requestVersion.current) return
      setDecoder(s => ({ ...s, info: data }))
      if (decrypt) {
        const result = await audioTask<string>('decrypt', { buffer: await file.arrayBuffer(), key: keyToHex(key, keyFormat), options })
        if (request !== requestVersion.current) return
        setDecoder(s => ({ ...s, plaintext: result }))
      }
    } catch (e) { if (request === requestVersion.current) setError((e as Error).message) }
    finally { if (request === requestVersion.current) setBusy('') }
  }
  function choose(next: File) {
    if (next.size > MAX_CARRIER_BYTES) { setError('WAV dosyası 60 MB sınırını aşıyor.'); return }
    update({ file: next })
  }
  return <div className="simple-flow receiver-flow"><div className="studio-page-heading"><div><h1>{t("Mesaj çöz")}</h1><p>{t("WAV dosyasını yükle, gizli anahtarı gir ve mesajı aç.", "Upload the WAV, enter the secret key and open the message.")}</p></div><span className="flow-label">{t("ALICI", "RECIPIENT")}</span></div>
    <div className="receiver-layout"><div className="decode-main"><section className="studio-card decode-source"><div className="card-heading"><h2><span className="step-number">1</span>{t("Şifreli WAV dosyası")}</h2></div><input ref={inputRef} type="file" className="visually-hidden" aria-label={t("Şifreli WAV dosyasını seç")} accept=".wav,audio/wav" disabled={!!busy} onChange={e => { if (e.target.files?.[0]) choose(e.target.files[0]); e.target.value = '' }} />
      {!file ? <div className="decode-drop" onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!busy && e.dataTransfer.files[0]) choose(e.dataTransfer.files[0]) }}><button onClick={() => inputRef.current?.click()} disabled={!!busy}><Upload size={30} /><strong>{t("Şifreli sesi buraya bırak")}</strong><span>{t("veya dosyalarından seç / WAV / en fazla 60 MB", "or choose a file / WAV / up to 60 MB")}</span></button></div> : <><div className="decode-file"><span><FileAudio size={25} /></span><div><strong>{file.name}</strong><small>{(file.size / 1024 / 1024).toFixed(2)}{t(" MB / Özgün dosya olduğu gibi okunur")}</small></div><button className="studio-icon-button" aria-label={t("Çözücü dosyasını kaldır")} disabled={!!busy} onClick={() => update({ file: null })}><X size={17} /></button></div>{url && <audio controls src={url} preload="metadata" aria-label={t("Şifreli ses önizlemesi")} />}</>}
    </section><section className="studio-card decode-key"><div className="card-heading"><h2><span className="step-number">2</span>{t("Gizli anahtar")}</h2><select aria-label={t("Anahtar giriş biçimi")} value={keyFormat} disabled={!!busy} onChange={e => update({ keyFormat: e.target.value as 'hex' | 'base64' })}><option value="hex">{t("Hex / 64 karakter")}</option><option value="base64">{t("Base64 / 32 bayt")}</option></select></div><label htmlFor="decode-key" className="visually-hidden">{t("Gizli çözme anahtarı")}</label><textarea id="decode-key" spellCheck={false} autoComplete="off" value={key} disabled={!!busy} onChange={e => update({ key: e.target.value })} placeholder={keyFormat === 'hex' ? t('64 karakterlik hex anahtarını yapıştır…') : t('Base64 biçimindeki anahtarını yapıştır…')} /><p className="studio-help">{t("Göndericinin ayrı paylaştığı anahtarı yapıştır. MIDI dosyasına ihtiyacın yok.", "Paste the key shared separately by the sender. You do not need a MIDI file.")}</p><div className="decode-actions"><button className="studio-button primary" disabled={!file || !key.trim() || !!busy} onClick={() => void inspect(true)}><LockKeyhole size={15} />{t("Deşifre et", "Decrypt")}</button></div></section>
      {busy && <div className="studio-notice" role="status">{t(busy)}</div>}{error && <div className="studio-error" role="alert">{t(error)}</div>}
      {plaintext !== null && <section className="studio-card decode-result" aria-live="polite"><div className="success-heading"><CheckCheck size={23} /><div><h2>{t("Mesaj doğrulandı.")}</h2></div></div><div className="decoded-message">{plaintext}</div><div className="success-actions"><CopyButton text={plaintext} label="Mesajı kopyala" /><DownloadButton blob={new Blob([plaintext], { type: 'text/plain;charset=utf-8' })} name="noktava-mesaj.txt">{t("Metni indir")}</DownloadButton></div></section>}
      {info && <details className="advanced-options"><summary>{t("Dosya bilgisi", "File information")}</summary><section className="studio-card header-details"><div className="card-heading"><h2><FileSearch size={16} />{t("Dosya bilgisi", "File information")}</h2><span className={plaintext !== null ? 'text-accent' : 'text-warning'}>{plaintext !== null ? t('DOĞRULANDI') : t('HENÜZ DOĞRULANMADI')}</span></div><dl className="header-grid"><div><dt>{t("Dosya sürümü")}</dt><dd>v{info.version}</dd></div><div><dt>{t("Mesaj verisi", "Message data")}</dt><dd>{info.ciphertextBytes}{t(" bayt")}</dd></div><div><dt>{t("Dosya bilgisi boyutu", "File information size")}</dt><dd>{info.headerBytes}{t(" bayt")}</dd></div><div><dt>{t("Tempo")}</dt><dd>{info.bpm}{t("BPM")}</dd></div><div><dt>{t("Yerleştirme gücü")}</dt><dd>Δ {info.step.toFixed(2)}</dd></div><div><dt>{t("Frekans bölgesi")}</dt><dd>{t(`${info.harmonic}. harmonik`, `Harmonic ${info.harmonic}`)}</dd></div><div><dt>{t("Desen")}</dt><dd>{info.pattern === 'adaptive' ? t('Nota tabanlı') : t('Sabit', 'Fixed')}</dd></div><div><dt>{t("Mesaj bölgesi")}</dt><dd>{time(info.startSeconds, true)} – {time(info.endSeconds, true)}</dd></div></dl><div className="decoded-notes">{info.notes.slice(0, 128).map((note, i) => <span key={i}>{noteName(note.midi, language)} <small>×{note.duration}</small></span>)}</div><details className="hex-details"><summary>{t("Ham veriyi göster", "Show raw data")}</summary><label>{t("Dosya bilgisi / Hex", "File information / Hex")}<textarea readOnly value={info.headerHex.match(/.{1,2}/g)?.join(' ')} /></label><label>{t("Şifreli veri / HEX")}<textarea readOnly value={info.ciphertextHex.match(/.{1,2}/g)?.join(' ')} /></label></details></section></details>}
    <details className="advanced-options"><summary><FileSearch size={16} />{t("Gelişmiş çözme seçenekleri", "Advanced decoding options")}</summary><button className="studio-button subtle" disabled={!file || !!busy} onClick={() => void inspect(false)}><FileSearch size={16} />{t("Dosyayı incele", "Inspect file")}</button><div className="decode-inspector"><section className="studio-card"><div className="card-heading"><h2>{t("Çözme seçenekleri")}</h2><span>{t("GELİŞMİŞ")}</span></div><fieldset className="decode-modes"><legend>{t("Okuma konumu", "Read position")}</legend><label><input type="radio" name="alignment" checked={!manual} disabled={!!busy} onChange={() => update({ manual: false })} /><span>{t("Dosya başından oku")}<small>{t("Standart Noktava çıktıları için.")}</small></span></label><label><input type="radio" name="alignment" checked={manual} disabled={!!busy} onChange={() => update({ manual: true })} /><span>{t("Elle hizala")}<small>{t("Önüne örnek eklenmiş kayıtlarda konumu belirt.")}</small></span></label></fieldset>
      <div className="setting-field"><label htmlFor="header-offset">{t("Başlangıç örneği")}</label><input id="header-offset" type="number" min="0" max="2880000" step="1" value={offset} disabled={!manual || !!busy} onChange={e => update({ offset: Number(e.target.value) })} /><small>{(offset / SAMPLE_RATE).toFixed(6)}{t(" saniye / 48 kHz")}</small></div></section></div></details></div><aside className="receiver-note"><KeyRound size={23} /><h2>{t("Gerekli dosya ve anahtar", "Required file and key")}</h2><p>{t("Göndericiden WAV dosyasını ve gizli anahtarı al. Anahtarın tamamını, eksik karakter bırakmadan yapıştır.", "Use the WAV and secret key from the sender. Paste the entire key without leaving out any characters.")}</p><p>{t("Dosyayı MP3’e dönüştürme veya düzenleme. Özgün WAV dosyasını kullan.", "Use the original WAV. Converting it to MP3 or editing it can remove the message.")}</p></aside></div>
  </div>
}
