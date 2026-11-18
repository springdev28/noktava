/// <reference lib="webworker" />
import { encryptAudio, decodeCarrier, inspectWav, inspectCarrier, makeDemo, readWav, type DecodeOptions, type Settings } from '../lib/audio'
import { audioStats, editSamples, loadEditorAudio, packAudio, spectrogram, type EditCommand } from '../lib/editor'

type Request = { id: number; operation: string; buffer: ArrayBuffer; message: string; settings: Settings; key: string; samples: Float32Array; command: EditCommand; start: number; end: number; maxHz: number; options: DecodeOptions }
self.onmessage = async (event: MessageEvent<Request>) => {
  const { id, operation, buffer, message, settings, key } = event.data
  try {
    if (operation === 'inspect') self.postMessage({ id, result: inspectWav(buffer) })
    else if (operation === 'load' || operation === 'editor-demo' || operation === 'edit') {
      const result = operation === 'edit' ? packAudio(editSamples(event.data.samples, event.data.command)) : loadEditorAudio(operation === 'editor-demo' ? makeDemo(90, true) : buffer)
      self.postMessage({ id, result }, [result.samples.buffer, result.wav])
    } else if (operation === 'spectrum') {
      const result = spectrogram(event.data.samples, event.data.start, event.data.end, event.data.maxHz)
      self.postMessage({ id, result }, [result.values.buffer])
    } else if (operation === 'carrier') self.postMessage({ id, result: inspectCarrier(buffer, event.data.options) })
    else if (operation === 'demo') {
      const wav = makeDemo()
      self.postMessage({ id, result: { wav, inspection: inspectWav(wav) } }, [wav])
    } else if (operation === 'encrypt') {
      const result = await encryptAudio(buffer, message, settings)
      const samples = readWav(result.wav).samples
      self.postMessage({ id, result: { ...result, samples, stats: audioStats(samples) } }, [result.wav, samples.buffer])
    } else if (operation === 'decrypt') self.postMessage({ id, result: await decodeCarrier(buffer, key, event.data.options) })
    else throw new Error('Bilinmeyen işlem.')
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'İşlem tamamlanamadı. Lütfen yeniden dene.' })
  }
}
