import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { Cpu, RotateCcw } from 'lucide-react'
import { api } from '../../api/http'
import { ApiMessage } from '../AppShell'
import { backendLabels, detectHardware, estimateEpochMs, formatDuration, recommendedConfig, usesGpu } from '../../training/hardware'
import { describeModel, modelSizes } from '../../training/model'
import { splitCounts } from '../../training/split'
import { inputKinds, inputLabels, type Hardware, type ModelSize, type TrainingConfig } from '../../training/types'
import { StepActions, stepUrl, TrainingHeading, TrainingPage, trainingPath, type StepContext } from './TrainingLayout'

const learningRates = [0.0003, 0.001, 0.003]
const batchSizes = [8, 16, 32]

export function HardwareList({ hardware }: { hardware: Partial<Hardware> }) {
  return <dl className="hardware-list">
    <div><dt>Backend de TensorFlow.js</dt><dd>{backendLabels[hardware.backend ?? ''] ?? hardware.backend ?? 'No disponible'}</dd></div>
    <div><dt>GPU</dt><dd>{hardware.gpu ?? 'No disponible'}</dd></div>
    <div><dt>Núcleos de CPU</dt><dd>{hardware.cores ?? 'No disponible'}</dd></div>
    <div><dt>Memoria aproximada</dt><dd>{hardware.memory_gb ? `${hardware.memory_gb} GB` : 'No disponible'}</dd></div>
  </dl>
}

