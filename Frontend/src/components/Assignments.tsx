import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { CalendarClock, ClipboardList, Plus } from 'lucide-react'
import { api } from '../api/http'
import { useResource } from '../api/useResource'
import { assignmentStates, typeLabel, type Assignment, type AssignmentDetail, type Pending, type SubmissionEntry } from '../api/types'
import { ApiMessage, Page } from './AppShell'

const dateTime = (iso: string) => new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })
// Valor para <input type="datetime-local"> en la hora local del navegador.
const localInput = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const grade = (value: number) => Number.isInteger(value) ? String(value) : value.toFixed(1)
const taskPath = (classroomId: string, id: string) => `/salones/${encodeURIComponent(classroomId)}/tareas/${encodeURIComponent(id)}`
const continuePath = (projectId: string) => '/crear/continuar?project=' + encodeURIComponent(projectId)

function StateTag({ task }: { task: Pick<Assignment, 'state'> }) {
  return <span className={'tag ' + (task.state === 'open' ? 'ok-tag' : task.state === 'upcoming' ? 'info-tag' : 'muted-tag')}>{assignmentStates[task.state]}</span>
}
function studentStatus(task: Assignment) {
  const mine = task.my_submission
  if (mine?.grade !== null && mine?.grade !== undefined) return `Calificada: ${grade(mine.grade)} / ${grade(task.grade_max)}`
  if (mine) return 'Entregada'
  return task.state === 'open' ? 'Pendiente de entrega' : task.state === 'upcoming' ? 'Aún no empieza' : 'Sin entrega'
}

