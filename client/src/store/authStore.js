import { create } from 'zustand'
import api from '../utils/api'
import { withIdAlias } from '../utils/ids'
import { supabase } from '../lib/supabase'
import {
  getStoredTokens,
  getStoredToken,
  getStoredRefreshToken,
  setAuthTokens,
  clearAuthTokens,
  isRememberMeEnabled
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

const { token: initialToken, refreshToken: initialRefreshToken } = getStoredTokens()

export const useAuthStore = create((set, get) => ({
  user: null,
  token: initialToken,
  refreshToken: initialRefreshToken,
  isAuthenticated: !!initialToken,
  rememberMe: isRememberMeEnabled(),
  loading: false,
  initializing: true,
  authIntent: null,

  loginWithSession: async (token, refreshToken, userPayload, { remember = true } = {}) => {
    if (!token || !refreshToken || !userPayload) {
      return { success: false, message: 'Sesión incompleta' }
    }
    set({ loading: true, authIntent: 'login' })
    try {
      setAuthTokens(token, refreshToken, remember)
      await syncSupabaseSession(token, refreshToken)
      const user = withIdAlias(userPayload)
      set({
        user,
        token,
        refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        loading: false,
        authIntent: null
      })
      return { success: true }
    } catch (error) {
      set({ loading: false, authIntent: null })
      return {
        success: false,
        message: error?.message || 'Error al establecer sesión'
      }
    }
  },

  loginWithGoogleSession: async (accessToken, refreshToken, { remember = true } = {}) => {
    set({ loading: true, authIntent: 'login' })
    try {
      const { data } = await api.post('/auth/google', { accessToken, refreshToken })
      setAuthTokens(data.token, data.refreshToken, remember)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      set({
        user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        loading: false,
        authIntent: null
      })
      return { success: true }
    } catch (error) {
      set({ loading: false, authIntent: null })
      const payload = error.response?.data || {}
      return {
        success: false,
        status: error.response?.status,
        code: payload.code,
        message: payload.message || 'Error al iniciar sesión con Google',
        email: payload.email,
        name: payload.name,
        avatar: payload.avatar
      }
    }
  },

  login: async (email, password, { remember = true } = {}) => {
    set({ loading: true, authIntent: 'login' })
    try {
      const { data } = await api.post('/auth/login', { email, password })
      setAuthTokens(data.token, data.refreshToken, remember)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      set({
        user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        loading: false,
        authIntent: null
      })
      return { success: true }
    } catch (error) {
      set({ loading: false, authIntent: null })
      return {
        success: false,
        message: error.response?.data?.message || 'Error al iniciar sesión'
      }
    }
  },

  register: async (name, email, password, username) => {
    set({ loading: true, authIntent: 'login' })
    try {
      const headers = {}
      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers.Authorization = `Bearer ${session.access_token}`
        }
      } catch {
        /* ignore */
      }

      const { data } = await api.post(
        '/auth/register',
        { name, email, password, username },
        { headers }
      )
      setAuthTokens(data.token, data.refreshToken, true)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      set({
        user,
        token: data.token,
        refreshToken: data.refreshToken,
        rememberMe: true,
        isAuthenticated: true,
        loading: false,
        authIntent: null
      })
      return { success: true, isFirstUser: data.isFirstUser }
    } catch (error) {
      set({ loading: false, authIntent: null })
      return {
        success: false,
        message: error.response?.data?.message || 'Error al registrarse',
        code: error.response?.data?.code
      }
    }
  },

  logout: async () => {
    set({ loading: true, authIntent: 'logout' })
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
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      rememberMe: false,
      loading: true,
      authIntent: 'logout',
      initializing: false
    })
    await new Promise((resolve) => setTimeout(resolve, 850))
    // PWA/logged-out UX: always login. Web landing remains available at `/` via "Volver".
    window.location.href = '/login'
  },

  refreshSession: async (refreshToken) => {
    if (!refreshToken) {
      return { success: false }
    }

    set({ loading: true })
    try {
      const { data } = await api.post('/auth/refresh', { refreshToken })
      const remember = isRememberMeEnabled()
      setAuthTokens(data.token, data.refreshToken, remember)
      await syncSupabaseSession(data.token, data.refreshToken)
      set({
        user: withIdAlias(data.user),
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        loading: false
      })
      return { success: true }
    } catch (error) {
      clearAuthTokens()
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        loading: false
      })
      return { success: false }
    }
  },

  refreshUser: async () => {
    const token = getStoredToken()
    if (!token) return

    try {
      const { data } = await api.get('/auth/me')
      set({ user: withIdAlias(data.user), isAuthenticated: true })
    } catch (error) {
      if (error.response?.status === 401) {
        await get().checkAuth()
      }
    }
  },

  updateUser: (userData) => {
    set({ user: withIdAlias({ ...get().user, ...userData }) })
  },

  checkAuth: async () => {
    set({ initializing: true, loading: true })
    const token = getStoredToken()
    const refreshToken = getStoredRefreshToken()

    if (!token) {
      clearAuthTokens()
      set({
        isAuthenticated: false,
        user: null,
        token: null,
        refreshToken: null,
        initializing: false,
        loading: false
      })
      return false
    }

    try {
      await syncSupabaseSession(token, refreshToken)
      const { data } = await api.get('/auth/me', { timeout: 15000 })
      set({
        user: withIdAlias(data.user),
        isAuthenticated: true,
        token: getStoredToken() || token,
        refreshToken: getStoredRefreshToken() || refreshToken
      })
      return true
    } catch (error) {
      // Never wipe remember-me tokens on timeout/network — only on definitive auth failure
      const isTimeout =
        error?.code === 'TIMEOUT' ||
        error?.code === 'ECONNABORTED' ||
        error?.message === 'Auth timeout'
      const isNetwork = !error?.response
      if (isTimeout || isNetwork) {
        set({
          isAuthenticated: true,
          token,
          refreshToken,
          user: get().user
        })
        return true
      }
      if (refreshToken) {
        const refreshed = await get().refreshSession(refreshToken)
        return refreshed.success
      }
      clearAuthTokens()
      set({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false
      })
      return false
    } finally {
      set({ initializing: false, loading: false })
    }
  }
}))
