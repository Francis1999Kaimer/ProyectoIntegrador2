import { useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Page } from './AppShell'
import { datasetTypes, validateDatasetZip, type DatasetSummary, type DatasetType } from '../dataset-validation'

type Draft = { name: string; classroom: string; type: DatasetType; title: string }
export default function DatasetUpload() {
  const location = useLocation(), draft = location.state as Draft | null
  const input = useRef<HTMLInputElement>(null)
  const [summary, setSummary] = useState<DatasetSummary>()
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!draft || !datasetTypes.includes(draft.type) || !draft.name?.trim()) return <Navigate to="/crear" replace />
  async function load(file?: File) {
    if (!file || !draft) return
    setSummary(undefined); setFileName(file.name); setError('')
    if (!/\.zip$/i.test(file.name)) { setError('Selecciona un archivo ZIP.'); return }
    setBusy(true)
    try { setSummary(await validateDatasetZip(file, draft.type)) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo validar el ZIP.') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  return <Page><div className="page-title"><div><span className="eyebrow">PASO 1 · DATOS DE ENTRENAMIENTO</span><h1>Carga tu dataset</h1><p>{draft.name} · {draft.title}</p></div></div>
    <section className="panel character-card">
      <h2>Selecciona un archivo ZIP</h2>
      <p>Organiza los archivos directamente en una carpeta por categoría. Usa {draft.type === 'sounds' ? 'archivos WAV' : 'imágenes PNG o JPG'}. Máximo 15 MB.</p>
      <label>Dataset ZIP<input ref={input} type="file" accept=".zip,application/zip" disabled={busy} onChange={e => void load(e.target.files?.[0])} /></label>
      {busy && <p role="status">Revisando el ZIP y sus archivos…</p>}
      {error && <p role="alert">{error}</p>}
      {summary && <div role="status"><h2>ZIP validado</h2><p>{fileName}: {summary.total} archivos en {summary.labels.length} categorías.</p><ul>{summary.labels.map(label => <li key={label.name}>{label.name}: {label.count} archivos</li>)}</ul><p>Se comprobó la estructura y que los archivos puedan abrirse. Revisa que cada ejemplo corresponda a su categoría.</p></div>}
      <p>Esta vista valida el archivo en tu navegador. Todavía no guarda el dataset ni crea el proyecto.</p>
      <Link className="secondary button-link" to="/crear">Volver a nuevo proyecto</Link>
    </section>
  </Page>
}
