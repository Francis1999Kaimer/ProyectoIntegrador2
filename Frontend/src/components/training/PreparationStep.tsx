import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import JSZip from 'jszip'
import { api } from '../../api/http'
import { ApiMessage } from '../AppShell'
import { datasetBlob } from '../../training/storage'
import { audioDecoder, datasetFiles, featuresToDataUrl, imageFeatures, soundFeatures, soundWindow, waveformDataUrl } from '../../training/prepare'
import { splitCounts } from '../../training/split'
import { inputKinds, inputLabels, type InputKind, type TrainingState } from '../../training/types'
import { StepActions, stepUrl, TrainingHeading, TrainingPage, trainingPath, type StepContext } from './TrainingLayout'

const RECOMMENDED = 20
export const preparationText: Record<InputKind, string> = {
  gray28: 'Cada imagen se reduce a 28 × 28 píxeles y se convierte a escala de grises con valores entre 0 y 1. Si el fondo es claro, se invierten los colores para que el trazo quede claro sobre fondo oscuro.',
  rgb64: 'Cada imagen se recorta al cuadrado central y se reduce a 64 × 64 píxeles en color, con valores entre 0 y 1.',
  spec64: 'Cada audio se convierte a mono de 16 kHz y se toma el segundo con más energía (si dura menos, se completa con silencio). Se normaliza el volumen y se transforma en un espectrograma de 64 × 64 con valores entre 0 y 1.'
}
type Preview = { label: string; file: string; before: string; after: string; audio?: string }

/** Algunos ejemplos por categoría, tal como se subieron y como los recibe la CNN. */
function DatasetPreview({ projectId, state }: { projectId: string; state: TrainingState }) {
  const kind = inputKinds[state.project_type], dataset = state.dataset!
  const [items, setItems] = useState<Preview[]>(), [error, setError] = useState('')
  useEffect(() => {
    let alive = true; const urls: string[] = []
    void (async () => {
      const zip = await JSZip.loadAsync(await (await datasetBlob(projectId, dataset.updated_at)).arrayBuffer())
      const files = datasetFiles(zip, dataset.labels).sort((a, b) => a.file < b.file ? -1 : 1)
      const chosen = dataset.labels.slice(0, 6).flatMap(label => files.filter(item => item.label === label).slice(0, 2))
      const decode = kind === 'spec64' ? audioDecoder() : undefined, result: Preview[] = []
      for (const item of chosen) {
        const blob = await zip.file(item.file)!.async('blob'), url = URL.createObjectURL(blob); urls.push(url)
        if (decode) {
          const sound = soundWindow(await decode(await blob.arrayBuffer()))
          result.push({ ...item, before: waveformDataUrl(sound.source, sound.start), after: featuresToDataUrl(soundFeatures(sound.window), kind), audio: url })
        } else result.push({ ...item, before: url, after: featuresToDataUrl(await imageFeatures(blob, kind as 'gray28' | 'rgb64'), kind) })
      }
      if (alive) setItems(result)
    })().catch(() => { if (alive) setError('No se pudo preparar la vista previa en este navegador.') })
    return () => { alive = false; urls.forEach(url => URL.revokeObjectURL(url)) }
  }, [projectId, dataset.updated_at, dataset.labels, kind])
  if (error) return <p className="training-note">{error}</p>
  if (!items) return <p role="status" className="dataset-progress">Preparando la vista previa…</p>
  return <ul className="preview-grid">{items.map(item => <li key={item.file}>
    <div className="preview-pair">
      <figure><img src={item.before} alt={'Original de ' + item.file} /><figcaption>Antes</figcaption></figure>
      <figure><img className="pixelated" src={item.after} alt={'Preparado de ' + item.file} /><figcaption>Después</figcaption></figure>
    </div>
    {item.audio && <audio controls src={item.audio} preload="none" />}
    <span className="preview-label">{item.label}</span>
  </li>)}</ul>
}

