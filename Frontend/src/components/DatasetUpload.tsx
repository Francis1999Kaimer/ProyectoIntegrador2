import { useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ArrowLeft, CheckCircle2, FileArchive, FolderOpen, UploadCloud } from 'lucide-react'
import { ApiMessage, Header, Page } from './AppShell'
import { api } from '../api/http'
import { useResource } from '../api/useResource'
import { useAuth } from '../auth/AuthProvider'
import { typeLabel, type Project } from '../api/types'
import { toBase64 } from '../training/storage'
import type { TrainingState } from '../training/types'
import { validateDatasetZip, type DatasetSummary, type DatasetType } from '../dataset-validation'
import { stepUrl, trainingPath, TrainingStepper } from './training/TrainingLayout'

const typeCodes: Record<string, DatasetType> = {
  character_recognition: 'characters', image_classification: 'images', sound_recognition: 'sounds',
  hand_gesture_classification: 'hands', body_posture_classification: 'postures', drawing_classification: 'drawings'
}
export default function DatasetUpload() {
  const { search } = useLocation(), params = new URLSearchParams(search), projectId = params.get('project')
  const navigate = useNavigate()
  const project = useResource<Project>(projectId ? '/projects/' + encodeURIComponent(projectId) : null)
  const training = useResource<TrainingState>(projectId ? trainingPath(projectId) : null)
  const { user } = useAuth()
  const input = useRef<HTMLInputElement>(null), sending = useRef(false)
  const [summary, setSummary] = useState<DatasetSummary>()
  const [file, setFile] = useState<File>()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [replacing, setReplacing] = useState(params.get('reemplazar') === '1')
  const type = project.data ? typeCodes[project.data.project_type] : undefined
  const state = training.data, existing = state?.dataset ?? null

  async function load(selected?: File) {
    if (!selected || !type) return
    setSummary(undefined); setFile(undefined); setError('')
    if (!/\.zip$/i.test(selected.name)) { setError('Selecciona un archivo ZIP.'); return }
    setBusy(true)
    try { const result = await validateDatasetZip(selected, type); setFile(selected); setSummary(result) }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo validar el ZIP.') }
    finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  async function save() {
    if (!file || !summary || !projectId || sending.current) return
    if (existing && (!existing.can_replace || !window.confirm('El ZIP guardado se reemplazará por el nuevo. ¿Continuar?'))) return
    sending.current = true; setSaving(true); setError('')
    try {
      const body = { file_name: file.name, content_type: 'application/zip', archive_base64: await toBase64(file), labels: summary.labels.map(item => item.name), samples: summary.total }
      await api.request('/projects/' + encodeURIComponent(projectId) + '/dataset', existing
        ? { method: 'PUT', body: { ...body, expected_updated_at: existing.updated_at } }
        : { method: 'POST', body })
      setSummary(undefined); setFile(undefined); setReplacing(false); training.reload()
    } catch (e) {
      setError((e as Error).message + ' Si ya se guardó, actualiza el estado antes de reintentar.')
    } finally { sending.current = false; setSaving(false) }
  }
  async function next() {
    if (!projectId || !existing || !state) return
    if (state.editable && !existing.locked) {
      if (!window.confirm('Al pasar al paso 2, el dataset quedará fijo y ya no podrás reemplazar el ZIP, salvo que el paso 2 detecte que no tiene suficientes ejemplos para entrenar. ¿Continuar?')) return
      setSaving(true); setError('')
      try { await api.request('/projects/' + encodeURIComponent(projectId) + '/dataset/lock', { method: 'POST' }) }
      catch (e) { setError((e as Error).message); setSaving(false); return }
      setSaving(false)
    }
    navigate(stepUrl(2, projectId))
  }
  if (!projectId) return <Page><section className="panel empty-state"><h1>Selecciona un proyecto</h1><Link to="/proyectos">Ir a proyectos</Link></section></Page>
  if (project.error || training.error) return <Page><ApiMessage error={project.error || training.error} retry={() => { project.reload(); training.reload() }} /></Page>
  if (project.loading || training.loading || !project.data || !state) return <Page><ApiMessage loading /></Page>
  if (!type) return <Page><section className="panel empty-state"><h1>Tipo de proyecto no compatible</h1><Link to="/proyectos">Volver a proyectos</Link></section></Page>
  const owner = user?.id === project.data.owner_id
  const canEdit = owner && state.editable
  const showUpload = !existing || (replacing && existing.can_replace)
  const locked = busy || saving || !canEdit || (!!existing && !existing.can_replace)
  const canContinue = !!existing && !busy && !saving && !summary && (state.editable || state.step >= 2)
  return <>
    <Header />
    <TrainingStepper projectId={projectId} current={1} state={state} locked={busy || saving} />
    <main className="page"><div className="dataset-upload-page">
      <Link className="back-link" to={'/proyectos/' + encodeURIComponent(projectId)}><ArrowLeft size={16} /> Volver al proyecto</Link>
      <div className="dataset-heading"><span className="eyebrow">PASO 1 · DATOS DE ENTRENAMIENTO</span><h1>Carga tu dataset</h1><p><strong>{project.data.title}</strong> · {typeLabel(project.data.project_type)}</p></div>
      <div className="dataset-upload-layout">
        <section className="panel dataset-upload-card">
          <div className="dataset-card-heading"><span className="dataset-icon"><UploadCloud size={24}/></span><div>
            <h2>{!existing ? 'Selecciona tu archivo ZIP' : showUpload ? 'Reemplaza tu archivo ZIP' : 'Dataset guardado'}</h2>
            <p>{!existing ? 'Un archivo para comenzar tu proyecto.'
              : existing.locked && !existing.sufficient ? 'El dataset no tiene suficientes ejemplos para entrenar. Reemplaza el ZIP.'
              : existing.locked ? 'El dataset quedó fijo al pasar al paso 2.'
              : 'El proyecto ya tiene un archivo cargado. Puedes reemplazarlo hasta pasar al paso 2.'}</p>
          </div></div>
          {showUpload && <>
            <input ref={input} className="dataset-file-input" type="file" accept=".zip,application/zip" disabled={locked} onChange={e => void load(e.target.files?.[0])} aria-label="Dataset ZIP" />
            <div className="dataset-dropzone"><FileArchive size={38}/><strong>{file?.name ?? 'Dataset en formato ZIP'}</strong><span>{type === 'sounds' ? 'Archivos WAV' : 'Imágenes PNG o JPG'} · Máximo 15 MB</span><button type="button" className="secondary" disabled={locked} onClick={() => input.current?.click()}>{busy ? 'Revisando…' : file ? 'Cambiar archivo' : 'Seleccionar ZIP'}</button></div>
            <div className="dataset-requirements"><strong>Antes de cargar</strong><p>Organiza los archivos directamente en una carpeta por categoría. Incluye al menos dos categorías y dos archivos por categoría{type === 'characters' ? ', y 12 imágenes en total' : ''}. Para entrenar, el paso 2 pide al menos {state.min_per_category} archivos por categoría.</p></div>
            {existing && <button type="button" className="secondary" disabled={busy || saving} onClick={() => { setReplacing(false); setSummary(undefined); setFile(undefined); setError('') }}>Cancelar reemplazo</button>}
          </>}
          {existing && !showUpload && existing.can_replace && <button type="button" className="secondary" onClick={() => setReplacing(true)}>Reemplazar ZIP</button>}
          {!owner && <p>Solo el propietario puede cargar el dataset.</p>}
          {owner && !canEdit && <p>{project.data.status === 'archived' ? 'El proyecto está archivado. Reábrelo para cargar datos.' : 'El salón del proyecto está archivado: el proyecto queda en solo lectura.'}</p>}
          {busy && <p role="status" className="dataset-progress">Revisando el ZIP y sus archivos…</p>}
          {error && <div role="alert" className="api-error"><p>{error}</p><button className="secondary" onClick={() => training.reload()}>Actualizar estado</button></div>}
        </section>
        <section className="panel dataset-result-card" aria-live="polite">
          {summary ? <>
            <div className="dataset-valid"><CheckCircle2 size={20}/><strong>ZIP validado</strong></div>
            <h2>{summary.total} archivos</h2><p>{summary.labels.length} categorías · {file?.name}</p>
            <div className="dataset-category-heading">Categorías detectadas</div>
            <ul className="dataset-categories">{summary.labels.map(label => <li key={label.name}><span>{label.name}</span><strong>{label.count}</strong></li>)}</ul>
            <p className="dataset-hint">Se comprobó la estructura y que los archivos se puedan abrir. Revisa que cada ejemplo corresponda a su categoría.</p>
          </> : existing ? <>
            <div className="dataset-valid"><CheckCircle2 size={20}/><strong>ZIP guardado</strong></div>
            <h2>{existing.samples} archivos</h2><p>{existing.labels.length} categorías · {existing.file_name}</p>
            <div className="dataset-category-heading">Categorías</div>
            <ul className="dataset-categories">{existing.labels.map(label => <li key={label}><span>{label}</span>{existing.counts && <strong>{existing.counts[label]}</strong>}</li>)}</ul>
          </> : <><span className="dataset-icon muted"><FolderOpen size={24}/></span><h2>Resumen del dataset</h2><p>Al seleccionar un ZIP verás aquí sus categorías y el resultado de la revisión.</p></>}
        </section>
      </div>
      <div className="dataset-save-row">
        <p>{!existing ? 'El ZIP se guardará en tu proyecto al pulsar Guardar.' : showUpload ? 'El ZIP nuevo reemplazará al guardado al pulsar Reemplazar dataset.' : 'El dataset está guardado en el proyecto.'}</p>
        {showUpload && <button className="primary" disabled={!summary || !file || locked} onClick={() => void save()}>{saving ? 'Guardando…' : existing ? 'Reemplazar dataset' : 'Guardar dataset'}</button>}
        <button className={existing && !showUpload ? 'primary' : 'secondary'} disabled={!canContinue} onClick={() => void next()}>Siguiente · Paso 2</button>
      </div>
    </div></main>
  </>
}
