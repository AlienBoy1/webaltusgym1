import { create } from 'zustand'
import api from '../utils/api'
import { withIdAlias } from '../utils/ids'
import { supabase } from '../lib/supabase'
import {
  getStoredToken,
  getStoredRefreshToken,
  setAuthTokens,
  clearAuthTokens
} from '../utils/tokenStorage'

/** Sync JWT into Supabase client so Realtime/RLS see auth.uid() */
async function syncSupabaseSession(accessToken, refreshToken) {
  if (!accessToken || !refreshToken) return
  try {
    await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })
  } catch (err) {
    console.warn('Supabase setSession failed:', err?.message || err)
  }
}

const initialToken = getStoredToken()

export const useAuthStore = create((set, get) => ({
  user: null,
  token: initialToken,
  isAuthenticated: !!initialToken,
  loading: false,

  login: async (email, password, { remember = true } = {}) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuthTokens(data.token, data.refreshToken, remember)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      set({
        user,
        token: data.token,
        isAuthenticated: true,
        loading: false
      })
      return { success: true }
    } catch (error) {
      set({ loading: false })
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar sesión'
      }
    }
  },

  register: async (name, email, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/register', { name, email, password })
      setAuthTokens(data.token, data.refreshToken, true)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      set({
        user,
        token: data.token,
        isAuthenticated: true,
        loading: false
      })
      return { success: true, isFirstUser: data.isFirstUser }
    } catch (error) {
      set({ loading: false })
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrarse'
      }
    }
  },

  logout: async () => {
    try {
      const { unsubscribeFromPush } = await import('../utils/push')
      await unsubscribeFromPush()
    } catch {
      /* ignore */
    }
    try {
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
    clearAuthTokens()
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  refreshUser: async () => {
    const token = getStoredToken()
    if (!token) return

    try {
      const { data } = await api.get('/auth/me')
      set({ user: withIdAlias(data.user), isAuthenticated: true })
    } catch (error) {
      if (error.response?.status === 401) {
        get().logout()
      }
    }
  },

  updateUser: (userData) => {
    set({ user: withIdAlias({ ...get().user, ...userData }) })
  },

  checkAuth: async () => {
    const token = getStoredToken()
    if (!token) {
      set({ isAuthenticated: false, user: null })
      return false
    }

    try {
      const refreshToken = getStoredRefreshToken()
      await syncSupabaseSession(token, refreshToken)
      const { data } = await api.get('/auth/me')
      set({ user: withIdAlias(data.user), isAuthenticated: true, token })
      return true
    } catch (error) {
      clearAuthTokens()
      set({ user: null, token: null, isAuthenticated: false })
      return false
    }
  }
}))
