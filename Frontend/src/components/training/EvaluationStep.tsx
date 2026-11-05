import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import JSZip from 'jszip'
import { backendLabels, formatDuration } from '../../training/hardware'
import { modelSizes } from '../../training/model'
import { datasetBlob } from '../../training/storage'
import { isLegacy, percent, type Misclassified, type RunMetrics, type TrainingRun } from '../../training/types'
import { Bar, MetricChart } from './charts'
import { EpochTable } from './TrainStep'
import { StepActions, stepUrl, TrainingHeading, TrainingPage, type StepContext } from './TrainingLayout'

export function diagnose(m: RunMetrics) {
  if (m.train_accuracy < 0.7) return { ok: false, title: 'Entrenamiento insuficiente', text: `La CNN acierta ${percent(m.train_accuracy)} con los datos de entrenamiento: todavía no aprende bien ni con los ejemplos que ya vio.`, tips: ['Aumenta las épocas.', 'Prueba una CNN más grande.', 'Prueba un learning rate mayor.'] }
  if (m.train_accuracy - m.test_accuracy > 0.15) return { ok: false, title: 'Posible sobreajuste', text: `La CNN acierta ${percent(m.train_accuracy)} con los datos de entrenamiento, pero ${percent(m.test_accuracy)} con los de prueba: memoriza los ejemplos en lugar de generalizar.`, tips: ['Agrega más ejemplos y más variados.', 'Reduce las épocas.', 'Prueba una CNN más pequeña.'] }
  if (m.test_accuracy >= 0.8) return { ok: true, title: 'Buen resultado', text: `La CNN acierta ${percent(m.test_accuracy)} con datos que no vio durante el entrenamiento.`, tips: ['Prueba el modelo con ejemplos nuevos en el paso 6.'] }
  return { ok: false, title: 'Resultado mejorable', text: `La CNN aprendió, pero con los datos de prueba acierta ${percent(m.test_accuracy)}.`, tips: ['Agrega más ejemplos por categoría.', 'Revisa los ejemplos mal clasificados: alguno podría estar en la categoría equivocada.'] }
}

function Mistakes({ projectId, updatedAt, items, sound }: { projectId: string; updatedAt: string; items: Misclassified[]; sound: boolean }) {
  const [urls, setUrls] = useState<Record<string, string>>()
  const files = items.map(item => item.file).join('|')
  useEffect(() => {
    let alive = true; const created: string[] = []
    void (async () => {
      const zip = await JSZip.loadAsync(await (await datasetBlob(projectId, updatedAt)).arrayBuffer()), next: Record<string, string> = {}
      for (const file of items.map(item => item.file)) { const entry = zip.file(file); if (entry) { const url = URL.createObjectURL(await entry.async('blob')); created.push(url); next[file] = url } }
      if (alive) setUrls(next)
    })().catch(() => { if (alive) setUrls({}) })
    return () => { alive = false; created.forEach(url => URL.revokeObjectURL(url)) }
  }, [projectId, updatedAt, files])
  if (!items.length) return <p className="training-note">La CNN no se equivocó con ningún ejemplo de prueba.</p>
  return <ul className="mistakes-grid">{items.map(item => <li key={item.file}>
    {urls?.[item.file] ? sound ? <audio controls src={urls[item.file]} preload="none" /> : <img src={urls[item.file]} alt={item.file} /> : <span className="mistake-placeholder" />}
    <span>Real: <strong>{item.actual}</strong></span><span>Predicción: <strong>{item.predicted}</strong> ({percent(item.confidence, 0)})</span>
    <small>{item.file}</small>
  </li>)}</ul>
}

export function RunHistory({ runs, selected, onSelect }: { runs: TrainingRun[]; selected: number; onSelect: (run: number) => void }) {
  return <div className="table-scroll"><table className="training-table history-table">
    <thead><tr><th>N.º</th><th>Fecha</th><th>Épocas</th><th>Learning rate</th><th>Batch</th><th>CNN</th><th>Equipo</th><th>Duración</th><th>Accuracy entrenamiento</th><th>Accuracy prueba</th><th></th></tr></thead>
    <tbody>{[...runs].reverse().map(run => <tr key={run.run_number} className={run.run_number === selected ? 'selected' : ''}>
      <td>{run.run_number}</td><td>{new Date(run.created_at).toLocaleString('es')}</td><td>{run.config.epochs}</td><td>{run.config.learning_rate}</td><td>{run.config.batch_size}</td>
      <td>{modelSizes[run.config.model_size]?.label ?? run.config.model_size}</td><td>{run.hardware.backend ? backendLabels[run.hardware.backend] ?? run.hardware.backend : '—'}</td>
      <td>{run.duration_ms ? formatDuration(run.duration_ms) : '—'}</td>
      <td>{isLegacy(run.metrics) ? '—' : percent(run.metrics.train_accuracy)}</td><td>{percent(run.metrics.test_accuracy)}</td>
      <td>{run.run_number === selected ? <span className="tag ok-tag">Viendo</span> : <button type="button" className="secondary small" onClick={() => onSelect(run.run_number)}>Ver</button>}</td>
    </tr>)}</tbody>
  </table></div>
}

