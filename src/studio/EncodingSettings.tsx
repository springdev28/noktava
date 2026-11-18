import { useI18n } from '../lib/i18n'
import { SlidersHorizontal } from 'lucide-react'
import { headerSize, SAMPLE_RATE, BLOCK_SIZE } from '../lib/audio'
import { useStudio } from './StudioContext'
export function EncodingSettings() {
  const { t } = useI18n()

  const { settings, setSettings, asset, busy } = useStudio()
  const duration = asset ? asset.samples.length / SAMPLE_RATE : 0
  return <section className="studio-card encoding-settings"><div className="card-heading"><h2><SlidersHorizontal size={16} />{t("Yerleştirme ayarları")}</h2><span>{t("NKTV v2")}</span></div>
    <div className="setting-field"><label htmlFor="pattern">{t("Kuadratik desen")}</label><select id="pattern" disabled={!!busy} value={settings.pattern} onChange={e => setSettings(s => ({ ...s, pattern: e.target.value as 'adaptive' | 'fixed' }))}><option value="adaptive">{t("Nota ve ritme uyarlanan")}</option><option value="fixed">{t("Sabit desen (q₀)")}</option></select><small>{t("Karşılaştırma için sabit deseni seçebilirsin.")}</small></div>
    <div className="setting-field"><label htmlFor="strength">{t("Yerleştirme gücü ")}<strong>Δ {(settings.step ?? .1).toFixed(2)}</strong></label><input id="strength" type="range" min="0.02" max="0.20" step="any" value={settings.step} disabled={!!busy} onChange={e => setSettings(s => ({ ...s, step: Number(e.target.value) }))} /><div className="range-labels"><span>{t("0.02 / Daha küçük değişim")}</span><span>{t("0.20 / Daha güçlü iz")}</span></div><small>{t("Düşük değerler bozulmaya daha duyarlıdır. Yüksek değerler sesi daha çok değiştirir.")}</small></div>
    <div className="setting-field"><label htmlFor="harmonic">{t("Harmonik bölge")}</label><select id="harmonic" disabled={!!busy} value={settings.harmonic} onChange={e => setSettings(s => ({ ...s, harmonic: Number(e.target.value) }))}>{[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{t(`${n}. harmonik`, `Harmonic ${n}`)}{n === 4 ? t(' / Belgedeki örnek') : ''}</option>)}</select></div>
    <div className="setting-pair"><label>{t("Başlangıç (sn)")}<input aria-label={t("Yerleştirme başlangıcı")} type="number" min="0" max={duration} step="any" value={Number(settings.startSeconds.toFixed(3))} disabled={!!busy} onChange={e => setSettings(s => ({ ...s, startSeconds: Number(e.target.value) }))} /></label><label>{t("Bitiş (sn)")}<input aria-label={t("Yerleştirme bitişi")} type="number" min="0" max={duration} step="any" value={Number((settings.endSeconds ?? duration).toFixed(3))} disabled={!!busy} onChange={e => setSettings(s => ({ ...s, endSeconds: Number(e.target.value) }))} /></label></div>
    <p className="studio-help">{t("İlk ")}{(headerSize(settings) * 8 * BLOCK_SIZE / SAMPLE_RATE).toFixed(2)}{t(" sn başlık için ayrılır. Seçilen aralığın dışındaki mesaj bloklarına yazılmaz. Başlık dosyanın başında kalır.")}</p>
  </section>
}
