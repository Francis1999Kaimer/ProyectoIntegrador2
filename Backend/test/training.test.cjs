const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const JSZip = require('jszip')
const { LearningService } = require('../dist/learning/learning.service')
const { TrainingService } = require('../dist/training/training.service')
const { inspectDataset } = require('../dist/training/dataset-inspection')
const { datasetZip, datasetBody, runBody, trainingDb, modelBase64 } = require('./training-helpers.cjs')

const status = async promise => { try { await promise; return 200 } catch (error) { return error.getStatus?.() ?? error } }
function fixture(projectType = 'image_classification') {
  const owner = { id: randomUUID(), role: 'student' }, other = { id: randomUUID(), role: 'student' }
  const teacher = { id: randomUUID(), role: 'teacher' }, admin = { id: randomUUID(), role: 'admin' }
  const room = { id: randomUUID(), teacher_id: teacher.id, status: 'active' }
  const project = { id: randomUUID(), owner_id: owner.id, classroom_id: room.id, title: 'P', project_type: projectType, status: 'draft' }
  const repo = { project: async id => id === project.id ? project : null, classroom: async id => id === room.id ? room : null }
  const t = trainingDb(), learning = new LearningService(repo, {}, t.db)
  t.rooms.set(room.id, room)
  return { ...t, project, room, owner, other, teacher, admin, service: new TrainingService(learning, t.db) }
}

