import JSZip from 'jszip'

export const datasetTypes = ['characters', 'images', 'sounds', 'hands', 'postures', 'drawings'] as const
export type DatasetType = typeof datasetTypes[number]
export type DatasetSummary = { labels: { name: string; count: number }[]; total: number }

const MAX_ARCHIVE = 15 * 1024 * 1024
const MAX_TOTAL = 100 * 1024 * 1024
const MAX_FILE = 5 * 1024 * 1024
const MAX_FILES = 1000

export async function validateDatasetZip(file: Blob, type: DatasetType): Promise<DatasetSummary> {
  if (!datasetTypes.includes(type)) throw new Error('Selecciona un tipo de proyecto válido.')
  if (!file.size || file.size > MAX_ARCHIVE) throw new Error('El ZIP debe pesar entre 1 byte y 15 MB.')
  let zip: JSZip
  try { zip = await JSZip.loadAsync(await file.arrayBuffer(), { checkCRC32: false }) }
  catch { throw new Error('No se pudo abrir el ZIP. Comprueba que no esté dañado ni protegido por contraseña.') }
  const counts = new Map<string, number>()
  const files = Object.values(zip.files).filter(entry => !entry.dir && !entry.name.startsWith('__MACOSX/') && !entry.name.endsWith('/.DS_Store'))
  if (!files.length || files.length > MAX_FILES) throw new Error('El ZIP debe contener entre 1 y 1000 archivos de datos.')
  let totalBytes = 0
  for (const entry of files) {
    const original = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName
    if (original && original !== entry.name) throw new Error('El ZIP contiene una ruta no permitida.')
    const parts = entry.name.split('/')
    if (parts.length !== 2 || parts.some(part => !part.trim() || part === '.' || part === '..')) throw new Error('Cada archivo debe estar directamente dentro de una carpeta de categoría, sin subcarpetas ni archivos sueltos: categoría/archivo.')
    const [label, name] = parts
    if (label.trim() !== label || label.length > 80) throw new Error('Los nombres de categorías deben tener entre 1 y 80 caracteres y no llevar espacios al inicio o final.')
    const supported = type === 'sounds' ? /\\.wav$/i : /\\.(png|jpe?g)$/i
    if (!supported.test(name)) throw new Error(`Archivo no permitido: ${entry.name}. ${type === 'sounds' ? 'Usa solo archivos WAV.' : 'Usa solo imágenes PNG o JPG.'}`)
    const info = (entry as unknown as { _data?: { uncompressedSize?: number } })._data
    const size = info?.uncompressedSize
    if (typeof size !== 'number' || size <= 0 || size > MAX_FILE) throw new Error(`El archivo ${entry.name} está vacío o supera 5 MB.`)
    totalBytes += size
    if (totalBytes > MAX_TOTAL) throw new Error('El contenido descomprimido supera 100 MB.')
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  if (counts.size < 2 || counts.size > 128) throw new Error('El ZIP debe contener entre 2 y 128 carpetas de categorías con archivos.')
  if ([...counts.values()].some(count => count < 2)) throw new Error('Cada categoría debe contener al menos 2 archivos.')
  if (type === 'characters' && files.length < 12) throw new Error('Para caracteres se necesitan al menos 12 imágenes en total.')
  for (const entry of files) {
    let bytes: ArrayBuffer
    try { bytes = await entry.async('arraybuffer') }
    catch { throw new Error(`No se pudo leer ${entry.name}. El archivo podría estar dañado o protegido.`) }
    if (type === 'sounds') {
      const a = new Uint8Array(bytes)
      if (a.length < 44 || String.fromCharCode(...a.slice(0,4)) !== 'RIFF' || String.fromCharCode(...a.slice(8,12)) !== 'WAVE') throw new Error(`El archivo ${entry.name} no es un WAV válido.`)
      const AudioContextClass = window.AudioContext
      if (!AudioContextClass) throw new Error('Tu navegador no permite comprobar el audio WAV.')
      const audio = new AudioContextClass()
      try { await audio.decodeAudioData(bytes.slice(0)) }
      catch { throw new Error(`No se pudo decodificar el audio ${entry.name}.`) }
      finally { await audio.close().catch(() => undefined) }
    } else {
      try { const image = await createImageBitmap(new Blob([bytes])); image.close() }
      catch { throw new Error(`No se pudo abrir la imagen ${entry.name}; comprueba que no esté dañada.`) }
    }
  }
  return { labels: [...counts].map(([name,count]) => ({name,count})), total: files.length }
}
