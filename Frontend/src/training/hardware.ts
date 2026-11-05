import * as tf from '@tensorflow/tfjs'
import { buildModel } from './model'
import { inputShapes, type Hardware, type InputKind, type TrainingConfig } from './types'

export const backendLabels: Record<string, string> = { webgl: 'WebGL (usa la GPU)', webgpu: 'WebGPU (usa la GPU)', wasm: 'WebAssembly (CPU)', cpu: 'CPU' }
export const usesGpu = (hardware: Pick<Hardware, 'backend'>) => hardware.backend === 'webgl' || hardware.backend === 'webgpu'

/** Datos del equipo que el navegador informa. GPU y memoria pueden no estar disponibles. */
export async function detectHardware(): Promise<Hardware> {
  await tf.ready()
  let gpu: string | null = null
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null
    if (gl) {
      const info = gl.getExtension('WEBGL_debug_renderer_info')
      const name = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
      gpu = typeof name === 'string' && name ? name.slice(0, 200) : null
    }
  } catch { /* El navegador puede ocultar la GPU. */ }
  const nav = typeof navigator === 'undefined' ? undefined : navigator as Navigator & { deviceMemory?: number }
  return {
    backend: tf.getBackend(), gpu,
    cores: nav?.hardwareConcurrency || null,
    memory_gb: typeof nav?.deviceMemory === 'number' ? nav.deviceMemory : null,
    epoch_estimate_ms: null
  }
}

/** Valores recomendados según el equipo. Con CPU se recomienda una CNN pequeña y menos épocas. */
export function recommendedConfig(hardware: Pick<Hardware, 'backend'>): TrainingConfig {
  return usesGpu(hardware)
    ? { epochs: 12, learning_rate: 0.001, batch_size: 16, model_size: 'medium' }
    : { epochs: 8, learning_rate: 0.001, batch_size: 16, model_size: 'small' }
}

/** Mide unos lotes con datos aleatorios y estima el tiempo de una época. */
export async function estimateEpochMs(kind: InputKind, classes: number, config: TrainingConfig, trainCount: number) {
  const [h, w, c] = inputShapes[kind], batch = Math.max(1, Math.min(config.batch_size, trainCount))
  const model = buildModel(kind, classes, config)
  const xs = tf.randomUniform([batch, h, w, c])
  const ys = tf.tidy(() => tf.oneHot(tf.randomUniform([batch], 0, classes, 'int32') as tf.Tensor1D, classes))
  try {
    await model.trainOnBatch(xs, ys)
    const start = performance.now()
    for (let i = 0; i < 2; i++) await model.trainOnBatch(xs, ys)
    return Math.round((performance.now() - start) / 2 * Math.ceil(trainCount / batch))
  } finally { xs.dispose(); ys.dispose(); model.dispose() }
}

export function formatDuration(ms: number) {
  if (ms < 1000) return 'menos de 1 s'
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds} s`
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, '0')} s`
}
