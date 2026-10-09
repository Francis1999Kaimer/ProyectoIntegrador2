import { ApiClient } from './client'
const key = 'aiblocks.session.token'
let current: string | null = null
try { current = sessionStorage.getItem(key) } catch { /* Storage can be disabled; session works in memory. */ }
export function getToken() { return current }
export function setToken(token: string | null) {
  current = token
  try { if (token) sessionStorage.setItem(key, token); else sessionStorage.removeItem(key) } catch { /* Memory fallback. */ }
}
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const localHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname)
const defaultApiUrl = localHost ? 'http://127.0.0.1:3000' : 'https://proyectointegrador2-production.up.railway.app'
export const api = new ApiClient(configuredApiUrl || defaultApiUrl, getToken, token => {
  // A late 401 from an earlier session must not log out a new login.
  if (getToken() !== token) return
  setToken(null)
  window.dispatchEvent(new Event('aiblocks:session-expired'))
})