function PreparationContent({ projectId, project, state }: StepContext) {
  const navigate = useNavigate(), dataset = state.dataset!, kind = inputKinds[state.project_type]
  const [percent, setPercent] = useState(state.preparation?.test_percent ?? 20), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const counts = dataset.counts ?? {}, split = splitCounts(counts, percent)
  const short = split.rows.filter(row => row.total < state.min_per_category)
  const few = split.rows.filter(row => row.total < RECOMMENDED)
  const values = split.rows.map(row => row.total), unbalanced = values.length > 1 && Math.max(...values) > 3 * Math.min(...values)
  const fixed = state.runs.length > 0, canSave = state.editable && dataset.sufficient
  async function next() {
    if (!canSave) { navigate(stepUrl(3, projectId)); return }
    setBusy(true); setError('')
    try { await api.request(trainingPath(projectId) + '/preparation', { method: 'PUT', body: { test_percent: percent } }); navigate(stepUrl(3, projectId)) }
    catch (e) { setError((e as Error).message); setBusy(false) }
  }
  return <>
    <TrainingHeading step="PASO 2 · PREPARACIÓN DE DATOS" title="Prepara tus datos" project={project} />
    {!dataset.sufficient && <div role="alert" className="training-alert">
      <AlertTriangle size={20} /><div>
        <strong>No se puede entrenar todavía.</strong>
        <p>{dataset.counts ? `Cada categoría necesita al menos ${state.min_per_category} ejemplos para entrenar.` : dataset.problem}</p>
        {short.length > 0 && <ul>{short.map(row => <li key={row.label}>{row.label}: {row.total} ejemplos (faltan {state.min_per_category - row.total})</li>)}</ul>}
        {dataset.can_replace ? <Link className="primary button-link" to={stepUrl(1, projectId) + '&reemplazar=1'}>Reemplazar ZIP</Link> : <p>Solo el propietario puede reemplazar el ZIP.</p>}
      </div>
    </div>}
    <div className="training-grid">
      <section className="panel training-card">
        <h2>Ejemplos por categoría</h2>
        <p>{dataset.file_name} · {dataset.samples} archivos · {dataset.labels.length} categorías</p>
        <div className="table-scroll"><table className="training-table">
          <thead><tr><th>Categoría</th><th>Ejemplos</th><th>Entrenamiento</th><th>Prueba</th><th>Estado</th></tr></thead>
          <tbody>{split.rows.map(row => <tr key={row.label}>
            <td>{row.label}</td><td>{row.total}</td><td>{row.train}</td><td>{row.test}</td>
            <td>{row.total < state.min_per_category ? <span className="tag danger-tag">Faltan {state.min_per_category - row.total}</span> : <span className="tag ok-tag"><CheckCircle2 size={14} /> Suficiente</span>}</td>
          </tr>)}</tbody>
        </table></div>
        {dataset.sufficient && few.length > 0 && <p className="training-warning">Recomendado: {RECOMMENDED} o más ejemplos por categoría ({few.map(row => row.label).join(', ')}).</p>}
        {dataset.sufficient && unbalanced && <p className="training-warning">Las categorías están desbalanceadas: unas tienen más del triple de ejemplos que otras.</p>}
      </section>
      <section className="panel training-card">
        <h2>División de los datos</h2>
        <p>La CNN aprende solo con el conjunto de entrenamiento. El conjunto de prueba se reserva para medir el resultado en el paso 5.</p>
        <fieldset className="segmented" disabled={!state.editable || fixed || !dataset.sufficient}>
          <legend>Tamaño del conjunto de prueba</legend>
          {[10, 20, 30].map(value => <label key={value} className={percent === value ? 'selected' : ''}>
            <input type="radio" name="test_percent" value={value} checked={percent === value} onChange={() => setPercent(value)} />{value} %{value === 20 ? ' (recomendado)' : ''}
          </label>)}
        </fieldset>
        <dl className="split-summary"><div><dt>Entrenamiento</dt><dd>{split.train} ejemplos</dd></div><div><dt>Prueba</dt><dd>{split.test} ejemplos</dd></div></dl>
        <p className="dataset-hint">Cada categoría se divide por separado y de forma aleatoria. La división se guarda para que el conjunto de prueba sea siempre el mismo{fixed ? '; quedó fija con el primer entrenamiento' : ''}.</p>
      </section>
    </div>
    <section className="panel training-card">
      <h2>Así se preparan los datos</h2>
      <p>{preparationText[kind]}</p>
      <p className="training-meta">Entrada de la CNN: {inputLabels[kind]}</p>
      <DatasetPreview projectId={projectId} state={state} />
    </section>
    <ApiMessage error={error} />
    <StepActions back={{ to: stepUrl(1, projectId), label: 'Anterior · Paso 1' }} note={dataset.sufficient ? 'La división se guardará al continuar.' : 'Reemplaza el ZIP para poder continuar.'}>
      <button className="primary" disabled={busy || !dataset.sufficient || (!state.editable && state.step < 3)} onClick={() => void next()}>{busy ? 'Guardando…' : 'Siguiente · Paso 3'}</button>
    </StepActions>
  </>
}

export default function PreparationStep() { return <TrainingPage step={2}>{context => <PreparationContent {...context} />}</TrainingPage> }
