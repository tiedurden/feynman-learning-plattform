/** Client for the Feynman backend auth API (register/login/refresh). */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  email: string
  displayName: string | null
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  if (!res.ok) {
    const problem = await res.json().catch(() => undefined)
    throw new Error(problem?.detail ?? `Request failed: ${res.status} ${res.statusText}`)
  }
  return (await res.json()) as T
}

export function register(email: string, password: string, displayName?: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/register', { email, password, displayName })
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/login', { email, password })
}

export function refresh(refreshToken: string): Promise<AuthResponse> {
  return post<AuthResponse>('/api/auth/refresh', { refreshToken })
}
