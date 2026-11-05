import type JSZip from 'jszip'
import * as tf from '@tensorflow/tfjs'
import { inputShapes, type InputKind } from './types'
import type { DatasetFile } from './split'

/** Sonidos: 1 segundo a 16 kHz (el mismo formato del dataset Speech Commands). */
export const SOUND_RATE = 16000
export const SOUND_SAMPLES = SOUND_RATE

export function datasetFiles(zip: JSZip, labels: string[]): DatasetFile[] {
  return Object.values(zip.files)
    .filter(entry => !entry.dir && !entry.name.startsWith('__MACOSX/') && !entry.name.endsWith('/.DS_Store'))
    .map(entry => ({ label: entry.name.split('/')[0], file: entry.name }))
    .filter(item => labels.includes(item.label))
}

// ---------- Imágenes ----------
function surface(size: number) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('No se pudo procesar una imagen.')
  // Fondo blanco: las zonas transparentes de un PNG no deben quedar negras.
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size)
  return ctx
}
/** Caracteres y dibujos: 28 × 28 en gris, valores 0–1; si el fondo es claro se invierte. */
export async function imageFeatures(blob: Blob, kind: 'gray28' | 'rgb64'): Promise<Float32Array> {
  const bitmap = await createImageBitmap(blob)
  try {
    if (kind === 'gray28') {
      const ctx = surface(28); ctx.drawImage(bitmap, 0, 0, 28, 28)
      const data = ctx.getImageData(0, 0, 28, 28).data, out = new Float32Array(784)
      let mean = 0
      for (let i = 0, j = 0; i < data.length; i += 4, j++) { out[j] = (data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114) / 255; mean += out[j] }
      if (mean / out.length > .5) for (let j = 0; j < out.length; j++) out[j] = 1 - out[j]
      return out
    }
    // Imágenes, gestos y posturas: recorte cuadrado central a 64 × 64 en color.
    const ctx = surface(64), side = Math.min(bitmap.width, bitmap.height)
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 64, 64)
    const data = ctx.getImageData(0, 0, 64, 64).data, out = new Float32Array(64 * 64 * 3)
    for (let i = 0, j = 0; i < data.length; i += 4) { out[j++] = data[i] / 255; out[j++] = data[i + 1] / 255; out[j++] = data[i + 2] / 255 }
    return out
  } finally { bitmap.close() }
}

