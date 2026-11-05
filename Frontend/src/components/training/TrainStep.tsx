import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { CheckCircle2, Play } from 'lucide-react'
import { api } from '../../api/http'
import { ApiMessage } from '../AppShell'
import { trainProject, type Progress } from '../../training/engine'
import { detectHardware, formatDuration } from '../../training/hardware'
import { modelSizes } from '../../training/model'
import { splitCounts } from '../../training/split'
import { datasetBlob, rememberModel, toBase64 } from '../../training/storage'
import { inputKinds, inputLabels, percent, type EpochLog, type Hardware, type TrainingState } from '../../training/types'
import { HardwareList } from './ConfigurationStep'
import { MetricChart } from './charts'
import { StepActions, stepUrl, TrainingHeading, TrainingPage, trainingPath, type StepContext } from './TrainingLayout'

const phases: Record<Progress['phase'], string> = {
  prepare: 'Preparando los datos', train: 'Entrenando', evaluate: 'Evaluando con el conjunto de prueba', export: 'Guardando el modelo'
}

export function EpochTable({ history }: { history: EpochLog[] }) {
  return <div className="table-scroll epoch-table"><table className="training-table">
    <thead><tr><th>Época</th><th>Accuracy</th><th>Loss</th></tr></thead>
    <tbody>{history.map(row => <tr key={row.epoch}><td>{row.epoch}</td><td>{percent(row.accuracy)}</td><td>{row.loss.toFixed(4)}</td></tr>)}</tbody>
  </table></div>
}

function TrainContent(context: StepContext) {
  const { projectId, project, state } = context
  if (!state.config) return <>
    <TrainingHeading step="PASO 4 · ENTRENAMIENTO EN EL NAVEGADOR" title="Entrena tu CNN" project={project} />
    <section className="panel empty-state"><p>Primero guarda la configuración del entrenamiento.</p><Link className="primary button-link" to={stepUrl(3, projectId)}>Ir al paso 3</Link></section>
  </>
  return <TrainRunner {...context} />
}