type FormValues = { title: string; description: string; instructions: string; starts_at: string; ends_at: string; grade_min: string; grade_max: string }
function defaults(task?: Assignment): FormValues {
  if (task) return { title: task.title, description: task.description ?? '', instructions: task.instructions ?? '', starts_at: localInput(new Date(task.starts_at)), ends_at: localInput(new Date(task.ends_at)), grade_min: String(task.grade_min), grade_max: String(task.grade_max) }
  const start = new Date(), end = new Date(); end.setDate(end.getDate() + 7); end.setHours(23, 59, 0, 0)
  return { title: '', description: '', instructions: '', starts_at: localInput(start), ends_at: localInput(end), grade_min: '0', grade_max: '20' }
}
/** Formulario de tarea: título, descripción, consigna, fechas y rango de notas (sugerido de 0 a 20). */
function AssignmentForm({ task, submitLabel, onSave, rangeLocked = false }: { task?: Assignment; submitLabel: string; onSave: (body: Record<string, unknown>) => Promise<void>; rangeLocked?: boolean }) {
  const [values, setValues] = useState<FormValues>(() => defaults(task)), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const set = (key: keyof FormValues) => (e: { target: { value: string } }) => setValues(current => ({ ...current, [key]: e.target.value }))
  async function save(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const starts = new Date(values.starts_at), ends = new Date(values.ends_at), min = Number(values.grade_min), max = Number(values.grade_max)
    if (!(ends > starts)) { setError('La fecha de cierre debe ser posterior a la de inicio.'); return }
    if (!(max > min)) { setError('La nota máxima debe ser mayor que la mínima.'); return }
    setBusy(true); setError('')
    try {
      await onSave({ title: values.title.trim(), description: values.description.trim(), instructions: values.instructions.trim(), starts_at: starts.toISOString(), ends_at: ends.toISOString(), ...(rangeLocked ? {} : { grade_min: min, grade_max: max }) })
      if (!task) setValues(defaults())
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return <form className="api-form task-form" onSubmit={save}>
    <label>Título<input required maxLength={180} value={values.title} onChange={set('title')} /></label>
    <label>Descripción<textarea required maxLength={5000} rows={3} value={values.description} onChange={set('description')} placeholder="De qué trata la tarea." /></label>
    <label>Consigna<textarea required maxLength={5000} rows={4} value={values.instructions} onChange={set('instructions')} placeholder="Qué debe hacer y entregar el alumno." /></label>
    <div className="task-form-row">
      <label>Fecha de inicio<input required type="datetime-local" value={values.starts_at} onChange={set('starts_at')} /></label>
      <label>Fecha de cierre<input required type="datetime-local" value={values.ends_at} onChange={set('ends_at')} /></label>
    </div>
    <div className="task-form-row">
      <label>Nota mínima<input required type="number" min={0} max={1000} step={0.1} value={values.grade_min} onChange={set('grade_min')} disabled={rangeLocked} /></label>
      <label>Nota máxima<input required type="number" min={0} max={1000} step={0.1} value={values.grade_max} onChange={set('grade_max')} disabled={rangeLocked} /></label>
    </div>
    {rangeLocked && <p className="field-note">El rango de notas no se puede cambiar porque ya hay entregas calificadas.</p>}
    <button className="primary" disabled={busy || !values.title.trim() || !values.description.trim() || !values.instructions.trim()}>{busy ? 'Guardando…' : submitLabel}</button>
    <ApiMessage error={error} />
  </form>
}

/** Sección «Tareas» del detalle del salón. */
export function ClassroomAssignments({ classroomId, manage, active }: { classroomId: string; manage: boolean; active: boolean }) {
  const tasks = useResource<Assignment[]>('/classrooms/' + encodeURIComponent(classroomId) + '/assignments')
  return <section className="panel resource-detail"><h2><ClipboardList size={20} /> Tareas</h2>
    {manage && active && <details className="task-create"><summary><Plus size={16} /> Nueva tarea</summary>
      <AssignmentForm submitLabel="Crear tarea" onSave={async body => { await api.request('/classrooms/' + encodeURIComponent(classroomId) + '/assignments', { method: 'POST', body }); tasks.reload() }} />
    </details>}
    <ApiMessage {...tasks} retry={tasks.reload} />
    {tasks.data?.length === 0 && <p>{manage ? 'Aún no hay tareas. Crea la primera con «Nueva tarea».' : 'Este salón todavía no tiene tareas.'}</p>}
    <ul className="task-list">{tasks.data?.map(task => <li key={task.id}><Link className="task-card" to={taskPath(classroomId, task.id)}>
      <span className="task-card-title"><strong>{task.title}</strong><StateTag task={task} /></span>
      <small><CalendarClock size={14} /> {dateTime(task.starts_at)} – {dateTime(task.ends_at)} · Nota de {grade(task.grade_min)} a {grade(task.grade_max)}</small>
      <small>{task.counts ? `Entregas ${task.counts.submitted} de ${task.counts.students} · Calificadas ${task.counts.graded}` : studentStatus(task)}</small>
    </Link></li>)}</ul>
  </section>
}

function GradeForm({ entry, task, onSaved }: { entry: SubmissionEntry; task: AssignmentDetail; onSaved: (next: AssignmentDetail) => void }) {
  const sub = entry.submission!
  const [value, setValue] = useState(sub.grade === null ? '' : String(sub.grade)), [feedback, setFeedback] = useState(sub.feedback ?? '')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  async function save(e: FormEvent) {
    e.preventDefault()
    const number = Number(value)
    if (value === '' || number < task.grade_min || number > task.grade_max) { setError(`La nota debe estar entre ${grade(task.grade_min)} y ${grade(task.grade_max)}.`); return }
    setBusy(true); setError('')
    try { onSaved(await api.request<AssignmentDetail>(`/assignments/${encodeURIComponent(task.id)}/submissions/${encodeURIComponent(entry.student.id)}/grade`, { method: 'PUT', body: { grade: number, ...(feedback.trim() ? { feedback: feedback.trim() } : {}) } })) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return <form className="grade-form" onSubmit={save}>
    <label>{`Nota (${grade(task.grade_min)} a ${grade(task.grade_max)})`}<input required type="number" min={task.grade_min} max={task.grade_max} step={0.1} value={value} onChange={e => setValue(e.target.value)} aria-label={'Nota de ' + entry.student.display_name} /></label>
    <label>Comentario (opcional)<input maxLength={2000} value={feedback} onChange={e => setFeedback(e.target.value)} /></label>
    <button className="primary" disabled={busy || value === '' || task.classroom.status !== 'active'}>{busy ? 'Guardando…' : sub.grade === null ? 'Guardar nota' : 'Actualizar nota'}</button>
    <ApiMessage error={error} />
  </form>
}

function TeacherView({ task, setTask, reload }: { task: AssignmentDetail; setTask: (next: AssignmentDetail) => void; reload: () => void }) {
  const navigate = useNavigate(), entries = task.submissions ?? [], active = task.classroom.status === 'active'
  const submitted = entries.filter(entry => entry.submission), graded = submitted.filter(entry => entry.submission!.grade !== null)
  const [error, setError] = useState('')
  async function remove() {
    if (!window.confirm('Se eliminará la tarea. ¿Continuar?')) return
    try { await api.request('/assignments/' + encodeURIComponent(task.id), { method: 'DELETE' }); navigate('/salones/' + encodeURIComponent(task.classroom_id)) }
    catch (err) { setError((err as Error).message) }
  }
  return <>
    <section className="panel resource-detail"><h2>Entregas</h2>
      <p>{submitted.length} de {entries.filter(entry => entry.enrolled).length} alumnos entregaron · {graded.length} calificadas.</p>
      {!entries.length && <p>Este salón todavía no tiene alumnos matriculados.</p>}
      <ul className="submission-list">{entries.map(entry => <li key={entry.student.id}>
        <div className="submission-head"><strong>{entry.student.display_name}</strong><small>{entry.student.username}{entry.enrolled ? '' : ' · ya no está matriculado'}</small>
          <span className={'tag ' + (!entry.submission ? 'muted-tag' : entry.submission.grade === null ? 'info-tag' : 'ok-tag')}>{!entry.submission ? 'Sin entrega' : entry.submission.grade === null ? 'Por calificar' : `Nota: ${grade(entry.submission.grade)}`}</span></div>
        {entry.submission && <>
          <p className="submission-meta">Proyecto: <strong>{entry.submission.project?.title ?? 'No disponible'}</strong>{entry.submission.project && <> · {typeLabel(entry.submission.project.project_type)}</>}
            {' · '}{entry.submission.run_number ? `Entrenamiento ${entry.submission.run_number}${entry.submission.test_accuracy !== null ? ` (accuracy de prueba ${(entry.submission.test_accuracy * 100).toFixed(1)} %)` : ''}` : 'Sin entrenamientos'}
            {' · '}Entregado el {dateTime(entry.submission.submitted_at)}</p>
          {entry.submission.comment && <p className="submission-comment">«{entry.submission.comment}»</p>}
          <Link className="secondary button-link" to={continuePath(entry.submission.project_id)}>Ver proyecto</Link>
          <GradeForm key={entry.submission.graded_at ?? entry.submission.submitted_at} entry={entry} task={task} onSaved={setTask} />
        </>}
      </li>)}</ul>
    </section>
    {active && <details className="panel resource-detail"><summary>Editar tarea</summary>
      <AssignmentForm task={task} submitLabel="Guardar cambios" rangeLocked={graded.length > 0} onSave={async body => { await api.request('/assignments/' + encodeURIComponent(task.id), { method: 'PATCH', body }); reload() }} />
      {!submitted.length && <button className="secondary danger-text" onClick={() => void remove()}>Eliminar tarea</button>}
      <ApiMessage error={error} />
    </details>}
  </>
}

function StudentView({ task, setTask }: { task: AssignmentDetail; setTask: (next: AssignmentDetail) => void }) {
  const sub = task.submission ?? null, projects = (task.projects ?? []).filter(project => project.status !== 'archived')
  const [projectId, setProjectId] = useState(sub?.project_id ?? projects[0]?.id ?? ''), [comment, setComment] = useState(sub?.comment ?? '')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const canSubmit = task.state === 'open' && task.classroom.status === 'active' && (!sub || sub.grade === null)
  const submittedProject = task.projects?.find(project => project.id === sub?.project_id)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!projectId || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      setTask(await api.request<AssignmentDetail>('/assignments/' + encodeURIComponent(task.id) + '/submission', { method: 'PUT', body: { project_id: projectId, ...(comment.trim() ? { comment: comment.trim() } : {}) } }))
      setNotice('Entrega guardada.')
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="panel resource-detail"><h2>Mi entrega</h2>
    {sub && <div className={sub.grade === null ? 'training-note' : 'training-success task-grade'}>
      {sub.grade !== null && <p className="task-grade-value">Nota: <strong>{grade(sub.grade)}</strong> / {grade(task.grade_max)}</p>}
      {sub.feedback && <p>Comentario del docente: «{sub.feedback}»</p>}
      <p>Entregaste <strong>{submittedProject?.title ?? 'tu proyecto'}</strong>{sub.run_number ? ` (entrenamiento ${sub.run_number})` : ''} · {dateTime(sub.submitted_at)}</p>
      {sub.grade === null && <p>Puedes cambiar la entrega hasta el cierre mientras no tenga nota.</p>}
      <Link to={continuePath(sub.project_id)}>Abrir proyecto</Link>
    </div>}
    {task.state === 'upcoming' && <p>La tarea empieza el {dateTime(task.starts_at)}.</p>}
    {task.state === 'closed' && !sub && <p>La tarea cerró sin entrega.</p>}
    {canSubmit && <>
      {projects.length ? <form className="api-form" onSubmit={submit}>
        <label>Proyecto a entregar<select required value={projectId} onChange={e => setProjectId(e.target.value)}>{projects.map(project => <option key={project.id} value={project.id}>{project.title} · {typeLabel(project.project_type)}</option>)}</select></label>
        <label>Descripción de la entrega (opcional)<textarea maxLength={1000} rows={3} value={comment} onChange={e => setComment(e.target.value)} placeholder="Cuenta qué hiciste o qué descubriste." /></label>
        <button className="primary" disabled={busy || !projectId}>{busy ? 'Guardando…' : sub ? 'Actualizar entrega' : 'Entregar proyecto'}</button>
      </form> : <p>Aún no tienes proyectos en este salón.</p>}
      <Link className="secondary button-link" to={'/crear?salon=' + encodeURIComponent(task.classroom_id)}><Plus size={16} /> Crear proyecto para esta tarea</Link>
    </>}
    <ApiMessage error={error} />{notice && <p role="status">{notice}</p>}
  </section>
}

/** Página de una tarea: el docente revisa y califica; el alumno entrega su proyecto. */
export function AssignmentPage() {
  const { id = '', taskId = '' } = useParams()
  const result = useResource<AssignmentDetail>('/assignments/' + encodeURIComponent(taskId))
  const [override, setOverride] = useState<AssignmentDetail | null>(null)
  const task = override?.id === result.data?.id && override ? override : result.data
  return <Page><Link className="back-link" to={'/salones/' + encodeURIComponent(id)}>← Volver al salón</Link>
    <ApiMessage {...result} retry={result.reload} />
    {task && <>
      <section className="panel resource-detail task-header">
        <span className="eyebrow">TAREA · {task.classroom.name.toUpperCase()}</span>
        <h1>{task.title}</h1>
        <p className="task-meta"><StateTag task={task} /> <span><CalendarClock size={15} /> Inicio: {dateTime(task.starts_at)} · Cierre: {dateTime(task.ends_at)}</span> <span>Nota de {grade(task.grade_min)} a {grade(task.grade_max)}</span></p>
        {task.classroom.status !== 'active' && <p className="training-warning">El salón está archivado: la tarea queda en solo lectura.</p>}
        {task.description !== null ? <><h2>Descripción</h2><p className="task-text">{task.description}</p><h2>Consigna</h2><p className="task-text">{task.instructions}</p></>
          : <p>La descripción y la consigna estarán disponibles cuando empiece la tarea.</p>}
      </section>
      {task.manage ? <TeacherView task={task} setTask={setOverride} reload={() => { setOverride(null); result.reload() }} /> : <StudentView key={task.submission?.submitted_at ?? 'nueva'} task={task} setTask={setOverride} />}
    </>}
  </Page>
}

/** Pendientes en Inicio: tareas por entregar (alumno) o entregas por calificar (docente y administrador). */
export function PendingPanel({ role }: { role: string }) {
  const pending = useResource<Pending>('/assignments/pending')
  const student = role === 'student', items = student ? pending.data?.tasks : pending.data?.to_grade
  return <section className="panel resource-detail pending-panel">
    <h2><ClipboardList size={20} /> {student ? 'Tareas pendientes' : 'Entregas por calificar'}</h2>
    <ApiMessage {...pending} retry={pending.reload} />
    {items?.length === 0 && <p>{student ? 'No tienes tareas pendientes.' : 'No hay entregas por calificar.'}</p>}
    <ul className="task-list">{items?.map(task => <li key={task.id}><Link className="task-card" to={taskPath(task.classroom_id, task.id)}>
      <span className="task-card-title"><strong>{task.title}</strong>{!student && <span className="tag info-tag">{task.ungraded} por calificar</span>}</span>
      <small>{task.classroom_name} · Cierra: {dateTime(task.ends_at)}</small>
    </Link></li>)}</ul>
  </section>
}
