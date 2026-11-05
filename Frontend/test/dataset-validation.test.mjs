import { test } from 'node:test'
import assert from 'node:assert/strict'
import JSZip from 'jszip'
import { validateDatasetZip } from '../.test-build/ui/entry.js'

globalThis.createImageBitmap = async blob => {
  if (new Uint8Array(await blob.arrayBuffer())[0] !== 1) throw new Error('imagen inválida')
  return { close() {} }
}
async function archive(files) {
  const zip = new JSZip()
  for (const [name, bytes] of Object.entries(files)) zip.file(name, new Uint8Array(bytes))
  return new Blob([await zip.generateAsync({type:'uint8array'})])
}
const valid = { 'A/1.png':[1], 'A/2.png':[1], 'B/1.jpg':[1], 'B/2.jpg':[1] }
test('accepts labeled image archives and reports category counts', async () => {
  const summary = await validateDatasetZip(await archive(valid), 'images')
  assert.equal(summary.total, 4)
  assert.deepEqual(summary.labels.map(x => [x.name,x.count]), [['A',2],['B',2]])
})
test('rejects loose files, nested folders, wrong formats and bad images', async () => {
  await assert.rejects(validateDatasetZip(await archive({...valid,'suelto.png':[1]}), 'images'), /directamente/)
  await assert.rejects(validateDatasetZip(await archive({...valid,'A/sub/3.png':[1]}), 'images'), /directamente/)
  await assert.rejects(validateDatasetZip(await archive({...valid,'A/mal.txt':[1]}), 'images'), /no permitido/)
  await assert.rejects(validateDatasetZip(await archive({...valid,'A/mal.png':[0]}), 'images'), /No se pudo abrir/)
})
test('enforces category counts, character minimum and WAV format', async () => {
  await assert.rejects(validateDatasetZip(await archive({'A/1.png':[1],'B/1.png':[1]}), 'images'), /al menos 2/)
  await assert.rejects(validateDatasetZip(await archive(valid), 'characters'), /12 imágenes/)
  await assert.rejects(validateDatasetZip(await archive(valid), 'sounds'), /WAV/)
  await assert.rejects(validateDatasetZip(await archive({'A/1.wav':[1],'A/2.wav':[1],'B/1.wav':[1],'B/2.wav':[1]}), 'sounds'), /WAV válido/)
})
