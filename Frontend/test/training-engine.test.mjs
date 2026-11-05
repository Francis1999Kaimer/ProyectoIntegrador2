import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as tf from '@tensorflow/tfjs'
import JSZip from 'jszip'
const engine = await import('../.test-build/ui/entry.js')
await tf.setBackend('cpu'); await tf.ready()

const files = (counts) => Object.entries(counts).flatMap(([label, n]) => Array.from({ length: n }, (_, i) => ({ label, file: `${label}/${String(i).padStart(3, '0')}.png` })))

test('split is reproducible, per category and matches the server formula', () => {
  const all = files({ A: 10, B: 23, C: 37 }), labels = ['A', 'B', 'C']
  const first = engine.splitDataset(all, labels, 20, 12345), again = engine.splitDataset([...all].reverse(), labels, 20, 12345)
  assert.deepEqual(first, again)
  const other = engine.splitDataset(all, labels, 20, 999)
  assert.notDeepEqual(first.test.map(f => f.file), other.test.map(f => f.file))
  for (const [label, n] of [['A', 10], ['B', 23], ['C', 37]]) {
    const test = first.test.filter(f => f.label === label), train = first.train.filter(f => f.label === label)
    assert.equal(test.length, engine.testCount(n, 20)); assert.equal(test.length + train.length, n)
    assert.ok(!test.some(t => train.some(r => r.file === t.file)))
  }
  assert.deepEqual([10, 20, 30].map(p => engine.testCount(10, p)), [1, 2, 3])
  const counts = engine.splitCounts({ A: 10, B: 23 }, 30)
  assert.equal(counts.test, 3 + 7); assert.equal(counts.train, 7 + 16)
})

test('sound preparation keeps the loudest second and produces a 64 × 64 spectrogram between 0 and 1', () => {
  const rate = engine.SOUND_RATE, samples = new Float32Array(rate * 3)
  for (let i = rate * 2; i < rate * 2.5; i++) samples[i] = 0.4 * Math.sin(i / 5)
  const chosen = engine.soundWindow({ samples, rate })
  assert.equal(chosen.window.length, rate); assert.ok(chosen.start >= 1.4 && chosen.start <= 2.1, String(chosen.start))
  assert.ok(Math.abs(Math.max(...chosen.window.map(Math.abs)) - 1) < 1e-6)
  const short = engine.soundWindow({ samples: new Float32Array(rate / 4).fill(0.5), rate })
  assert.equal(short.window.length, rate); assert.equal(short.window[0], 0); assert.equal(short.window[rate / 2], 1)
  const resampled = engine.soundWindow({ samples: new Float32Array(48000 * 2), rate: 48000 })
  assert.equal(resampled.duration, 2)
  const features = engine.soundFeatures(chosen.window)
  assert.equal(features.length, 64 * 64)
  assert.ok(features.every(v => v >= 0 && v <= 1.0001))
})

test('CNN sizes and inputs: medium keeps the previous character CNN', () => {
  const medium = engine.describeModel('gray28', 3, 'medium')
  assert.deepEqual(medium.layers, ['Conv2D (8 filtros 3×3, ReLU)', 'MaxPooling 2×2', 'Conv2D (16 filtros 3×3, ReLU)', 'Dense (32 neuronas, ReLU)', 'Dense (3 categorías, softmax)'])
  const color = engine.describeModel('rgb64', 2, 'small'), large = engine.describeModel('spec64', 2, 'large')
  assert.equal(color.layers.filter(l => l.startsWith('MaxPooling')).length, 2)
  assert.ok(large.params > color.params)
  const model = engine.buildModel('rgb64', 4, { model_size: 'large', learning_rate: 0.003 })
  assert.deepEqual(model.inputs[0].shape, [null, 64, 64, 3]); assert.deepEqual(model.outputs[0].shape, [null, 4]); model.dispose()
  assert.deepEqual(engine.recommendedConfig({ backend: 'webgl' }), { epochs: 12, learning_rate: 0.001, batch_size: 16, model_size: 'medium' })
  assert.equal(engine.recommendedConfig({ backend: 'cpu' }).model_size, 'small')
  assert.equal(engine.formatDuration(65000), '1 min 05 s')
})

test('a small CNN trains, is evaluated on the test set and survives export with metadata.json', async () => {
  // Dos categorías sintéticas: mitad superior clara o mitad inferior clara.
  const make = (label, n) => Array.from({ length: n }, (_, k) => { const a = new Float32Array(784); for (let i = 0; i < 784; i++) a[i] = (label === 'arriba' ? i < 392 : i >= 392) ? 0.8 + (k % 3) * 0.05 : 0.05; return a })
  const set = (counts) => {
    const entries = Object.entries(counts).flatMap(([label, n]) => make(label, n).map((x, i) => ({ label, x, file: `${label}/${i}.png` })))
    const xs = tf.tensor4d(entries.flatMap(e => [...e.x]), [entries.length, 28, 28, 1])
    const ys = tf.oneHot(tf.tensor1d(entries.map(e => ['abajo', 'arriba'].indexOf(e.label)), 'int32'), 2)
    return { xs, ys, files: entries.map(({ label, file }) => ({ label, file })) }
  }
  const labels = ['abajo', 'arriba'], train = set({ abajo: 8, arriba: 8 }), testSet = set({ abajo: 2, arriba: 2 })
  const model = engine.buildModel('gray28', 2, { model_size: 'small', learning_rate: 0.003 })
  await model.fit(train.xs, train.ys, { epochs: 15, batchSize: 8, shuffle: true })
  const metrics = await engine.evaluateModel(model, train, testSet, testSet.files, labels, 8)
  assert.equal(metrics.test_total, 4)
  assert.equal(metrics.confusion.flat().reduce((a, b) => a + b, 0), 4)
  assert.equal(metrics.test_accuracy, metrics.test_correct / metrics.test_total)
  assert.deepEqual(metrics.per_class.map(r => r.total), [2, 2])
  assert.ok(metrics.train_accuracy >= 0.9, 'train accuracy ' + metrics.train_accuracy)
  const archive = await engine.exportModel(model, { labels, input: { kind: 'gray28' } })
  const zip = await JSZip.loadAsync(await archive.arrayBuffer())
  assert.ok(zip.file('model.json') && zip.file('weights.bin') && zip.file('metadata.json'))
  const loaded = await engine.loadModel(archive)
  assert.deepEqual(loaded.metadata.labels, labels)
  const sample = make('arriba', 1)[0], result = engine.predict(loaded.model, 'gray28', sample, labels)
  assert.equal(result.length, 2); assert.ok(Math.abs(result[0].confidence + result[1].confidence - 1) < 1e-4)
  assert.deepEqual(result.map(r => r.label).sort(), labels)
  const before = engine.predict(model, 'gray28', sample, labels)
  assert.ok(Math.abs(before[0].confidence - result[0].confidence) < 1e-5)
  for (const t of [train.xs, train.ys, testSet.xs, testSet.ys]) t.dispose()
  model.dispose(); loaded.model.dispose()
})