function EvaluationContent({ projectId, project, state }: StepContext) {
  const navigate = useNavigate(), runs = state.runs
  const [selected, setSelected] = useState(runs.at(-1)?.run_number ?? 0)
  const run = runs.find(item => item.run_number === selected) ?? runs.at(-1)
  if (!run) return <section className="panel empty-state"><h1>Aún no hay entrenamientos</h1><Link to={stepUrl(4, projectId)}>Entrenar modelo</Link></section>
  const metrics = run.metrics, legacy = isLegacy(metrics)
  const advice = legacy ? null : diagnose(metrics)
  const confusions = legacy ? [] : metrics.confusion.flatMap((row, i) => row.map((count, j) => ({ actual: metrics.labels[i], predicted: metrics.labels[j], count, same: i === j })))
    .filter(cell => !cell.same && cell.count > 0).sort((a, b) => b.count - a.count).slice(0, 3)
  const maxCell = legacy ? 1 : Math.max(1, ...metrics.confusion.flat())
  return <>
    <TrainingHeading step="PASO 5 · EVALUACIÓN" title="Resultados con el conjunto de prueba" project={project}>
      <p className="training-meta">Entrenamiento {run.run_number} de {runs.length} · {run.config.epochs} épocas · learning rate {run.config.learning_rate} · batch size {run.config.batch_size} · CNN {(modelSizes[run.config.model_size]?.label ?? run.config.model_size).toLowerCase()}</p>
    </TrainingHeading>
    <div className="training-grid">
      <section className="panel training-card result-card">
        <h2>Accuracy de prueba</h2>
        <strong className="big-number">{percent(metrics.test_accuracy)}</strong>
        {legacy ? <p>Loss de prueba: {metrics.test_loss.toFixed(4)}</p> : <>
          <p>Acertó {metrics.test_correct} de {metrics.test_total} ejemplos de prueba · Loss de prueba {metrics.test_loss.toFixed(4)}</p>
          <p>Accuracy de entrenamiento: {percent(metrics.train_accuracy)} · Loss de entrenamiento {metrics.train_loss.toFixed(4)}</p>
          {metrics.test_total < 10 && <p className="training-note">El conjunto de prueba es pequeño ({metrics.test_total} ejemplos): cada error cambia mucho el porcentaje.</p>}
        </>}
      </section>
      <section className="panel training-card">
        {advice ? <div className={advice.ok ? 'training-success' : 'training-alert soft'}>
          {advice.ok ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
          <div><strong>{advice.title}</strong><p>{advice.text}</p><ul>{advice.tips.map(tip => <li key={tip}>{tip}</li>)}</ul></div>
        </div> : <p className="training-note">Este entrenamiento se hizo con el flujo anterior: no tiene resultados por categoría ni ejemplos mal clasificados. Entrena de nuevo para verlos.</p>}
      </section>
    </div>
    {!legacy && <div className="training-grid">
      <section className="panel training-card">
        <h2>Accuracy por categoría</h2>
        <ul className="category-bars">{metrics.per_class.map(row => <li key={row.label}>
          <span>{row.label}</span><Bar value={row.total ? row.correct / row.total : 0} /><strong>{row.correct}/{row.total}</strong>
        </li>)}</ul>
      </section>
      <section className="panel training-card">
        <h2>Matriz de confusión</h2>
        <p>Filas: categoría real. Columnas: categoría que predijo la CNN.</p>
        <div className="table-scroll"><table className="confusion-table">
          <thead><tr><th scope="col">Real \ Predicción</th>{metrics.labels.map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{metrics.confusion.map((row, i) => <tr key={metrics.labels[i]}><th scope="row">{metrics.labels[i]}</th>{row.map((count, j) =>
            <td key={j} className={i === j ? 'diagonal' : count ? 'error' : ''} style={{ ['--strength' as string]: count / maxCell }}>{count}</td>)}</tr>)}</tbody>
        </table></div>
        {confusions.length > 0 && <ul className="confusion-summary">{confusions.map(c => <li key={c.actual + c.predicted}>{c.actual} se confundió con {c.predicted} {c.count === 1 ? '1 vez' : `${c.count} veces`}</li>)}</ul>}
      </section>
    </div>}
    {!legacy && <section className="panel training-card">
      <h2>Ejemplos mal clasificados</h2>
      <p>Ejemplos de prueba en los que la CNN se equivocó, con la confianza de su predicción.</p>
      <Mistakes projectId={projectId} updatedAt={state.dataset!.updated_at} items={metrics.misclassified.slice(0, 12)} sound={state.project_type === 'sound_recognition'} />
    </section>}
    <section className="panel training-card">
      <h2>Métricas por época · entrenamiento {run.run_number}</h2>
      <div className="chart-row">
        <MetricChart title="Accuracy" history={run.history} metric="accuracy" epochs={run.config.epochs} format={value => Math.round(value * 100) + ' %'} color="#0f62fe" />
        <MetricChart title="Loss" history={run.history} metric="loss" epochs={run.config.epochs} format={value => value.toFixed(2)} color="#da1e28" />
      </div>
      <details><summary>Ver tabla por época</summary><EpochTable history={run.history} /></details>
    </section>
    <section className="panel training-card">
      <h2>Historial de entrenamientos</h2>
      <p>Cada entrenamiento guarda su configuración, el equipo usado y sus resultados. El paso 6 usa el modelo del último.</p>
      <RunHistory runs={runs} selected={run.run_number} onSelect={setSelected} />
    </section>
    <StepActions back={{ to: stepUrl(4, projectId), label: 'Anterior · Paso 4' }}>
      {state.editable && <button className="secondary" onClick={() => navigate(stepUrl(3, projectId))}>Cambiar configuración y volver a entrenar</button>}
      <button className="primary" onClick={() => navigate(stepUrl(6, projectId))}>Siguiente · Paso 6</button>
    </StepActions>
  </>
}

export default function EvaluationStep() { return <TrainingPage step={5}>{context => <EvaluationContent {...context} />}</TrainingPage> }
