import * as tf from '@tensorflow/tfjs'
import { inputShapes, type InputKind, type ModelSize, type TrainingConfig } from './types'

/** Tamaño de la CNN: filtros de las dos capas convolucionales y neuronas de la capa densa. Mediana = la CNN del flujo anterior. */
export const modelSizes: Record<ModelSize, { label: string; filters: [number, number]; dense: number }> = {
  small: { label: 'Pequeña', filters: [4, 8], dense: 16 },
  medium: { label: 'Mediana', filters: [8, 16], dense: 32 },
  large: { label: 'Grande', filters: [16, 32], dense: 64 }
}

export function buildModel(kind: InputKind, classes: number, config: Pick<TrainingConfig, 'model_size' | 'learning_rate'>) {
  const [h, w, c] = inputShapes[kind], size = modelSizes[config.model_size]
  const layers: tf.layers.Layer[] = [
    tf.layers.conv2d({ inputShape: [h, w, c], filters: size.filters[0], kernelSize: 3, activation: 'relu' }),
    tf.layers.maxPooling2d({ poolSize: 2 }),
    tf.layers.conv2d({ filters: size.filters[1], kernelSize: 3, activation: 'relu' })
  ]
  // Las entradas de 64 × 64 se reducen una vez más antes de la capa densa.
  if (h > 28) layers.push(tf.layers.maxPooling2d({ poolSize: 2 }))
  layers.push(tf.layers.flatten(), tf.layers.dense({ units: size.dense, activation: 'relu' }), tf.layers.dense({ units: classes, activation: 'softmax' }))
  const model = tf.sequential({ layers })
  model.compile({ optimizer: tf.train.adam(config.learning_rate), loss: 'categoricalCrossentropy', metrics: ['accuracy'] })
  return model
}

/** Resumen legible de las capas y parámetros, sin dejar el modelo en memoria. */
export function describeModel(kind: InputKind, classes: number, modelSize: ModelSize) {
  const size = modelSizes[modelSize], [h] = inputShapes[kind]
  const layers = [`Conv2D (${size.filters[0]} filtros 3×3, ReLU)`, 'MaxPooling 2×2', `Conv2D (${size.filters[1]} filtros 3×3, ReLU)`]
  if (h > 28) layers.push('MaxPooling 2×2')
  layers.push(`Dense (${size.dense} neuronas, ReLU)`, `Dense (${classes} categorías, softmax)`)
  const model = buildModel(kind, Math.max(classes, 2), { model_size: modelSize, learning_rate: 0.001 })
  try { return { layers, params: model.countParams() } } finally { model.dispose() }
}