test('server inspection counts real examples per category and enforces the step 1 format', async () => {
  const counts = await inspectDataset(await datasetZip({ labels: ['gato', 'perro'], counts: [3, 12] }), 'image_classification')
  assert.deepEqual(counts, { labels: ['gato', 'perro'], counts: { gato: 3, perro: 12 }, total: 15 })
  const sound = await inspectDataset(await datasetZip({ sound: true, perLabel: 2 }), 'sound_recognition')
  assert.equal(sound.total, 4)
  await assert.rejects(inspectDataset(await datasetZip({ perLabel: 2 }), 'sound_recognition'), /formato no permitido/)
  await assert.rejects(inspectDataset(await datasetZip({ extra: { 'A/sub/1.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]) } }), 'image_classification'), /directamente/)
  await assert.rejects(inspectDataset(await datasetZip({ extra: { 'A/falsa.png': Buffer.from('no es imagen') } }), 'image_classification'), /PNG o JPG/)
  await assert.rejects(inspectDataset(await datasetZip({ perLabel: 2 }), 'character_recognition'), /12 imágenes/)
  await assert.rejects(inspectDataset(Buffer.from([0x50, 0x4b, 3, 4]), 'image_classification'), /No se pudo abrir/)
})

test('complete flow: save, replace before step 2, lock, prepare, configure and train', async () => {
  const f = fixture(), id = f.project.id
  let state = await f.service.saveInitialDataset(f.owner, id, await datasetBody({ perLabel: 10 }))
  assert.equal(state.step, 1); assert.equal(state.dataset.locked, false); assert.equal(state.dataset.can_replace, true)
  assert.deepEqual(state.dataset.counts, { A: 10, B: 10 })
  assert.equal(await status(f.service.saveInitialDataset(f.owner, id, await datasetBody())), 409)
  // Reemplazo con la fecha actual; una fecha vieja se rechaza.
  const first = state.dataset.updated_at
  state = await f.service.replaceDataset(f.owner, id, { ...await datasetBody({ labels: ['A', 'B', 'C'], perLabel: 12 }), expected_updated_at: first.toISOString() })
  assert.deepEqual(state.dataset.labels, ['A', 'B', 'C']); assert.equal(state.dataset.samples, 36)
  assert.equal(await status(f.service.replaceDataset(f.owner, id, { ...await datasetBody(), expected_updated_at: first.toISOString() })), 409)
  // Paso 2 todavía no permitido sin confirmar el dataset.
  assert.equal(await status(f.service.savePreparation(f.owner, id, { test_percent: 20 })), 409)
  state = await f.service.lockDataset(f.owner, id)
  assert.equal(state.step, 2); assert.equal(state.dataset.locked, true); assert.equal(state.dataset.can_replace, false)
  assert.equal(await status(f.service.replaceDataset(f.owner, id, { ...await datasetBody(), expected_updated_at: state.dataset.updated_at.toISOString() })), 409)
  assert.equal(await status(f.service.saveConfig(f.owner, id, { epochs: 5, learning_rate: 0.001, batch_size: 16, model_size: 'medium' })), 409)
  state = await f.service.savePreparation(f.owner, id, { test_percent: 20 })
  assert.equal(state.step, 3); assert.equal(state.preparation.test_percent, 20); assert.ok(state.preparation.split_seed > 0)
  const config = { epochs: 5, learning_rate: 0.001, batch_size: 16, model_size: 'medium' }
  state = await f.service.saveConfig(f.owner, id, config)
  assert.equal(state.step, 4); assert.deepEqual(state.config, config)
  const labels = ['A', 'B', 'C'], counts = [12, 12, 12]
  state = await f.service.createRun(f.owner, id, await runBody({ labels, counts, config }))
  assert.equal(state.step, 5); assert.equal(state.runs.length, 1); assert.equal(state.model.run_number, 1)
  assert.equal(state.runs[0].metrics.test_total, 6); assert.equal(state.runs[0].hardware.ignored, undefined)
  assert.equal(f.labs.get(id).model_file_name, 'modelo-entrenamiento-1.zip')
  // La división queda fija con el primer entrenamiento; repetir el mismo valor no falla.
  assert.equal(await status(f.service.savePreparation(f.owner, id, { test_percent: 30 })), 409)
  assert.equal(await status(f.service.savePreparation(f.owner, id, { test_percent: 20 })), 200)
  // Reentrenar con otra configuración crea el entrenamiento 2 y reemplaza el modelo.
  const second = { ...config, epochs: 6, model_size: 'small' }
  await f.service.saveConfig(f.owner, id, second)
  assert.equal(await status(f.service.createRun(f.owner, id, await runBody({ labels, counts, config: second, runNumber: 1 }))), 409)
  state = await f.service.createRun(f.owner, id, await runBody({ labels, counts, config: second, runNumber: 2 }))
  assert.equal(state.runs.length, 2); assert.equal(state.model.run_number, 2); assert.equal(state.runs[0].config.epochs, 5)
})

test('step 2 blocks training until a category has enough examples; the ZIP can then be replaced', async () => {
  const f = fixture(), id = f.project.id
  await f.service.saveInitialDataset(f.owner, id, await datasetBody({ counts: [10, 4] }))
  let state = await f.service.lockDataset(f.owner, id)
  assert.equal(state.step, 2); assert.equal(state.dataset.sufficient, false); assert.equal(state.dataset.can_replace, true)
  assert.match(state.dataset.problem, /al menos 10 ejemplos/)
  assert.equal(await status(f.service.savePreparation(f.owner, id, { test_percent: 20 })), 409)
  assert.equal(await status(f.service.saveConfig(f.owner, id, { epochs: 5, learning_rate: 0.001, batch_size: 16, model_size: 'medium' })), 409)
  assert.equal(await status(f.service.createRun(f.owner, id, await runBody({ counts: [10, 4] }))), 409)
  state = await f.service.replaceDataset(f.owner, id, { ...await datasetBody({ perLabel: 10 }), expected_updated_at: state.dataset.updated_at.toISOString() })
  assert.equal(state.step, 1); assert.equal(state.dataset.locked, false); assert.equal(state.dataset.sufficient, true)
  state = await f.service.lockDataset(f.owner, id)
  assert.equal((await f.service.savePreparation(f.owner, id, { test_percent: 10 })).step, 3)
})

test('only the owner changes the project; classroom teacher and admin read; archived projects are read-only', async () => {
  const f = fixture(), id = f.project.id, body = await datasetBody()
  assert.equal(await status(f.service.saveInitialDataset(f.other, id, body)), 404)
  assert.equal(await status(f.service.saveInitialDataset(f.teacher, id, body)), 404)
  await f.service.saveInitialDataset(f.owner, id, body)
  assert.equal(await status(f.service.state(f.other, id)), 404)
  const viewer = await f.service.state(f.teacher, id)
  assert.equal(viewer.owner, false); assert.equal(viewer.editable, false); assert.equal(viewer.dataset.can_replace, false)
  assert.equal((await f.service.state(f.admin, id)).dataset.samples, 20)
  assert.equal(await status(f.service.lockDataset(f.admin, id)), 404)
  f.room.status = 'archived'
  assert.equal(await status(f.service.lockDataset(f.owner, id)), 400, 'salón archivado: solo lectura')
  assert.equal((await f.service.state(f.owner, id)).editable, false)
  f.room.status = 'active'
  f.project.status = 'archived'
  assert.equal(await status(f.service.lockDataset(f.owner, id)), 400)
  assert.equal((await f.service.state(f.owner, id)).editable, false)
})

test('training results are validated against the dataset, the split and the saved configuration', async () => {
  const f = fixture(), id = f.project.id, config = { epochs: 5, learning_rate: 0.001, batch_size: 16, model_size: 'medium' }
  await f.service.saveInitialDataset(f.owner, id, await datasetBody())
  await f.service.lockDataset(f.owner, id)
  assert.equal(await status(f.service.createRun(f.owner, id, await runBody())), 409)
  await f.service.savePreparation(f.owner, id, { test_percent: 20 })
  await f.service.saveConfig(f.owner, id, config)
  const valid = await runBody({ config })
  assert.equal(await status(f.service.createRun(f.owner, id, { ...valid, config: { ...config, epochs: 6 } })), 409)
  assert.equal(await status(f.service.createRun(f.owner, id, { ...valid, history: valid.history.slice(1) })), 400)
  assert.equal(await status(f.service.createRun(f.owner, id, { ...valid, metrics: { ...valid.metrics, labels: ['A', 'X'] } })), 400)
  assert.equal(await status(f.service.createRun(f.owner, id, { ...valid, metrics: { ...valid.metrics, confusion: [[1, 0], [0, 2]] } })), 400)
  assert.equal(await status(f.service.createRun(f.owner, id, { ...valid, metrics: { ...valid.metrics, test_accuracy: 1 } })), 400)
  assert.equal(await status(f.service.createRun(f.owner, id, { ...valid, hardware: {} })), 400)
  assert.equal(await status(f.service.createRun(f.owner, id, { ...valid, model_base64: await modelBase64({ metadata: false }) })), 400)
  assert.equal(f.runs.length, 0)
  assert.equal((await f.service.createRun(f.owner, id, valid)).runs.length, 1)
})

test('datasets saved before this flow are counted once; an old ZIP format must be replaced', async () => {
  const f = fixture('character_recognition'), id = f.project.id
  const old = new JSZip()
  for (const label of ['0', '1']) for (let i = 0; i < 8; i++) old.file(`letras/${label}/${i}.png`, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))
  await f.db.character_labs.create({ data: { project_id: id, dataset_file_name: 'viejo.zip', dataset_content_type: 'application/zip',
    dataset_bytes: await old.generateAsync({ type: 'nodebuffer' }), dataset_labels_json: '["0","1"]', dataset_samples: 16 } })
  f.labs.get(id).dataset_locked_at = new Date()
  const state = await f.service.state(f.owner, id)
  assert.equal(state.step, 2); assert.equal(state.dataset.sufficient, false); assert.equal(state.dataset.can_replace, true)
  assert.match(state.dataset.problem, /formato actual/)
  f.labs.get(id).dataset_bytes = await datasetZip({ labels: ['0', '1'], perLabel: 8 })
  const counted = await f.service.state(f.owner, id)
  assert.deepEqual(counted.dataset.counts, { 0: 8, 1: 8 }); assert.equal(f.labs.get(id).dataset_counts_json, '{"0":8,"1":8}')
})