function ConfigurationContent({ projectId, project, state }: StepContext) {
  const navigate = useNavigate(), kind = inputKinds[state.project_type], labels = state.dataset!.labels
  const trainCount = splitCounts(state.dataset!.counts ?? {}, state.preparation!.test_percent).train
  const [hardware, setHardware] = useState<Hardware>(), [config, setConfig] = useState<TrainingConfig | null>(state.config)
  const [estimate, setEstimate] = useState<number | null>(null), [measuring, setMeasuring] = useState(false)
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => {
    let alive = true
    void detectHardware().then(found => { if (!alive) return; setHardware(found); setConfig(current => current ?? recommendedConfig(found)) })
      .catch(() => { if (alive) setError('No se pudo iniciar TensorFlow.js en este navegador.') })
    return () => { alive = false }
  }, [])
  // Mide el equipo con la configuración elegida (unos lotes con datos aleatorios).
  useEffect(() => {
    if (!hardware || !config) return
    let alive = true; setMeasuring(true)
    const timer = setTimeout(() => void estimateEpochMs(kind, labels.length, config, trainCount)
      .then(ms => { if (alive) setEstimate(ms) }).catch(() => { if (alive) setEstimate(null) }).finally(() => { if (alive) setMeasuring(false) }), 250)
    return () => { alive = false; clearTimeout(timer) }
  }, [hardware, config?.model_size, config?.batch_size, kind, labels.length, trainCount]) // eslint-disable-line react-hooks/exhaustive-deps
  const summary = useMemo(() => config ? describeModel(kind, labels.length, config.model_size) : null, [kind, labels.length, config?.model_size]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!hardware || !config) return <><TrainingHeading step="PASO 3 · CONFIGURACIÓN DEL ENTRENAMIENTO" title="Configura el entrenamiento" project={project} /><ApiMessage loading={!error} error={error} /></>
  const recommended = recommendedConfig(hardware), readOnly = !state.editable
  const set = (patch: Partial<TrainingConfig>) => setConfig({ ...config, ...patch })
  const mark = (same: boolean) => same ? <span className="tag ok-tag">Recomendado</span> : null
  async function next() {
    if (readOnly) { navigate(stepUrl(4, projectId)); return }
    setBusy(true); setError('')
    try { await api.request(trainingPath(projectId) + '/config', { method: 'PUT', body: config }); navigate(stepUrl(4, projectId)) }
    catch (e) { setError((e as Error).message); setBusy(false) }
  }
  return <>
    <TrainingHeading step="PASO 3 · CONFIGURACIÓN DEL ENTRENAMIENTO" title="Configura el entrenamiento" project={project} />
    <div className="training-grid">
      <section className="panel training-card">
        <h2>Valores del entrenamiento</h2>
        <p>Los valores recomendados dependen de tu equipo. Puedes cambiarlos y comparar los resultados en el paso 5.</p>
        <fieldset className="config-form" disabled={readOnly}>
          <label>Épocas <output>{config.epochs}</output> {mark(config.epochs === recommended.epochs)}
            <input type="range" min={5} max={30} step={1} value={config.epochs} onChange={e => set({ epochs: Number(e.target.value) })} aria-label="Épocas" />
            <small>Cuántas veces la CNN recorre todos los datos de entrenamiento. De 5 a 30.</small></label>
          <label>Learning rate {mark(config.learning_rate === recommended.learning_rate)}
            <select value={config.learning_rate} onChange={e => set({ learning_rate: Number(e.target.value) })}>{learningRates.map(rate => <option key={rate} value={rate}>{rate}</option>)}</select>
            <small>Tamaño de cada ajuste de los pesos. Si es muy alto el entrenamiento puede ser inestable; si es muy bajo, aprende lento.</small></label>
          <label>Batch size {mark(config.batch_size === recommended.batch_size)}
            <select value={config.batch_size} onChange={e => set({ batch_size: Number(e.target.value) })}>{batchSizes.map(size => <option key={size} value={size}>{size}</option>)}</select>
            <small>Ejemplos que se procesan antes de cada ajuste de los pesos.</small></label>
          <label>Tamaño de la CNN {mark(config.model_size === recommended.model_size)}
            <select value={config.model_size} onChange={e => set({ model_size: e.target.value as ModelSize })}>{(Object.keys(modelSizes) as ModelSize[]).map(size => <option key={size} value={size}>{modelSizes[size].label} ({modelSizes[size].filters.join(' y ')} filtros, {modelSizes[size].dense} neuronas)</option>)}</select>
            <small>Una CNN más grande puede aprender patrones más complejos, pero tarda más y puede memorizar los datos.</small></label>
        </fieldset>
        {!readOnly && <button type="button" className="secondary" onClick={() => setConfig(recommended)}><RotateCcw size={16} /> Restablecer valores recomendados</button>}
        <h3>Valores fijos</h3>
        <dl className="hardware-list">
          <div><dt>Optimizador</dt><dd>Adam</dd></div>
          <div><dt>Función de pérdida</dt><dd>Categorical crossentropy</dd></div>
          <div><dt>Métrica</dt><dd>Accuracy</dd></div>
          <div><dt>Entrada</dt><dd>{inputLabels[kind]}</dd></div>
          <div><dt>Capas</dt><dd>{summary?.layers.join(' → ')}</dd></div>
          <div><dt>Parámetros</dt><dd>{summary?.params.toLocaleString('es')}</dd></div>
        </dl>
      </section>
      <section className="panel training-card">
        <h2><Cpu size={20} /> Tu equipo</h2>
        <HardwareList hardware={hardware} />
        {!usesGpu(hardware) && <p className="training-warning">TensorFlow.js está usando la CPU: el entrenamiento será más lento. Se recomiendan una CNN pequeña y {recommended.epochs} épocas.</p>}
        <dl className="split-summary">
          <div><dt>Tiempo estimado por época</dt><dd>{measuring ? 'Midiendo…' : estimate === null ? 'No disponible' : formatDuration(estimate)}</dd></div>
          <div><dt>Tiempo estimado total</dt><dd>{measuring || estimate === null ? '—' : formatDuration(estimate * config.epochs)}</dd></div>
        </dl>
        {!measuring && estimate !== null && estimate * config.epochs > 5 * 60000 && <p className="training-warning">El entrenamiento podría tardar más de 5 minutos. Prueba con menos épocas o una CNN más pequeña.</p>}
        <p className="dataset-hint">La estimación se mide en este equipo con {trainCount} ejemplos de entrenamiento y no incluye la preparación de los datos.</p>
      </section>
    </div>
    {state.runs.length > 0 && <p className="training-note">Cambiar la configuración no modifica los entrenamientos anteriores; el próximo se guardará como uno nuevo.</p>}
    <ApiMessage error={error} />
    <StepActions back={{ to: stepUrl(2, projectId), label: 'Anterior · Paso 2' }} note={readOnly ? (state.owner ? 'El proyecto o su salón está archivado: queda en solo lectura.' : 'Solo el propietario puede cambiar la configuración.') : 'La configuración se guardará al continuar.'}>
      <button className="primary" disabled={busy || (readOnly && state.step < 4)} onClick={() => void next()}>{busy ? 'Guardando…' : 'Siguiente · Paso 4'}</button>
    </StepActions>
  </>
}

export default function ConfigurationStep() { return <TrainingPage step={3}>{context => <ConfigurationContent {...context} />}</TrainingPage> }
