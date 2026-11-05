import { useState, type FormEvent } from 'react'
import { api } from '../api/http'
import { ApiMessage } from './AppShell'

const tooLong = (password: string) => new TextEncoder().encode(password).length > 72

/** Alta del alumno en un paso. Con salón, el alumno queda matriculado (obligatorio para docentes). */
export function StudentForm({ classroomId, onCreated }: { classroomId?: string; onCreated: () => void }) {
  const [username, setUsername] = useState(''), [name, setName] = useState(''), [password, setPassword] = useState('')
  const [guardian, setGuardian] = useState(''), [authorized, setAuthorized] = useState(false), [requireChange, setRequireChange] = useState(true)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  async function create(e: FormEvent) {
    e.preventDefault()
    if (busy || !authorized) return
    if (tooLong(password)) { setError('La contraseña no debe superar 72 bytes.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      await api.request('/students', { method: 'POST', body: {
        username: username.trim(), display_name: name.trim(), password, guardian_authorized: true,
        ...(guardian.trim() ? { guardian_name: guardian.trim() } : {}), require_password_change: requireChange, ...(classroomId ? { classroom_id: classroomId } : {})
      } })
      setUsername(''); setName(''); setGuardian(''); setAuthorized(false); setRequireChange(true)
      setNotice(classroomId ? 'Alumno creado y matriculado.' : 'Alumno creado.'); onCreated()
    } catch (err) { setError((err as Error).message) }
    finally { setPassword(''); setBusy(false) }
  }
  return <form className="api-form" onSubmit={create}>
    <label>Usuario<input required pattern="[A-Za-z0-9_.-]{3,64}" maxLength={64} value={username} onChange={e => setUsername(e.target.value)} autoComplete="off" /></label>
    <label>Nombre visible<input required maxLength={120} value={name} onChange={e => setName(e.target.value)} /></label>
    <label>Contraseña inicial<input type="password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></label>
    <label>Nombre del padre, madre o tutor (opcional)<input maxLength={120} value={guardian} onChange={e => setGuardian(e.target.value)} /></label>
    <label className="check-label"><span><input type="checkbox" required checked={authorized} onChange={e => setAuthorized(e.target.checked)} /> Cuento con la autorización del padre, madre o tutor para crear esta cuenta.</span></label>
    <label className="check-label"><span><input type="checkbox" checked={requireChange} onChange={e => setRequireChange(e.target.checked)} /> Pedir que cambie la contraseña al ingresar.</span></label>
    <p>La cuenta queda activa{classroomId ? ' y matriculada en este salón' : ''}. La autorización queda registrada.</p>
    <button className="primary" disabled={busy || !name.trim() || !authorized}>{busy ? 'Creando…' : 'Crear alumno'}</button>
    <ApiMessage error={error} />{notice && <p role="status">{notice}</p>}
  </form>
}

/** Restablecer la contraseña de otra cuenta (docente → sus alumnos; administrador → cualquiera). */
export function PasswordReset({ userId, name, onClose }: { userId: string; name: string; onClose: () => void }) {
  const [password, setPassword] = useState(''), [requireChange, setRequireChange] = useState(true)
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  async function reset(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    if (tooLong(password)) { setError('La contraseña no debe superar 72 bytes.'); return }
    setBusy(true); setError(''); setNotice('')
    try {
      await api.request('/users/' + encodeURIComponent(userId) + '/password', { method: 'POST', body: { password, require_password_change: requireChange } })
      setNotice('Contraseña restablecida. Las sesiones abiertas de esta cuenta se cerraron.')
    } catch (err) { setError((err as Error).message) }
    finally { setPassword(''); setBusy(false) }
  }
  return <section className="panel resource-detail"><h2>Restablecer contraseña de {name}</h2>
    <form className="api-form" onSubmit={reset}>
      <label>Nueva contraseña<input type="password" required minLength={12} maxLength={72} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></label>
      <label className="check-label"><span><input type="checkbox" checked={requireChange} onChange={e => setRequireChange(e.target.checked)} /> Pedir que la cambie al ingresar.</span></label>
      <button className="primary" disabled={busy || password.length < 12}>{busy ? 'Guardando…' : 'Restablecer contraseña'}</button>
    </form>
    <ApiMessage error={error} />{notice && <p role="status">{notice}</p>}
    <button className="secondary" onClick={onClose}>Cerrar</button>
  </section>
}
