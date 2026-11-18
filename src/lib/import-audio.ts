import { AudioError, MAX_FILE_BYTES, SAMPLE_RATE } from './audio'
import { packAudio, type EditorAudio } from './editor'

/** MP3 is decoded locally, then downmixed into the same 48 kHz working format. */
export async function importMp3(file: File): Promise<EditorAudio> {
  if (file.size > MAX_FILE_BYTES) throw new AudioError('Dosya en fazla 50 MB olabilir.')
  const context = new OfflineAudioContext(1, 1, SAMPLE_RATE)
  let audio: AudioBuffer
  try { audio = await context.decodeAudioData(await file.arrayBuffer()) }
  catch { throw new AudioError('MP3 dosyası okunamadı. Geçerli bir MP3 veya WAV seç.') }
  if (audio.duration > 600) throw new AudioError('En fazla 10 dakikalık bir ses dosyası kullan.')
  if (!audio.length || audio.numberOfChannels > 2) throw new AudioError('Mono veya stereo MP3 kullan.')
  const samples = new Float32Array(audio.length)
  for (let channel = 0; channel < audio.numberOfChannels; channel++) {
    const values = audio.getChannelData(channel)
    for (let i = 0; i < samples.length; i++) samples[i] += values[i] / audio.numberOfChannels
  }
  // Lossy MP3 reconstruction can exceed full scale. Keep the waveform intact by
  // attenuating the whole signal rather than clipping individual samples.
  let peak = 1
  for (const sample of samples) { if (!Number.isFinite(sample)) throw new AudioError('Ses dosyasında geçersiz örnekler var.'); peak = Math.max(peak, Math.abs(sample)) }
  if (peak > 1) for (let i = 0; i < samples.length; i++) samples[i] /= peak
  return packAudio(samples)
}
