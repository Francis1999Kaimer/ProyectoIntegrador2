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
// Servidor de desarrollo abierto desde otro dominio (por ejemplo, un túnel de ngrok):
// la API va por el proxy /api de Vite en el mismo dominio (ver vite.config.ts).
const devTunnel = import.meta.env.DEV && typeof window !== 'undefined' && !localHost
const defaultApiUrl = localHost ? 'http://127.0.0.1:3000'
  : devTunnel ? window.location.origin + '/api'
  : 'https://proyectointegrador2-production.up.railway.app'
// Un VITE_API_URL local (localhost o 127.0.0.1) no sirve a quien abre el túnel desde otro equipo.
const configuredIsLocal = !!configuredApiUrl && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(configuredApiUrl)
const apiUrl = devTunnel && (!configuredApiUrl || configuredIsLocal) ? defaultApiUrl : configuredApiUrl || defaultApiUrl
// ngrok muestra una página de aviso a los navegadores; esta cabecera la omite en las llamadas a la API.
// Solo se envía por el túnel (mismo dominio), así que no provoca verificaciones CORS.
const transport: typeof fetch = devTunnel && apiUrl.startsWith(window.location.origin + '/')
  ?(input, init) => globalThis.fetch(input, { ...init, headers: { ...(init?.headers as Record<string, string> | undefined), 'ngrok-skip-browser-warning': '1' } })
  : (...args) => globalThis.fetch(...args)
export const api = new ApiClient(apiUrl, getToken, token => {
  // A late 401 from an earlier session must not log out a new login.
  if (getToken() !== token) return
  setToken(null)
  window.dispatchEvent(new Event('aiblocks:session-expired'))
}, transport)
