export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError' }
}
export interface RequestOptions { method?: string; body?: unknown; signal?: AbortSignal; auth?: boolean; invalidateSession?: boolean }
export class ApiClient {
  private readonly base: string
  constructor(base: string, private readonly token: () => string | null,
    private readonly expired: (token: string) => void, private readonly transport: typeof fetch = fetch,
    private readonly timeout = 20000) {
    const url = new URL(base)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('VITE_API_URL inválida.')
    this.base = url.toString().replace(/\/$/, '')
  }
  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//')) throw new Error('Ruta API inválida.')
    const token = options.auth === false ? null : this.token()
    const controller = new AbortController()
    const cancel = () => controller.abort()
    options.signal?.addEventListener('abort', cancel, { once: true })
    if (options.signal?.aborted) controller.abort()
    const timer = setTimeout(cancel, this.timeout)
    try {
      const response = await this.transport(this.base + path, {
        method: options.method ?? 'GET', signal: controller.signal, credentials: 'omit', cache: 'no-store',
        headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: options.body === undefined ? undefined : JSON.stringify(options.body), redirect: 'error'
      })
      if (!response.ok) {
        if (response.status === 401 && token && options.invalidateSession !== false) this.expired(token)
        const messages: Record<number, string> = {
          400: 'Revisa los campos del formulario.', 401: options.auth === false ? 'Usuario o contraseña incorrectos.' : options.invalidateSession === false ? 'No se pudo verificar la contraseña actual o la sesión.' : 'Tu sesión venció. Inicia sesión otra vez.',
          403: 'No tienes permiso para esta acción.', 404: 'El recurso no está disponible para tu cuenta.',
          409: 'Los datos cambiaron o ya existen. Actualiza e intenta otra vez.',
          413: 'Los datos enviados son demasiado grandes.', 429: 'Demasiados intentos. Espera un minuto antes de repetir.'
        }
        throw new ApiError(response.status, messages[response.status] ?? 'El servicio no está disponible. Intenta de nuevo.')
      }
      if (response.status === 204) return undefined as T
      return await response.json() as T
    } catch (error) {
      if (error instanceof ApiError) throw error
      if (options.signal?.aborted) throw new DOMException('Solicitud cancelada.', 'AbortError')
      throw new ApiError(0, 'No se pudo conectar con el servidor. Comprueba que el backend esté iniciado.')
    } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', cancel) }
  }
}
