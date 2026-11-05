import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router'
import { Check } from 'lucide-react'
import { useResource } from '../../api/useResource'
import { typeLabel, type Project } from '../../api/types'
import { ApiMessage, Header, Page } from '../AppShell'
import type { TrainingState } from '../../training/types'

export const stepPaths = ['/crear', '/crear/datos', '/crear/preparacion', '/crear/configuracion', '/crear/entrenar', '/crear/evaluar', '/crear/probar']
const stepNames = ['Proyecto', 'Datos', 'Preparación', 'Configuración', 'Entrenar', 'Evaluar', 'Probar']
/**
 * Tarea desde la que se abrió el proyecto (parámetro `volver`). Solo se aceptan rutas de tareas,
 * así el enlace nunca sale de la app.
 */
export function returnTask(search: string) {
  const to = new URLSearchParams(search).get('volver')
  return to && /^\/salones\/[^/?#]+\/tareas\/[^/?#]+$/.test(to) ? to : null
}
/** El origen viaja con el proyecto al moverse entre sus pasos; no pasa a otro proyecto. */
function carryReturn(id: string) {
  const search = window.location.search, to = returnTask(search)
  return to && new URLSearchParams(search).get('project') === id ? '&volver=' + encodeURIComponent(to) : ''
}
export const stepUrl = (step: number, id: string) => stepPaths[step] + '?project=' + encodeURIComponent(id) + carryReturn(id)
/** Último paso al que se puede entrar: con un entrenamiento guardado se habilitan Evaluar y Probar. */
export const reachedStep = (state: TrainingState) => state.step >= 5 ? 6 : state.step
export const trainingPath = (id: string) => `/projects/${encodeURIComponent(id)}/training`

export function useProjectId() { return new URLSearchParams(useLocation().search).get('project') }

export function TrainingStepper({ projectId, current, state, locked = false }: { projectId: string; current: number; state: TrainingState | null; locked?: boolean }) {
  const reached = state ? reachedStep(state) : 1, completed = reached
  const nav = useRef<HTMLElement>(null)
  // En pantallas angostas, el paso actual queda centrado y visible.
  useEffect(() => {
    const box = nav.current, item = box?.querySelector<HTMLElement>('li.active')
    if (box && item && box.scrollWidth > box.clientWidth) box.scrollLeft = item.offsetLeft - (box.clientWidth - item.offsetWidth) / 2
  }, [current])
  return <nav ref={nav} className="training-stepper" aria-label="Pasos del proyecto"><ol>
    {stepNames.map((name, i) => {
      const done = i < completed, active = i === current
      const content = <><span className="training-step-number">{done && !active ? <Check size={13} aria-label="completado" /> : i}</span><span className="training-step-name">{name}</span></>
      const href = i === 0 ? '/proyectos/' + encodeURIComponent(projectId) : stepUrl(i, projectId)
      return <li key={name} className={(active ? 'active ' : '') + (done ? 'done ' : '') + (i > reached ? 'blocked' : '')}>
        {!active && !locked && i <= reached ? <Link to={href}>{content}</Link> : <span aria-current={active ? 'step' : undefined} aria-disabled={!active || undefined}>{content}</span>}
      </li>
    })}
  </ol></nav>
}

export function TrainingHeading({ step, title, project, children }: { step: string; title: string; project: Project; children?: ReactNode }) {
  return <div className="dataset-heading training-heading">
    <span className="eyebrow">{step}</span><h1>{title}</h1>
    <p><strong>{project.title}</strong> · {typeLabel(project.project_type)}</p>
    {children}
  </div>
}

export type StepContext = {
  projectId: string; project: Project; state: TrainingState
  setState: (state: TrainingState) => void; reload: () => void; setLocked: (locked: boolean) => void
}

/** Carga el proyecto y su estado de entrenamiento; si el paso aún no se alcanzó, redirige al que corresponde. */
export function TrainingPage({ step, children }: { step: number; children: (context: StepContext) => ReactNode }) {
  const projectId = useProjectId()
  const project = useResource<Project>(projectId ? '/projects/' + encodeURIComponent(projectId) : null)
  const training = useResource<TrainingState>(projectId ? trainingPath(projectId) : null)
  const [state, setState] = useState<TrainingState | null>(null), [locked, setLocked] = useState(false)
  useEffect(() => { setState(training.data) }, [training.data])
  if (!projectId) return <Page><section className="panel empty-state"><h1>Selecciona un proyecto</h1><Link to="/proyectos">Ir a proyectos</Link></section></Page>
  const reload = () => { project.reload(); training.reload() }
  if (project.error || training.error) return <Page><ApiMessage error={project.error || training.error} retry={reload} /></Page>
  if (project.loading || training.loading || !project.data || !state) return <Page><ApiMessage loading /></Page>
  const reached = reachedStep(state)
  if (step > reached) return <Navigate to={stepUrl(reached, projectId)} replace />
  return <>
    <Header />
    <TrainingStepper projectId={projectId} current={step} state={state} locked={locked} />
    <main className="page training-page">{children({ projectId, project: project.data, state, setState, reload: training.reload, setLocked })}</main>
  </>
}

/** Abre el proyecto en el último paso alcanzado. */
export function ContinueProject() {
  const projectId = useProjectId()
  const training = useResource<TrainingState>(projectId ? trainingPath(projectId) : null)
  if (!projectId) return <Navigate to="/proyectos" replace />
  if (training.error) return <Page><ApiMessage error={training.error} retry={training.reload} /></Page>
  if (!training.data) return <Page><ApiMessage loading /></Page>
  return <Navigate to={stepUrl(training.data.step, projectId)} replace />
}

/** Salida del proyecto: vuelve a la tarea si se abrió desde una entrega; si no, a Proyectos. */
export function ReturnLink({ className = 'secondary' }: { className?: string }) {
  const to = returnTask(useLocation().search)
  return <Link className={className + ' button-link'} to={to ?? '/proyectos'}>{to ? 'Volver a la tarea' : 'Ir a proyectos'}</Link>
}

export function StepActions({ back, children, note }: { back?: { to: string; label: string } | null; children?: ReactNode; note?: ReactNode }) {
  return <div className="dataset-save-row training-actions">
    <p>{note}</p>
    <div className="training-actions-buttons">
      {back && <Link className="secondary button-link" to={back.to}>{back.label}</Link>}
      {children}
    </div>
  </div>
}
