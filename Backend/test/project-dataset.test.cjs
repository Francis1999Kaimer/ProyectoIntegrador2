const { test } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { LearningService } = require('../dist/learning/learning.service')

function fixture() {
  const projects = new Map(), labs = new Map()
  const tx = {
    projects: {
      findUnique: async ({where}) => projects.get(where.id) ?? null,
      create: async ({data}) => { const row = {...data, status:'draft'}; projects.set(data.id,row); return row }
    },
    character_labs: {
      findUnique: async ({where}) => labs.get(where.project_id) ?? null,
      create: async ({data}) => { labs.set(data.project_id,data); return data }
    }
  }
  const db = { $transaction: async fn => fn(tx) }
  return { service: new LearningService({}, {}, db), projects, labs }
}
const types = ['character_recognition','image_classification','sound_recognition','hand_gesture_classification','body_posture_classification','drawing_classification']
function payload(projectType) { return { request_id:randomUUID(), title:'Prueba', project_type:projectType, file_name:'data.zip', content_type:'application/zip', archive_base64:Buffer.from([0x50,0x4b,3,4]).toString('base64'), labels:['A','B'], samples:12 } }
test('stores each type and dataset for its owner; retries return the same project', async () => {
  const f = fixture(), actor = {id:randomUUID(), role:'student'}
  for (const type of types) {
    const input=payload(type), first=await f.service.createProjectWithDataset(actor,input)
    const second=await f.service.createProjectWithDataset(actor,input)
    assert.equal(first.id,second.id); assert.equal(first.owner_id,actor.id); assert.equal(first.project_type,type)
    assert.deepEqual([...f.labs.get(first.id).dataset_bytes],[0x50,0x4b,3,4])
  }
  assert.equal(f.projects.size,6)
})
test('rejects request-id reuse by another owner and invalid ZIP', async () => {
  const f=fixture(), input=payload('image_classification')
  await f.service.createProjectWithDataset({id:randomUUID(),role:'student'},input)
  await assert.rejects(f.service.createProjectWithDataset({id:randomUUID(),role:'student'},input))
  await assert.rejects(f.service.createProjectWithDataset({id:randomUUID(),role:'student'},{...payload('images'), archive_base64:'AAAA'}))
})
