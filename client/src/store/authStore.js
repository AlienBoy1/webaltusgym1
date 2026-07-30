import { create } from 'zustand'
import api from '../utils/api'
import { withIdAlias } from '../utils/ids'
import { supabase } from '../lib/supabase'

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

export const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: !!localStorage.getItem('token'),
  loading: false,

  login: async (email, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      localStorage.setItem('token', data.token)
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
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
      localStorage.setItem('token', data.token)
      if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken)
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
      await supabase.auth.signOut()
    } catch {
      /* ignore */
    }
    localStorage.removeItem('token')
    localStorage.removeItem('refreshToken')
    set({ user: null, token: null, isAuthenticated: false })
    window.location.href = '/login'
  },

  refreshUser: async () => {
    const token = localStorage.getItem('token')
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
    const token = localStorage.getItem('token')
    if (!token) {
      set({ isAuthenticated: false, user: null })
      return false
    }

    try {
      const refreshToken = localStorage.getItem('refreshToken')
      await syncSupabaseSession(token, refreshToken)
      const { data } = await api.get('/auth/me')
      set({ user: withIdAlias(data.user), isAuthenticated: true })
      return true
    } catch (error) {
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
      set({ user: null, token: null, isAuthenticated: false })
      return false
    }
  }
}))