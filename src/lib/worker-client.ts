let worker: Worker | undefined
let nextId = 0
const jobs = new Map<number, { resolve: (data: unknown) => void; reject: (error: Error) => void }>()

export function audioTask<T>(operation: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('../workers/audio.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = event => {
      const job = jobs.get(event.data.id)
      if (!job) return
      jobs.delete(event.data.id)
      if (event.data.error) job.reject(new Error(event.data.error))
      else job.resolve(event.data.result)
    }
    worker.onerror = () => {
      for (const job of jobs.values()) job.reject(new Error('Ses işlemi başlatılamadı. Sayfayı yenileyip tekrar dene.'))
      jobs.clear()
      worker?.terminate()
      worker = undefined
    }
  }
  const id = nextId++
  return new Promise<T>((resolve, reject) => {
    jobs.set(id, { resolve: resolve as (value: unknown) => void, reject })
    const transfer = payload.buffer instanceof ArrayBuffer ? [payload.buffer] : []
    worker!.postMessage({ id, operation, ...payload }, transfer)
  })
}
