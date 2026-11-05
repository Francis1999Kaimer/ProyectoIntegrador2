import { useRef, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { ArrowLeft, CheckCircle2, FileArchive, FolderOpen, UploadCloud } from 'lucide-react'
import { Page } from './AppShell'
import { api } from '../api/http'
import type { Project } from '../api/types'
import { toBase64 } from '../character-store'
import { datasetTypes, validateDatasetZip, type DatasetSummary, type DatasetType } from '../dataset-validation'

type Draft = { name: string; classroom: string; type: DatasetType; title: string }
const typeCodes: Record<DatasetType, string> = {
  characters: 'character_recognition', images: 'image_classification', sounds: 'sound_recognition',
  hands: 'hand_gesture_classification', postures: 'body_posture_classification', drawings: 'drawing_classification'
}
export default function DatasetUpload() {
  const location = useLocation(), draft = location.state as Draft | null
  const input = useRef<HTMLInputElement>(null), requestId = useRef('')
  const [summary, setSummary] = useState<DatasetSummary>()
  const [file, setFile] = useState<File>()
  const [saved, setSaved] = useState<Project>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  if (!draft || !datasetTypes.includes(draft.type) || !draft.name?.trim()) return <Navigate to="/crear" replace />

  async function load(selected?: File) {
    if (!selected || !draft) return
    setSummary(undefined); setFile(undefined); setError(''); requestId.current = ''
    if (!/\.zip$/i.test(selected.name)) { setError('Selecciona un archivo ZIP.'); return }
    setBusy(true)
    try { const result = await validateDatasetZip(selected, draft.type); setFile(selected); setSummary(result) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo validar el ZIP.') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  async function save() {
    if (!file || !summary || !draft || saving || saved) return
    setSaving(true); setError('')
    try {
      if (!requestId.current) requestId.current = crypto.randomUUID()
      const project = await api.request<Project>('/projects/with-dataset', { method: 'POST', body: {
        request_id: requestId.current, title: draft.name, project_type: typeCodes[draft.type],
        ...(draft.classroom ? { classroom_id: draft.classroom } : {}),
        file_name: file.name, content_type: 'application/zip', archive_base64: await toBase64(file),
        labels: summary.labels.map(item => item.name), samples: summary.total
      } })
      setSaved(project)
    } catch (e) { setError(e instanceof Error ? e.message : 'No se pudo guardar el proyecto.') }
    finally { setSaving(false) }
  }
  return <Page><div className="dataset-upload-page">
    <Link className="back-link" to="/crear"><ArrowLeft size={16} /> Volver a nuevo proyecto</Link>
    <div className="dataset-heading"><span className="eyebrow">PASO 1 · DATOS DE ENTRENAMIENTO</span><h1>Carga tu dataset</h1><p><strong>{draft.name}</strong> · {draft.title}</p></div>
    <div className="dataset-upload-layout">
      <section className="panel dataset-upload-card">
        <div className="dataset-card-heading"><span className="dataset-icon"><UploadCloud size={24}/></span><div><h2>Selecciona tu archivo ZIP</h2><p>Un archivo para comenzar tu proyecto.</p></div></div>
        <input ref={input} className="dataset-file-input" type="file" accept=".zip,application/zip" disabled={busy || saving || !!saved} onChange={e => void load(e.target.files?.[0])} aria-label="Dataset ZIP" />
        <div className="dataset-dropzone"><FileArchive size={38}/><strong>{file?.name ?? 'Dataset en formato ZIP'}</strong><span>{draft.type === 'sounds' ? 'Archivos WAV' : 'Imágenes PNG o JPG'} · Máximo 15 MB</span><button type="button" className="secondary" disabled={busy || saving || !!saved} onClick={() => input.current?.click()}>{busy ? 'Revisando…' : file ? 'Cambiar archivo' : 'Seleccionar ZIP'}</button></div>
        <div className="dataset-requirements"><strong>Antes de cargar</strong><p>Organiza los archivos directamente en una carpeta por categoría. Incluye al menos dos categorías y dos archivos por categoría{draft.type === 'characters' ? ', y 12 imágenes en total' : ''}.</p></div>
        {busy && <p role="status" className="dataset-progress">Revisando el ZIP y sus archivos…</p>}
        {error && <div role="alert" className="api-error"><p>{error}</p></div>}
      </section>
      <section className="panel dataset-result-card" aria-live="polite">
        {!summary ? <><span className="dataset-icon muted"><FolderOpen size={24}/></span><h2>Resumen del dataset</h2><p>Al seleccionar un ZIP verás aquí sus categorías y el resultado de la revisión.</p></> : <>
          <div className="dataset-valid"><CheckCircle2 size={20}/><strong>ZIP validado</strong></div>
          <h2>{summary.total} archivos</h2><p>{summary.labels.length} categorías · {file?.name}</p>
          <div className="dataset-category-heading">Categorías detectadas</div>
          <ul className="dataset-categories">{summary.labels.map(label => <li key={label.name}><span>{label.name}</span><strong>{label.count}</strong></li>)}</ul>
          <p className="dataset-hint">Se comprobó la estructura y que los archivos se puedan abrir. Revisa que cada ejemplo corresponda a su categoría.</p>
        </>}
      </section>
    </div>
    {saved ? <div className="dataset-save-row" role="status"><p><CheckCircle2 size={18}/> Proyecto y dataset guardados correctamente.</p><Link className="primary button-link" to={'/proyectos/' + saved.id}>Ver proyecto</Link></div> : <div className="dataset-save-row"><p>El ZIP se guardará en tu proyecto al pulsar Guardar.</p><button className="primary" disabled={!summary || !file || busy || saving} onClick={() => void save()}>{saving ? 'Guardando…' : 'Guardar proyecto y dataset'}</button></div>}
  </div></Page>
}
