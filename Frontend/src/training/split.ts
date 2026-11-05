export type DatasetFile = { label: string; file: string }

/** Ejemplos de prueba por categoría. El backend valida con la misma fórmula. */
export function testCount(count: number, testPercent: number) { return Math.max(1, Math.round(count * testPercent / 100)) }

function hash(text: string) {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
/** Generador pseudoaleatorio con semilla: el mismo dataset y semilla dan siempre la misma división. */
export function seededRandom(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const byName = (a: DatasetFile, b: DatasetFile) => a.file < b.file ? -1 : a.file > b.file ? 1 : 0

/** Divide cada categoría en entrenamiento y prueba de forma reproducible. */
export function splitDataset(files: DatasetFile[], labels: string[], testPercent: number, seed: number) {
  const train: DatasetFile[] = [], test: DatasetFile[] = []
  for (const label of labels) {
    const own = files.filter(item => item.label === label).sort(byName), random = seededRandom(seed ^ hash(label))
    for (let i = own.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [own[i], own[j]] = [own[j], own[i]] }
    const n = testCount(own.length, testPercent)
    test.push(...own.slice(0, n)); train.push(...own.slice(n))
  }
  return { train, test }
}

/** Cantidades por conjunto sin necesidad de abrir el ZIP. */
export function splitCounts(counts: Record<string, number>, testPercent: number) {
  const rows = Object.entries(counts).map(([label, total]) => ({ label, total, test: testCount(total, testPercent), train: total - testCount(total, testPercent) }))
  return { rows, train: rows.reduce((sum, row) => sum + row.train, 0), test: rows.reduce((sum, row) => sum + row.test, 0) }
}