function TrainRunner({ projectId, project, state, setState, setLocked }: StepContext) {
  const navigate = useNavigate(), config = state.config!, kind = inputKinds[state.project_type]
  const split = splitCounts(state.dataset!.counts ?? {}, state.preparation!.test_percent)
  const [hardware, setHardware] = useState<Hardware>()
  const [running, setRunning] = useState(false), [progress, setProgress] = useState<Progress>(), [history, setHistory] = useState<EpochLog[]>([])
  const [elapsed, setElapsed] = useState(0), [error, setError] = useState(''), [saved, setSaved] = useState<TrainingState['runs'][number]>()
  const started = useRef(0)
  const last = state.runs.at(-1)
  useEffect(() => { void detectHardware().then(setHardware).catch(() => setHardware(undefined)) }, [])
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setElapsed(performance.now() - started.current), 500)
    // Si se cierra o recarga la pestaña durante el entrenamiento, ese entrenamiento no se guarda.
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => { clearInterval(timer); window.removeEventListener('beforeunload', warn) }
  }, [running])

  async function run() {
    setRunning(true); setLocked(true); setError(''); setSaved(undefined); setHistory([]); setProgress(undefined)
    started.current = performance.now(); setElapsed(0)
    try {
      const found = hardware ?? await detectHardware()
      const runNumber = (last?.run_number ?? 0) + 1
      const zipBlob = await datasetBlob(projectId, state.dataset!.updated_at)
      let trainStart = performance.now(), trainEnd = trainStart
      const result = await trainProject({ state, zipBlob, config, runNumber, onProgress: next => {
        if (next.phase === 'prepare' && next.done === next.total) trainStart = performance.now()
        if (next.phase === 'train') trainEnd = performance.now()
        setProgress(next); if (next.log) setHistory(current => [...current, next.log!])
      } })
      const epochMs = Math.round((trainEnd - trainStart) / Math.max(1, config.epochs))
      const next = await api.request<TrainingState>(trainingPath(projectId) + '/runs', { method: 'POST', body: {
        run_number: runNumber, config, duration_ms: result.duration_ms, history: result.history, metrics: result.metrics,
        hardware: { ...found, epoch_estimate_ms: epochMs }, model_base64: await toBase64(result.modelZip)
      } })
      await rememberModel(projectId, runNumber, result.modelZip)
      setState(next); setSaved(next.runs.at(-1))
    } catch (e) { setError((e as Error).message) }
    finally { setRunning(false); setLocked(false); setElapsed(performance.now() - started.current) }
  }
  const shown = running || history.length ? history : last?.history ?? []
  const fraction = !progress ? 0 : progress.phase === 'prepare' ? 0.15 * progress.done / progress.total
    : progress.phase === 'train' ? 0.15 + 0.8 * progress.done / progress.total : progress.phase === 'evaluate' ? 0.96 : 0.99
  return <>
    <TrainingHeading step="PASO 4 · ENTRENAMIENTO EN EL NAVEGADOR" title="Entrena tu CNN" project={project}>
      <p className="training-meta">El cálculo ocurre en tu equipo con TensorFlow.js. El modelo, las métricas y la configuración usada se guardan en el proyecto.</p>
    </TrainingHeading>
    <div className="training-grid">
      <section className="panel training-card">
        <h2>Configuración usada</h2>
        <dl className="hardware-list">
          <div><dt>Épocas</dt><dd>{config.epochs}</dd></div>
          <div><dt>Learning rate</dt><dd>{config.learning_rate}</dd></div>
          <div><dt>Batch size</dt><dd>{config.batch_size}</dd></div>
          <div><dt>Tamaño de la CNN</dt><dd>{modelSizes[config.model_size].label}</dd></div>
          <div><dt>Optimizador · pérdida</dt><dd>Adam · categorical crossentropy</dd></div>
          <div><dt>Entrada</dt><dd>{inputLabels[kind]}</dd></div>
          <div><dt>Datos</dt><dd>{split.train} de entrenamiento · {split.test} de prueba ({state.preparation!.test_percent} %)</dd></div>
        </dl>
        {hardware && <><h3>Equipo</h3><HardwareList hardware={hardware} /></>}
      </section>
      <section className="panel training-card train-control">
        <h2>{running ? phases[progress?.phase ?? 'prepare'] + '…' : saved ? `Entrenamiento ${saved.run_number} guardado` : 'Entrenamiento'}</h2>
        {state.editable
          ? <button className="primary train-button" disabled={running} onClick={() => void run()}><Play size={18} />{running ? 'Entrenando…' : `Entrenar ${config.epochs} épocas`}</button>
          : <p>Solo el propietario puede entrenar este proyecto.</p>}
        {(running || progress) && <>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(fraction * 100)} aria-label="Progreso del entrenamiento"><div className="progress-fill" style={{ width: `${fraction * 100}%` }} /></div>
          <p role="status" className="dataset-progress">{progress?.phase === 'prepare' ? `Preparando ${progress.done} de ${progress.total} ejemplos` : progress?.phase === 'train' ? `Época ${progress.done} de ${progress.total}` : progress ? phases[progress.phase] : 'Iniciando TensorFlow.js'} · {formatDuration(elapsed)}</p>
        </>}
        {running && <p className="training-warning">No cierres ni recargues la pestaña: el entrenamiento se guarda al terminar.</p>}
        {saved && 'per_class' in saved.metrics && <div className="training-success"><CheckCircle2 size={20} /><div>
          <strong>Accuracy de prueba: {percent(saved.metrics.test_accuracy)}</strong>
          <p>Acertó {saved.metrics.test_correct} de {saved.metrics.test_total} ejemplos de prueba · Loss de prueba {saved.metrics.test_loss.toFixed(4)} · {formatDuration(saved.duration_ms)}</p>
        </div></div>}
        {!running && !saved && last && <p className="training-note">Último entrenamiento guardado: número {last.run_number}. Al entrenar de nuevo se guardará como el número {last.run_number + 1}.</p>}
      </section>
    </div>
    <ApiMessage error={error} />
    {shown.length > 0 && <section className="panel training-card">
      <h2>{running || history.length ? 'Métricas por época' : `Métricas por época · entrenamiento ${last?.run_number}`}</h2>
      <p>Accuracy y loss con los datos de entrenamiento.</p>
      <div className="chart-row">
        <MetricChart title="Accuracy" history={shown} metric="accuracy" epochs={running || history.length ? config.epochs : last!.config.epochs} format={value => Math.round(value * 100) + ' %'} color="#0f62fe" />
        <MetricChart title="Loss" history={shown} metric="loss" epochs={running || history.length ? config.epochs : last!.config.epochs} format={value => value.toFixed(2)} color="#da1e28" />
      </div>
      <EpochTable history={shown} />
    </section>}
    <StepActions back={running ? null : { to: stepUrl(3, projectId), label: 'Anterior · Paso 3' }} note={running ? 'Entrenando en el navegador…' : undefined}>
      <button className="primary" disabled={running || !state.runs.length} onClick={() => navigate(stepUrl(5, projectId))}>Siguiente · Paso 5</button>
    </StepActions>
  </>
}

export default function TrainStep() { return <TrainingPage step={4}>{context => <TrainContent {...context} />}</TrainingPage> }
