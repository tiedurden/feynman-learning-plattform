import { defineStore } from 'pinia'
import * as authApi from '@/services/authApi'

const STORAGE_KEY = 'feynman-auth:v1'

interface State {
  accessToken: string | null
  refreshToken: string | null
  email: string | null
  displayName: string | null
}

function emptyState(): State {
  return { accessToken: null, refreshToken: null, email: null, displayName: null }
}

function loadState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...emptyState(), ...(JSON.parse(raw) as Partial<State>) }
  } catch {
    /* ignore malformed storage */
  }
  return emptyState()
}

export const useAuthStore = defineStore('auth', {
  state: (): State => loadState(),

  getters: {
    isAuthenticated: (state) => !!state.accessToken
  },

  actions: {
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.$state))
      } catch {
        /* storage might be unavailable — non-fatal */
      }
    },

    setSession(auth: authApi.AuthResponse) {
      this.accessToken = auth.accessToken
      this.refreshToken = auth.refreshToken
      this.email = auth.email
      this.displayName = auth.displayName
      this.persist()
    },

    async register(email: string, password: string, displayName?: string) {
      this.setSession(await authApi.register(email, password, displayName))
    },

    async login(email: string, password: string) {
      this.setSession(await authApi.login(email, password))
    },

    /** Attempts a silent refresh; returns false (without throwing) if the refresh token is gone/invalid. */
    async tryRefresh(): Promise<boolean> {
      if (!this.refreshToken) return false
      try {
        this.setSession(await authApi.refresh(this.refreshToken))
        return true
      } catch {
        return false
      }
    },

    logout() {
      Object.assign(this, emptyState())
      try {
        localStorage.removeItem(STORAGE_KEY)
      } catch {
        /* ignore */
      }
    }
  }
})
