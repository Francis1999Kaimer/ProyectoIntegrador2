import { api } from '../api/http'

// Copia local del ZIP y del modelo para no descargarlos en cada paso.
// La fuente de verdad es siempre el backend (MySQL).
const DB = 'aiblocks-training', STORE = 'files'
const memory = new Map<string, unknown>()
type Entry = { version: string; blob: Blob }

function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  })
}
async function read(key: string): Promise<Entry | undefined> {
  if (typeof indexedDB === 'undefined') return memory.get(key) as Entry | undefined
  try {
    const db = await open()
    return await new Promise<Entry | undefined>((resolve, reject) => { const r = db.transaction(STORE).objectStore(STORE).get(key); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  } catch { return undefined }
}
async function write(key: string, value: Entry) {
  if (typeof indexedDB === 'undefined') { memory.set(key, value); return }
  try {
    const db = await open()
    await new Promise<void>((resolve, reject) => { const r = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key); r.onsuccess = () => resolve(); r.onerror = () => reject(r.error) })
  } catch { /* Sin almacenamiento local: se descargará otra vez. */ }
}
async function cached(key: string, version: string, path: string) {
  const entry = await read(key)
  if (entry?.version === version) return entry.blob
  const blob = await api.blob(path)
  await write(key, { version, blob })
  return blob
}

export const datasetBlob = (projectId: string, updatedAt: string) =>
  cached('dataset:' + projectId, updatedAt, `/projects/${encodeURIComponent(projectId)}/dataset/file`)
export const modelBlob = (projectId: string, runNumber: number) =>
  cached('model:' + projectId, String(runNumber), `/projects/${encodeURIComponent(projectId)}/training/model-file`)
export const rememberModel = (projectId: string, runNumber: number, blob: Blob) => write('model:' + projectId, { version: String(runNumber), blob })

export async function toBase64(file: Blob) {
  const bytes = new Uint8Array(await file.arrayBuffer()), chunk = 0x8000
  let text = ''
  for (let i = 0; i < bytes.length; i += chunk) text += String.fromCharCode(...bytes.subarray(i, i + chunk))
  return btoa(text)
}
