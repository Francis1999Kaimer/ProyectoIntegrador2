import { useRef, useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { BrainCircuit } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { api } from '../api/http'
import { ApiError } from '../api/client'
export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const sending = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return
    sending.current = true; setBusy(true); setError('')
    try {
      await login(username.trim(), password)
    } catch (e) { setError((e as Error).message) }
    finally { sending.current = false; setBusy(false); setPassword('') }
  }
  return <main className="auth-page"><form className="panel auth-card" onSubmit={submit}>
    <span className="brand"><BrainCircuit size={28}/>AI Blocks Studio</span><h1>Inicia sesión</h1><p>Continúa con tus proyectos y salones.</p>
    <label>Usuario<input autoComplete="username" required maxLength={64} value={username} onChange={e=>setUsername(e.target.value)} /></label>
    <label>Contraseña<input type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} /></label>
    {error && <p role="alert" className="api-error">{error}</p>}
    <button className="primary full" disabled={busy}>{busy ? 'Ingresando…' : 'Ingresar'}</button>
  </form></main>
}
export function PasswordPage() {
  const { logout, user, refresh } = useAuth(), navigate = useNavigate()
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const sending = useRef(false)
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current) return
    if (next !== confirm || next.length < 12 || new TextEncoder().encode(next).length > 72) { setError('Las claves deben coincidir y tener al menos 12 caracteres y como máximo 72 bytes.'); return }
    sending.current = true; setBusy(true); setError('')
    try { await api.request('/auth/change-password', { method: 'POST', invalidateSession: false, body: { current_password: current, new_password: next } }); logout(); navigate('/login', { replace: true }) }
    catch(e) { setError((e as Error).message); if(e instanceof ApiError && e.status===401) await refresh() }
    finally { sending.current = false; setBusy(false); setCurrent(''); setNext(''); setConfirm('') }
  }
  return <main className="auth-page"><form className="panel auth-card" onSubmit={submit}>
    <h1>Cambiar contraseña</h1><p>{user?.must_change_password ? 'Antes de continuar, elige tu propia contraseña.' : 'Al terminar, inicia sesión con tu nueva contraseña.'}</p>
    <label>Contraseña actual<input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)} /></label>
    <label>Nueva contraseña<input type="password" autoComplete="new-password" required minLength={12} maxLength={72} value={next} onChange={e=>setNext(e.target.value)} /></label>
    <label>Confirmar nueva contraseña<input type="password" autoComplete="new-password" required value={confirm} onChange={e=>setConfirm(e.target.value)} /></label>
    {error && <p role="alert" className="api-error">{error}</p>}
    <button className="primary full" disabled={busy}>{busy ? 'Guardando…' : 'Cambiar contraseña'}</button>
    <button type="button" className="secondary full" onClick={logout}>Cerrar sesión</button>
  </form></main>
}
