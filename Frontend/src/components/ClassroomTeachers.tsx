import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { Users } from 'lucide-react'
import { api } from '../api/http'
import { useResource } from '../api/useResource'
import type { Classroom, ClassroomTeacher, Teacher } from '../api/types'
import { ApiMessage } from './AppShell'

/**
 * Docentes del salón. Todos gestionan alumnos, tareas y notas; el responsable y el
 * administrador agregan o quitan docentes, y un docente adicional puede salir del salón.
 */
export function ClassroomTeachers({ room, staff, reload, userId, canAssign }: {
  room: Classroom; staff: ClassroomTeacher[]; reload: () => void; userId: string; canAssign: boolean
}) {
  const navigate = useNavigate(), active = room.status === 'active'
  const eligible = useResource<Teacher[]>(canAssign && active ? `/classrooms/${encodeURIComponent(room.id)}/eligible-teachers?limit=100&offset=0` : null)
  const [teacherId, setTeacherId] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  async function add(e: FormEvent) {
    e.preventDefault()
    if (!teacherId || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.request(`/classrooms/${encodeURIComponent(room.id)}/teachers`, { method: 'POST', body: { teacher_id: teacherId } })
      setTeacherId(''); setNotice('Docente agregado al salón.'); reload(); eligible.reload()
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  async function remove(teacher: ClassroomTeacher) {
    const self = teacher.id === userId
    if (!window.confirm(self ? 'Dejarás de ver los alumnos, las tareas y los proyectos de este salón. ¿Salir del salón?' : `¿Quitar a ${teacher.display_name} del salón?`)) return
    setBusy(true); setError(''); setNotice('')
    try {
      await api.request(`/classrooms/${encodeURIComponent(room.id)}/teachers/${encodeURIComponent(teacher.id)}`, { method: 'DELETE' })
      if (self) { navigate('/salones'); return }
      setNotice('Docente quitado del salón.'); reload(); eligible.reload()
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return <section className="panel resource-detail">
    <h2><Users size={20} /> Docentes del salón</h2>
    <p>Todos los docentes del salón gestionan sus alumnos, tareas y notas. El responsable y un administrador agregan o quitan docentes.</p>
    <ul className="roster-list">{staff.map(teacher => <li key={teacher.id}>
      <span><strong>{teacher.display_name}</strong><small>{teacher.username} · {teacher.responsible ? 'Responsable' : 'Docente adicional'}</small></span>
      {!teacher.responsible && (canAssign || teacher.id === userId) && <div>
        <button className="secondary" disabled={busy} onClick={() => void remove(teacher)}>{teacher.id === userId ? 'Salir del salón' : 'Quitar del salón'}</button>
      </div>}
    </li>)}</ul>
    {canAssign && active && <form className="api-form" onSubmit={add}>
      <label>Docente<select required value={teacherId} onChange={e => setTeacherId(e.target.value)}>
        <option value="">Selecciona un docente activo</option>
        {eligible.data?.map(teacher => <option key={teacher.id} value={teacher.id}>{teacher.display_name} · {teacher.username}</option>)}
      </select></label>
      <button className="primary" disabled={busy || !teacherId}>Agregar docente</button>
    </form>}
    {canAssign && active && eligible.data?.length === 0 && <p>No hay otros docentes activos para agregar.</p>}
    <ApiMessage {...eligible} retry={eligible.reload} />
    <ApiMessage error={error} />{notice && <p role="status">{notice}</p>}
  </section>
}
