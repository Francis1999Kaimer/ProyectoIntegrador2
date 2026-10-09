import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import { BrainCircuit } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { api } from '../api/http'
import { ApiError } from '../api/client'

const loginThrottlePrefix = 'aiblocks.login-throttle.'
type LoginThrottle = { failures: number; lockedUntil: number }
function throttleKey(username: string) { return loginThrottlePrefix + encodeURIComponent(username.trim().toLowerCase()) }
function readThrottle(username: string): LoginThrottle {
  try { const value = sessionStorage.getItem(throttleKey(username)); return value ? JSON.parse(value) as LoginThrottle : { failures: 0, lockedUntil: 0 } }
  catch { return { failures: 0, lockedUntil: 0 } }
}
function writeThrottle(username: string, value: LoginThrottle | null) {
  try { const key = throttleKey(username); if (value) sessionStorage.setItem(key, JSON.stringify(value)); else sessionStorage.removeItem(key) } catch { /* Storage can be disabled. */ }
}

export function LoginPage() {
  const { login } = useAuth()
  const [username, setUsername] = useState(''), [password, setPassword] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [lockedUntil, setLockedUntil] = useState(0), [now, setNow] = useState(Date.now())
  const sending = useRef(false)
  const remaining = Math.max(0, Math.ceil((lockedUntil - now) / 1000)), locked = remaining > 0
  useEffect(() => { const current = readThrottle(username); setLockedUntil(current.lockedUntil > Date.now() ? current.lockedUntil : 0) }, [username])
  useEffect(() => {
    if (!lockedUntil) return
    const timer = window.setInterval(() => {
      const next = Date.now(); setNow(next)
      if (next >= lockedUntil) { writeThrottle(username, null); setLockedUntil(0); setError('') }
    }, 250)
    return () => window.clearInterval(timer)
  }, [lockedUntil, username])
  async function submit(event: FormEvent) {
    event.preventDefault(); if (sending.current || locked) return
    sending.current = true; setBusy(true); setError('')
    try { await login(username.trim(), password); writeThrottle(username, null) }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        const current = readThrottle(username), failures = current.failures + 1
        if (failures >= 3) {
          const until = Date.now() + 60000
          writeThrottle(username, { failures: 0, lockedUntil: until }); setLockedUntil(until); setNow(Date.now())
          setError('Alcanzaste 3 intentos fallidos. Espera 60 segundos para volver a intentar.')
        } else { writeThrottle(username, { failures, lockedUntil: 0 }); setError((e as Error).message) }
      } else setError((e as Error).message)
    } finally { sending.current = false; setBusy(false); setPassword('') }
  }
  return <main className="auth-page"><form className="panel auth-card" onSubmit={submit}>
    <span className="brand"><BrainCircuit size={28}/>AI Blocks Studio</span><h1>Inicia sesión</h1><p>Continúa con tus proyectos y salones.</p>
    <label>Usuario<input autoComplete="username" required maxLength={64} value={username} onChange={e=>setUsername(e.target.value)} /></label>
    <label>Contraseña<input type="password" autoComplete="current-password" required maxLength={72} value={password} onChange={e=>setPassword(e.target.value)} /></label>
    {error && <p role="alert" className="api-error">{error}</p>}
    {locked && <p role="status">Inicio de sesión bloqueado temporalmente. Intenta otra vez en {remaining} segundos.</p>}
    <button className="primary full" disabled={busy || locked}>{busy ? 'Ingresando…' : locked ? `Espera ${remaining}s` : 'Ingresar'}</button>
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
