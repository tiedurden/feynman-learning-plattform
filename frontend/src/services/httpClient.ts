/**
 * Thin fetch wrapper that attaches the current access token and transparently
 * retries once via refresh-token exchange on a 401 (access token expired).
 */
import { useAuthStore } from '@/stores/authStore'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

async function request(path: string, init: RequestInit = {}, allowRetry = true): Promise<Response> {
  const auth = useAuthStore()
  const headers = new Headers(init.headers)
  if (auth.accessToken) {
    headers.set('Authorization', `Bearer ${auth.accessToken}`)
  }

  const res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers })

  if (res.status === 401 && allowRetry && auth.refreshToken) {
    const refreshed = await auth.tryRefresh()
    if (refreshed) {
      return request(path, init, false)
    }
    auth.logout()
  }

  return res
}

/** Raw fetch (for non-JSON bodies like multipart form uploads). */
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return request(path, init)
}

/** Fetch + parse JSON, throwing on a non-2xx response. */
export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await request(path, init)
  if (!res.ok) {
    const problem = await res.json().catch(() => undefined)
    throw new Error(problem?.detail ?? `Request failed: ${res.status} ${res.statusText}`)
  }
  if (res.status === 204) {
    return undefined as T
  }
  return (await res.json()) as T
}
