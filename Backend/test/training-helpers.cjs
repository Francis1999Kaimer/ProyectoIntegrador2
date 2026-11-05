// Utilidades compartidas por las pruebas del flujo de entrenamiento (no es un archivo *.test.cjs).
const JSZip = require('jszip')

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]
function wav() { const b = Buffer.alloc(48); b.write('RIFF', 0); b.writeUInt32LE(40, 4); b.write('WAVE', 8); return b }

/** ZIP con `perLabel` archivos por categoría. `counts` permite cantidades distintas. */
async function datasetZip({ labels = ['A', 'B'], perLabel = 10, counts, sound = false, extra = {} } = {}) {
  const zip = new JSZip()
  labels.forEach((label, i) => {
    const n = counts ? counts[i] : perLabel
    for (let j = 1; j <= n; j++) zip.file(`${label}/${j}.${sound ? 'wav' : 'png'}`, sound ? wav() : Buffer.from(PNG))
  })
  for (const [name, content] of Object.entries(extra)) zip.file(name, content)
  return zip.generateAsync({ type: 'nodebuffer' })
}
async function datasetBody(options = {}) {
  const bytes = await datasetZip(options), labels = options.labels ?? ['A', 'B']
  const total = (options.counts ?? labels.map(() => options.perLabel ?? 10)).reduce((a, b) => a + b, 0)
  return { file_name: 'datos.zip', content_type: 'application/zip', archive_base64: bytes.toString('base64'), labels, samples: total }
}
async function modelBase64({ metadata = true } = {}) {
  const zip = new JSZip(); zip.file('model.json', '{}'); zip.file('weights.bin', Buffer.from([1, 2, 3, 4]))
  if (metadata) zip.file('metadata.json', '{}')
  return (await zip.generateAsync({ type: 'nodebuffer' })).toString('base64')
}
const testCount = (n, percent) => Math.max(1, Math.round(n * percent / 100))
/** Entrenamiento válido para un dataset con `counts` por categoría y la división indicada. */
async function runBody({ labels = ['A', 'B'], counts = [10, 10], percent = 20, config, runNumber = 1 } = {}) {
  config = config ?? { epochs: 5, learning_rate: 0.001, batch_size: 16, model_size: 'medium' }
  const expected = counts.map(n => testCount(n, percent))
  const confusion = labels.map((_, i) => labels.map((__, j) => i === j ? expected[i] : 0))
  confusion[0][0] -= 1; confusion[0][1] += 1
  const total = expected.reduce((a, b) => a + b, 0), correct = total - 1
  return {
    run_number: runNumber, config, duration_ms: 1234,
    hardware: { backend: 'webgl', gpu: 'GPU de prueba', cores: 8, memory_gb: 8, epoch_estimate_ms: 200, ignored: 'x' },
    history: Array.from({ length: config.epochs }, (_, i) => ({ epoch: i + 1, accuracy: 0.5 + i / 100, loss: 1 - i / 100 })),
    metrics: {
      labels, train_accuracy: 0.95, train_loss: 0.1, test_accuracy: correct / total, test_loss: 0.3,
      per_class: labels.map((label, i) => ({ label, total: expected[i], correct: confusion[i][i] })),
      confusion, misclassified: [{ file: labels[0] + '/1.png', actual: labels[0], predicted: labels[1], confidence: 0.7 }]
    },
    model_base64: await modelBase64()
  }
}

/** Doble en memoria de las tablas character_labs y training_runs de Prisma. */
function trainingDb() {
  const labs = new Map(), runs = []
  const pick = (row, select) => row && select ? Object.fromEntries(Object.keys(select).map(key => [key, row[key]])) : row
  const second = () => new Date(Math.floor(Date.now() / 1000) * 1000)
  const db = {
    character_labs: {
      findUnique: async ({ where, select }) => pick(labs.get(where.project_id) ?? null, select),
      create: async ({ data }) => {
        if (labs.has(data.project_id)) throw Object.assign(new Error('duplicate'), { code: 'P2002' })
        const row = { dataset_counts_json: null, dataset_locked_at: null, test_percent: null, split_seed: null, training_config_json: null,
          model_file_name: null, model_content_type: null, model_bytes: null, training_metrics_json: null, training_updated_at: null,
          ...data, dataset_updated_at: second() }
        labs.set(data.project_id, row); return row
      },
      update: async ({ where, data }) => { const row = labs.get(where.project_id); if (!row) throw Object.assign(new Error('missing'), { code: 'P2025' }); Object.assign(row, data); return row },
      updateMany: async ({ where, data }) => {
        const row = labs.get(where.project_id)
        if (!row || (where.dataset_updated_at && row.dataset_updated_at.getTime() !== where.dataset_updated_at.getTime())) return { count: 0 }
        Object.assign(row, data); return { count: 1 }
      }
    },
    training_runs: {
      count: async ({ where }) => runs.filter(r => r.project_id === where.project_id).length,
      findFirst: async ({ where }) => runs.filter(r => r.project_id === where.project_id).sort((a, b) => b.run_number - a.run_number)[0] ?? null,
      findMany: async ({ where }) => runs.filter(r => r.project_id === where.project_id).sort((a, b) => a.run_number - b.run_number),
      create: async ({ data }) => {
        if (runs.some(r => r.project_id === data.project_id && r.run_number === data.run_number)) throw Object.assign(new Error('duplicate'), { code: 'P2002' })
        runs.push({ ...data }); return data
      },
      deleteMany: async ({ where }) => { const before = runs.length; for (let i = runs.length - 1; i >= 0; i--) if (runs[i].project_id === where.project_id) runs.splice(i, 1); return { count: before - runs.length } }
    }
  }
  db.$transaction = async fn => fn(db)
  return { db, labs, runs }
}

module.exports = { datasetZip, datasetBody, modelBase64, runBody, trainingDb, testCount }
