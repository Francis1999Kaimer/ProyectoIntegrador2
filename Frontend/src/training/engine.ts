import JSZip from 'jszip'
import * as tf from '@tensorflow/tfjs'
import { buildModel } from './model'
import { audioDecoder, datasetFiles, prepareSample, SOUND_RATE } from './prepare'
import { splitDataset, type DatasetFile } from './split'
import { inputKinds, inputLabels, inputShapes, type EpochLog, type InputKind, type RunMetrics, type TrainingConfig, type TrainingState } from './types'

export type Progress = { phase: 'prepare' | 'train' | 'evaluate' | 'export'; done: number; total: number; log?: EpochLog }
type Tensors = { xs: tf.Tensor4D; ys: tf.Tensor2D }
const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Cómo se preparan los datos de cada tipo; se guarda en metadata.json junto al modelo. */
export const preprocessing: Record<InputKind, Record<string, unknown>> = {
  gray28: { background_fill: 'white', resize: '28x28 (imagen completa)', color: 'escala de grises (0.299 R + 0.587 G + 0.114 B)', range: '0-1', invert_if_light_background: true },
  rgb64: { background_fill: 'white', crop: 'cuadrado central', resize: '64x64', color: 'RGB', range: '0-1' },
  spec64: {
    channels: 'mono', sample_rate: SOUND_RATE, window_seconds: 1, window_selection: 'segundo con más energía (paso de 10 ms); si dura menos, se completa con silencio',
    normalization: 'pico', stft: { frame_length: 512, frame_step: 256, window: 'hann' }, scale: 'logarítmica (8 unidades ln desde el máximo)', resize: '64x64', range: '0-1'
  }
}

async function tensorsFor(zip: JSZip, files: DatasetFile[], kind: InputKind, labels: string[], onItem: () => void): Promise<Tensors> {
  const [h, w, c] = inputShapes[kind], size = h * w * c, data = new Float32Array(files.length * size)
  const decode = kind === 'spec64' ? audioDecoder() : undefined
  for (let i = 0; i < files.length; i++) {
    const entry = zip.file(files[i].file)
    if (!entry) throw new Error(`Falta ${files[i].file} en el ZIP.`)
    try { data.set(await prepareSample(kind, await entry.async('blob'), decode), i * size) }
    catch { throw new Error(`No se pudo preparar ${files[i].file}.`) }
    onItem()
  }
  const ys = tf.tidy(() => tf.oneHot(tf.tensor1d(files.map(file => labels.indexOf(file.label)), 'int32'), labels.length) as tf.Tensor2D)
  return { xs: tf.tensor4d(data, [files.length, h, w, c]), ys }
}

/** Mide el modelo con los datos de entrenamiento y con el conjunto de prueba (que no se usó para entrenar). */
export async function evaluateModel(model: tf.LayersModel, train: Tensors, test: Tensors, testFiles: DatasetFile[], labels: string[], batchSize: number): Promise<RunMetrics> {
  const scalars = async (result: tf.Scalar | tf.Scalar[]) => { const list = Array.isArray(result) ? result : [result]; const values = await Promise.all(list.map(item => item.data())); list.forEach(item => item.dispose()); return values.map(value => value[0]) }
  const [trainLoss, trainAccuracy] = await scalars(model.evaluate(train.xs, train.ys, { batchSize }))
  const [testLoss] = await scalars(model.evaluate(test.xs, test.ys, { batchSize }))
  const output = model.predict(test.xs, { batchSize }) as tf.Tensor2D, rows = await output.array(); output.dispose()
  const confusion = labels.map(() => labels.map(() => 0)), misclassified: RunMetrics['misclassified'] = []
  testFiles.forEach((file, i) => {
    const row = rows[i], predicted = row.indexOf(Math.max(...row)), actual = labels.indexOf(file.label)
    confusion[actual][predicted]++
    if (predicted !== actual) misclassified.push({ file: file.file, actual: file.label, predicted: labels[predicted], confidence: clamp01(row[predicted]) })
  })
  const correct = labels.reduce((sum, _, i) => sum + confusion[i][i], 0)
  return {
    labels, train_accuracy: clamp01(trainAccuracy), train_loss: trainLoss, test_accuracy: correct / testFiles.length, test_loss: testLoss,
    test_total: testFiles.length, test_correct: correct,
    per_class: labels.map((label, i) => ({ label, total: confusion[i].reduce((a, b) => a + b, 0), correct: confusion[i][i] })),
    confusion, misclassified: misclassified.sort((a, b) => b.confidence - a.confidence).slice(0, 50)
  }
}