// ---------- Sonidos ----------
export type DecodedAudio = { samples: Float32Array; rate: number }
/** Decodifica WAV (o una grabación del navegador) a mono y 16 kHz. */
export function audioDecoder() {
  const Offline = window.OfflineAudioContext
  if (!Offline) throw new Error('Tu navegador no permite procesar audio.')
  // Un contexto de 16 kHz convierte la frecuencia de muestreo al decodificar.
  const ctx = new Offline(1, SOUND_SAMPLES, SOUND_RATE)
  return async (bytes: ArrayBuffer): Promise<DecodedAudio> => {
    const buffer = await ctx.decodeAudioData(bytes.slice(0))
    const mono = new Float32Array(buffer.length)
    for (let c = 0; c < buffer.numberOfChannels; c++) { const data = buffer.getChannelData(c); for (let i = 0; i < data.length; i++) mono[i] += data[i] / buffer.numberOfChannels }
    return { samples: mono, rate: buffer.sampleRate }
  }
}
function resample(samples: Float32Array, rate: number) {
  const out = new Float32Array(Math.max(1, Math.round(samples.length * SOUND_RATE / rate))), ratio = rate / SOUND_RATE
  for (let i = 0; i < out.length; i++) { const x = i * ratio, a = Math.floor(x), b = Math.min(a + 1, samples.length - 1); out[i] = samples[a] + (samples[b] - samples[a]) * (x - a) }
  return out
}
/** Elige el segundo con más energía (paso de 10 ms); si el audio es más corto, se completa con silencio. */
export function soundWindow({ samples, rate }: DecodedAudio) {
  const data = rate === SOUND_RATE ? samples : resample(samples, rate), out = new Float32Array(SOUND_SAMPLES)
  let start = 0
  if (data.length <= SOUND_SAMPLES) out.set(data, Math.floor((SOUND_SAMPLES - data.length) / 2))
  else {
    const energy = new Float64Array(data.length + 1)
    for (let i = 0; i < data.length; i++) energy[i + 1] = energy[i] + data[i] * data[i]
    let best = -1
    for (let s = 0; s + SOUND_SAMPLES <= data.length; s += 160) { const e = energy[s + SOUND_SAMPLES] - energy[s]; if (e > best) { best = e; start = s } }
    out.set(data.subarray(start, start + SOUND_SAMPLES))
  }
  let peak = 0
  for (const value of out) peak = Math.max(peak, Math.abs(value))
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] /= peak
  return { window: out, start: start / SOUND_RATE, duration: data.length / SOUND_RATE, source: data }
}
/** Espectrograma (STFT de 512 muestras, paso 256) en escala logarítmica, redimensionado a 64 × 64 y con valores 0–1. */
export function soundFeatures(window: Float32Array): Float32Array {
  return tf.tidy(() => {
    const magnitude = tf.abs(tf.signal.stft(tf.tensor1d(window), 512, 256)) as tf.Tensor2D
    const log = tf.log(tf.add(magnitude, 1e-6)), max = log.max(), floor = tf.sub(max, 8)
    const scaled = tf.div(tf.sub(tf.maximum(log, floor), floor), 8)
    // Filas = frecuencia (agudos arriba), columnas = tiempo.
    const image = tf.image.resizeBilinear(tf.reverse(tf.transpose(scaled), 0).expandDims(-1) as tf.Tensor3D, [64, 64])
    return Float32Array.from(image.dataSync())
  })
}

export async function prepareSample(kind: InputKind, blob: Blob, decode?: (bytes: ArrayBuffer) => Promise<DecodedAudio>) {
  if (kind !== 'spec64') return imageFeatures(blob, kind)
  return soundFeatures(soundWindow(await (decode ?? audioDecoder())(await blob.arrayBuffer())).window)
}

// ---------- Vistas previas ----------
/** Dibuja lo que recibe la CNN: valores 0–1 en gris o color. */
export function featuresToDataUrl(features: Float32Array, kind: InputKind) {
  const [h, w, c] = inputShapes[kind], canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d'); if (!ctx) return ''
  const image = ctx.createImageData(w, h)
  for (let p = 0; p < h * w; p++) for (let k = 0; k < 3; k++) image.data[p * 4 + k] = Math.round(255 * features[p * c + (c === 3 ? k : 0)])
  for (let p = 0; p < h * w; p++) image.data[p * 4 + 3] = 255
  ctx.putImageData(image, 0, 0); return canvas.toDataURL()
}
/** Forma de onda del audio original con el segundo elegido resaltado. */
export function waveformDataUrl(source: Float32Array, start: number) {
  const canvas = document.createElement('canvas'); canvas.width = 240; canvas.height = 64
  const ctx = canvas.getContext('2d'); if (!ctx) return ''
  const seconds = Math.max(source.length / SOUND_RATE, 1)
  ctx.fillStyle = '#f4f4f4'; ctx.fillRect(0, 0, 240, 64)
  ctx.fillStyle = '#d0e2ff'; ctx.fillRect(240 * start / seconds, 0, 240 / seconds, 64)
  ctx.strokeStyle = '#0f62fe'; ctx.beginPath()
  const step = Math.max(1, Math.floor(source.length / 240))
  for (let x = 0; x < 240; x++) {
    let peak = 0
    for (let i = x * step; i < Math.min(source.length, (x + 1) * step); i++) peak = Math.max(peak, Math.abs(source[i]))
    ctx.moveTo(x + .5, 32 - peak * 30); ctx.lineTo(x + .5, 32 + peak * 30)
  }
  ctx.stroke(); return canvas.toDataURL()
}
