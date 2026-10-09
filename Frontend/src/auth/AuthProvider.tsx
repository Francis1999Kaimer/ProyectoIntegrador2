import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from '../api/http'
import type { User } from '../api/types'
import { useProjectStore } from '../store/project'
interface AuthState { user: User | null; ready: boolean; error: string; login: (username: string, password: string) => Promise<void>; logout: () => void; refresh: () => Promise<void> }
const AuthContext = createContext<AuthState | null>(null)
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)
  const logout = useCallback(() => {
    generation.current++; setToken(null); setUser(null); setError(''); setReady(true)
    useProjectStore.getState().reset()
  }, [])
  const refresh = useCallback(async () => {
    const token = getToken(), turn = ++generation.current
    if (!token) { setUser(null); setReady(true); return }
    try {
      const profile = await api.request<User>('/auth/me')
      if (turn === generation.current && token === getToken()) { setUser(profile); setError('') }
    } catch (e) {
      if (turn === generation.current) setError(getToken() ? (e as Error).message : '')
    } finally { if (turn === generation.current) setReady(true) }
  }, [])
  useEffect(() => {
    void refresh()
    const expired = () => logout()
    const focus = () => { if (getToken()) void refresh() }
    window.addEventListener('aiblocks:session-expired', expired)
    window.addEventListener('focus', focus)
    return () => { generation.current++; window.removeEventListener('aiblocks:session-expired', expired); window.removeEventListener('focus', focus) }
  }, [refresh, logout])
  const login = async (username: string, password: string) => {
    const turn = ++generation.current
    const result = await api.request<{access_token: string; user: User}>('/auth/login', { method: 'POST', auth: false, body: { username, password } })
    if (turn !== generation.current) return
    useProjectStore.getState().reset(); setToken(result.access_token); setUser(result.user); setError(''); setReady(true)
  }
  return <AuthContext.Provider value={{ user, ready, error, login, logout, refresh }}>{children}</AuthContext.Provider>
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider requerido.'); return value }
