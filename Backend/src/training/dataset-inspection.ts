import JSZip from 'jszip';

// Las mismas reglas que valida el navegador en el paso 1 (Frontend/src/dataset-validation.ts).
export const DATASET_LIMITS = {
  archiveBytes: 15 * 1024 * 1024, fileBytes: 5 * 1024 * 1024, totalBytes: 100 * 1024 * 1024,
  files: 1000, minLabels: 2, maxLabels: 128, minPerLabel: 2, minCharacterSamples: 12
};
// Mínimo para poder entrenar (paso 2). Con menos, el paso 2 bloquea el entrenamiento.
export const MIN_TRAINING_PER_CATEGORY = 10;

export class DatasetRejected extends Error {}
export type DatasetInspection = { labels: string[]; counts: Record<string, number>; total: number };

const text = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
const isImage = (b: Uint8Array) =>
  (b.length >= 8 && b[0] === 0x89 && text(b, 1, 4) === 'PNG') || (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff);
const isWav = (b: Uint8Array) => b.length >= 44 && text(b, 0, 4) === 'RIFF' && text(b, 8, 12) === 'WAVE';

export function sortLabels(labels: string[]) { return [...labels].sort((a, b) => a.localeCompare(b)); }

/** Abre el ZIP en el servidor y cuenta los ejemplos reales de cada categoría. */
export async function inspectDataset(bytes: Uint8Array, projectType: string): Promise<DatasetInspection> {
  const sounds = projectType === 'sound_recognition';
  let zip: JSZip;
  try { zip = await JSZip.loadAsync(bytes, { checkCRC32: true }); }
  catch { throw new DatasetRejected('No se pudo abrir el ZIP.'); }
  const files = Object.values(zip.files).filter(entry => !entry.dir && !entry.name.startsWith('__MACOSX/') && !entry.name.endsWith('/.DS_Store'));
  if (!files.length || files.length > DATASET_LIMITS.files) throw new DatasetRejected('El ZIP debe contener entre 1 y 1000 archivos de datos.');
  const counts = new Map<string, number>();
  let total = 0;
  for (const entry of files) {
    const original = (entry as typeof entry & { unsafeOriginalName?: string }).unsafeOriginalName;
    if (original && original !== entry.name) throw new DatasetRejected('El ZIP contiene una ruta no permitida.');
    const parts = entry.name.split('/');
    if (parts.length !== 2 || parts.some(part => !part.trim() || part === '.' || part === '..'))
      throw new DatasetRejected('Cada archivo debe estar directamente dentro de una carpeta de categoría.');
    const [label, name] = parts;
    if (label.trim() !== label || label.length > 80) throw new DatasetRejected('Los nombres de categorías no son válidos.');
    if (!(sounds ? /\.wav$/i : /\.(png|jpe?g)$/i).test(name)) throw new DatasetRejected('El ZIP contiene archivos con un formato no permitido.');
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize;
    if (typeof size !== 'number' || size <= 0 || size > DATASET_LIMITS.fileBytes) throw new DatasetRejected('Un archivo del ZIP está vacío o supera 5 MB.');
    total += size;
    if (total > DATASET_LIMITS.totalBytes) throw new DatasetRejected('El contenido descomprimido supera 100 MB.');
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  if (counts.size < DATASET_LIMITS.minLabels || counts.size > DATASET_LIMITS.maxLabels) throw new DatasetRejected('El ZIP debe contener entre 2 y 128 categorías.');
  if ([...counts.values()].some(count => count < DATASET_LIMITS.minPerLabel)) throw new DatasetRejected('Cada categoría debe contener al menos 2 archivos.');
  if (projectType === 'character_recognition' && files.length < DATASET_LIMITS.minCharacterSamples) throw new DatasetRejected('Se necesitan al menos 12 imágenes para caracteres.');
  for (const entry of files) {
    let content: Uint8Array;
    try { content = await entry.async('uint8array'); }
    catch { throw new DatasetRejected('Un archivo del ZIP está dañado.'); }
    if (!(sounds ? isWav(content) : isImage(content))) throw new DatasetRejected(sounds ? 'Un archivo no es un WAV válido.' : 'Un archivo no es una imagen PNG o JPG válida.');
  }
  const labels = sortLabels([...counts.keys()]);
  return { labels, counts: Object.fromEntries(labels.map(label => [label, counts.get(label)!])), total: files.length };
}

/** Comprueba que un ZIP de modelo contenga los archivos de TensorFlow.js. */
export async function inspectModelArchive(bytes: Uint8Array) {
  try {
    const zip = await JSZip.loadAsync(bytes);
    if (!zip.file('model.json') || !zip.file('weights.bin') || !zip.file('metadata.json')) throw new Error('missing');
  } catch { throw new DatasetRejected('El modelo no tiene un formato válido.'); }
}

/** Ejemplos de prueba por categoría; la misma fórmula usa el navegador (Frontend/src/training/split.ts). */
export function testCount(count: number, testPercent: number) { return Math.max(1, Math.round(count * testPercent / 100)); }