/** Empaqueta el modelo de TensorFlow.js (model.json + weights.bin) con metadata.json. */
export async function exportModel(model: tf.LayersModel, metadata: Record<string, unknown>) {
  let archive: Blob | undefined
  await model.save(tf.io.withSaveHandler(async artifacts => {
    const raw = artifacts.weightData
    if (!raw) throw new Error('No se encontraron los pesos del modelo.')
    const weights = raw instanceof ArrayBuffer ? raw : await new Blob(raw as BlobPart[]).arrayBuffer()
    const zip = new JSZip()
    zip.file('model.json', JSON.stringify({ format: 'layers-model', generatedBy: `TensorFlow.js v${tf.version.tfjs}`, convertedBy: null, modelTopology: artifacts.modelTopology, weightsManifest: [{ paths: ['weights.bin'], weights: artifacts.weightSpecs }] }))
    zip.file('weights.bin', weights)
    zip.file('metadata.json', JSON.stringify(metadata, null, 2))
    archive = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
    return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON', weightDataBytes: weights.byteLength } }
  }))
  if (!archive) throw new Error('No se pudo preparar el modelo para guardarlo.')
  return archive
}

/** Carga un ZIP de modelo guardado (también los del flujo anterior, que no traen metadata.json). */
export async function loadModel(blob: Blob) {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer()), modelEntry = zip.file('model.json'), weightsEntry = zip.file('weights.bin'), metaEntry = zip.file('metadata.json')
  if (!modelEntry || !weightsEntry) throw new Error('El modelo guardado no tiene un formato válido.')
  const spec = JSON.parse(await modelEntry.async('text')) as { modelTopology: object; weightsManifest: Array<{ weights: tf.io.WeightsManifestEntry[] }> }
  const model = await tf.loadLayersModel(tf.io.fromMemory({ modelTopology: spec.modelTopology, weightSpecs: spec.weightsManifest[0]?.weights, weightData: await weightsEntry.async('arraybuffer') }))
  const metadata = metaEntry ? JSON.parse(await metaEntry.async('text')) as Record<string, unknown> : null
  return { model, metadata }
}

export function predict(model: tf.LayersModel, kind: InputKind, features: Float32Array, labels: string[]) {
  const [h, w, c] = inputShapes[kind]
  const values = tf.tidy(() => Array.from((model.predict(tf.tensor4d(features, [1, h, w, c])) as tf.Tensor).dataSync()))
  return labels.map((label, i) => ({ label, confidence: clamp01(values[i]) })).sort((a, b) => b.confidence - a.confidence)
}

/** Entrenamiento completo del paso 4: prepara, entrena, evalúa con prueba y exporta. */
export async function trainProject({ state, zipBlob, config, runNumber, onProgress }: {
  state: TrainingState; zipBlob: Blob; config: TrainingConfig; runNumber: number; onProgress: (progress: Progress) => void
}) {
  const started = performance.now(), kind = inputKinds[state.project_type], labels = state.dataset!.labels, preparation = state.preparation!
  await tf.ready()
  const zip = await JSZip.loadAsync(await zipBlob.arrayBuffer())
  const { train, test } = splitDataset(datasetFiles(zip, labels), labels, preparation.test_percent, preparation.split_seed)
  let done = 0
  const item = () => onProgress({ phase: 'prepare', done: ++done, total: train.length + test.length })
  const tensors: Tensors[] = []
  let model: tf.LayersModel | undefined
  try {
    const a = await tensorsFor(zip, train, kind, labels, item); tensors.push(a)
    const b = await tensorsFor(zip, test, kind, labels, item); tensors.push(b)
    model = buildModel(kind, labels.length, config)
    const history: EpochLog[] = []
    await model.fit(a.xs, a.ys, { epochs: config.epochs, batchSize: Math.min(config.batch_size, train.length), shuffle: true, callbacks: { onEpochEnd: async (epoch, logs) => {
      const log = { epoch: epoch + 1, accuracy: clamp01(Number(logs?.acc ?? logs?.accuracy ?? 0)), loss: Number(logs?.loss) }
      history.push(log); onProgress({ phase: 'train', done: epoch + 1, total: config.epochs, log })
    } } })
    if (history.some(log => !Number.isFinite(log.loss) || log.loss > 1000000)) throw new Error('El entrenamiento no fue estable (loss inválida). Prueba con un learning rate menor.')
    onProgress({ phase: 'evaluate', done: 0, total: 1 })
    const metrics = await evaluateModel(model, a, b, test, labels, config.batch_size)
    onProgress({ phase: 'export', done: 0, total: 1 })
    const modelZip = await exportModel(model, {
      format: 'aiblocks-model', version: 1, project_type: state.project_type, run_number: runNumber, labels,
      input: { kind, shape: inputShapes[kind], description: inputLabels[kind] }, preprocessing: preprocessing[kind],
      training: { ...config, optimizer: 'adam', loss: 'categoricalCrossentropy', test_percent: preparation.test_percent, split_seed: preparation.split_seed },
      metrics: { train_accuracy: metrics.train_accuracy, test_accuracy: metrics.test_accuracy }, created_at: new Date().toISOString(), tfjs_version: tf.version.tfjs
    })
    return { history, metrics, modelZip, duration_ms: Math.round(performance.now() - started) }
  } finally {
    for (const set of tensors) { set.xs.dispose(); set.ys.dispose() }
    model?.dispose()
  }
}
