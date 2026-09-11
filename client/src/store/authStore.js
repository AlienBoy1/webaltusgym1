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
  isRememberMeEnabled,
  hydrateNativeTokenStorage,
  getNativePersistedTokens
} from '../utils/tokenStorage'

const CACHED_USER_KEY = 'qyntra:cachedUser'
const MAX_CACHED_AVATAR = 12_000

function slimCachedAvatar(avatar) {
  if (!avatar) return null
  const s = String(avatar)
  if (s.startsWith('icon:') || s.startsWith('http://') || s.startsWith('https://')) return s
  if (s.startsWith('data:') && s.length > MAX_CACHED_AVATAR) return null
  if (s.length > MAX_CACHED_AVATAR) return null
  return s
}

function loadCachedUser() {
  try {
    const raw = localStorage.getItem(CACHED_USER_KEY)
    if (!raw) return null
    return withIdAlias(JSON.parse(raw))
  } catch {
    return null
  }
}

function persistCachedUser(user) {
  try {
    if (!user) {
      localStorage.removeItem(CACHED_USER_KEY)
      return
    }
    const slim = {
      ...user,
      avatar: slimCachedAvatar(user.avatar),
      profile: user.profile
        ? { ...user.profile, coverUrl: null }
        : user.profile
    }
    localStorage.setItem(CACHED_USER_KEY, JSON.stringify(slim))
  } catch {
    /* quota / private mode */
  }
}

/** One-shot onboarding flags — once true, never wipe with stale server false/missing. */
const STICKY_TRUE_SETTINGS = [
  'qyntraWelcomeSeen',
  'qysiIntroSeenV2',
  'tutorialCompleted'
]

function mergeUsersPreservingSettings(prev, incoming) {
  const next = withIdAlias({ ...(prev || {}), ...(incoming || {}) })
  if (incoming?.profile || prev?.profile) {
    next.profile = { ...(prev?.profile || {}), ...(incoming?.profile || {}) }
  }
  const prevSettings = prev?.settings || {}
  const incomingSettings = incoming?.settings || {}
  next.settings = { ...prevSettings, ...incomingSettings }
  for (const key of STICKY_TRUE_SETTINGS) {
    if (prevSettings[key] === true || incomingSettings[key] === true) {
      next.settings[key] = true
    }
  }
  // Sticky one-shot tutorial / intro style flags (…Seen / …Completed)
  for (const [key, value] of Object.entries(prevSettings)) {
    if (value !== true) continue
    if (!/(Seen|Completed)$/.test(key)) continue
    next.settings[key] = true
  }
  if (!next.avatar && prev?.avatar) next.avatar = prev.avatar
  if (prev?.profile?.coverUrl && !next.profile?.coverUrl) {
    next.profile = { ...(next.profile || {}), coverUrl: prev.profile.coverUrl }
  }
  return next
}

/** Sync JWT into Supabase client so Realtime/RLS see auth.uid() */
async function syncSupabaseSession(accessToken, refreshToken) {
  if (!accessToken || !refreshToken) return
  try {
    const work = supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    })
    await Promise.race([
      work,
      new Promise((resolve) => setTimeout(resolve, 1200))
    ])
  } catch (err) {
    console.warn('Supabase setSession failed:', err?.message || err)
  }
}

const { token: initialToken, refreshToken: initialRefreshToken } = getStoredTokens()
const initialCachedUser = initialToken ? loadCachedUser() : null

export const useAuthStore = create((set, get) => ({
  user: initialCachedUser,
  token: initialToken,
  refreshToken: initialRefreshToken,
  isAuthenticated: !!initialToken,
  rememberMe: isRememberMeEnabled(),
  loading: false,
  initializing: true,
  authIntent: null,
  membershipNotice: null,
  /** Bumps on each credential/session login so UI can re-show once-per-login prompts */
  authSessionTick: 0,

  clearMembershipNotice: () => set({ membershipNotice: null }),

  bumpAuthSession: () => set({ authSessionTick: (get().authSessionTick || 0) + 1 }),

  loginWithSession: async (token, refreshToken, userPayload, { remember = true, membershipNotice = null } = {}) => {
    if (!token || !refreshToken || !userPayload) {
      return { success: false, message: 'Sesión incompleta' }
    }
    set({ loading: true, authIntent: 'login' })
    try {
      await setAuthTokens(token, refreshToken, remember)
      await syncSupabaseSession(token, refreshToken)
      const user = withIdAlias(userPayload)
      persistCachedUser(user)
      set({
        user,
        token,
        refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        loading: false,
        authIntent: null,
        membershipNotice: membershipNotice || null,
        authSessionTick: (get().authSessionTick || 0) + 1
      })
      return { success: true }
    } catch (error) {
      set({ loading: false, authIntent: null })
      return { success: false, message: error.message || 'Error de sesión' }
    }
  },

  loginWithGoogleSession: async (accessToken, refreshToken, { remember = true } = {}) => {
    set({ loading: true, authIntent: 'login' })
    try {
      const { data } = await api.post('/auth/google', { accessToken, refreshToken })
      await setAuthTokens(data.token, data.refreshToken, remember)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      persistCachedUser(user)
      set({
        user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        loading: false,
        authIntent: null,
        membershipNotice: data.membershipNotice || null,
        authSessionTick: (get().authSessionTick || 0) + 1
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
      await setAuthTokens(data.token, data.refreshToken, remember)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      persistCachedUser(user)
      set({
        user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        loading: false,
        authIntent: null,
        membershipNotice: data.membershipNotice || null,
        authSessionTick: (get().authSessionTick || 0) + 1
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
      await setAuthTokens(data.token, data.refreshToken, true)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      persistCachedUser(user)
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
    await clearAuthTokens()
    persistCachedUser(null)
    set({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      rememberMe: false,
      loading: true,
      authIntent: 'logout',
      initializing: false,
      membershipNotice: null
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
      await setAuthTokens(data.token, data.refreshToken, remember)
      await syncSupabaseSession(data.token, data.refreshToken)
      const user = withIdAlias(data.user)
      persistCachedUser(user)
      set({
        user,
        token: data.token,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        rememberMe: remember,
        loading: false
      })
      return { success: true }
    } catch (error) {
      const status = error?.response?.status
      const isAuthDead = status === 401 || status === 403

      // Keep session through deploy / network blips — only wipe on definitive auth failure
      if (!isAuthDead) {
        set({
          loading: false,
          isAuthenticated: true,
          token: get().token || getStoredToken(),
          refreshToken: get().refreshToken || refreshToken,
          user: get().user || loadCachedUser()
        })
        return { success: false, transient: true }
      }

      await clearAuthTokens()
      persistCachedUser(null)
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
      const prev = get().user
      const next = mergeUsersPreservingSettings(prev, data.user)
      persistCachedUser(next)
      set({
        user: next,
        isAuthenticated: true,
        membershipNotice: data.membershipNotice || get().membershipNotice
      })
    } catch (error) {
      if (error.response?.status === 401) {
        await get().checkAuth()
      }
    }
  },

  /** Load full avatar/cover after slim /auth/me — dedicated media endpoint (no social graph). */
  loadMyMedia: async () => {
    const token = getStoredToken()
    const prev = get().user
    const id = prev?.id || prev?._id
    if (!token || !id) return
    try {
      const { data } = await api.get('/users/profile-media', { timeout: 90000 })
      if (!data) return
      const nextAvatar = data.avatar || prev.avatar
      const nextCover = data.coverUrl ?? prev.profile?.coverUrl ?? null
      set({
        user: withIdAlias({
          ...prev,
          avatar: nextAvatar,
          profile: {
            ...(prev.profile || {}),
            coverUrl: nextCover
          }
        }),
        isAuthenticated: true
      })
    } catch (error) {
      console.warn('loadMyMedia failed:', error?.message || error)
    }
  },

  updateUser: (userData) => {
    const prev = get().user || {}
    const next = { ...prev, ...userData }
    if (userData?.profile) {
      next.profile = { ...(prev.profile || {}), ...userData.profile }
    }
    // Shallow-merge settings so partial/stale payloads cannot wipe flags
    // (e.g. qyntraWelcomeSeen surviving badge sync).
    if (userData?.settings && typeof userData.settings === 'object') {
      next.settings = { ...(prev.settings || {}), ...userData.settings }
    }
    // Don't let undefined/null slim echoes wipe a real photo
    if (userData.avatar === undefined || userData.avatar === null) {
      if (prev.avatar) next.avatar = prev.avatar
    }
    // coverUrl: null is intentional wipe; undefined means leave previous
    if (
      userData.profile &&
      userData.profile.coverUrl === undefined &&
      prev.profile?.coverUrl
    ) {
      next.profile.coverUrl = prev.profile.coverUrl
    }
    const user = withIdAlias(next)
    persistCachedUser(user)
    set({ user })
  },

  checkAuth: async () => {
    set({ initializing: true, loading: true })

    const endInit = (extra = {}) => {
      set({ initializing: false, loading: false, ...extra })
    }

    // Hard ceiling — never leave the boot theater forever (stuck Preferences / network)
    const watchdog = window.setTimeout(() => {
      if (!get().initializing) return
      console.warn('checkAuth watchdog: forcing boot exit')
      const token = getStoredToken()
      const cached = loadCachedUser()
      if (token) {
        endInit({
          isAuthenticated: true,
          token,
          refreshToken: getStoredRefreshToken(),
          user: get().user || cached,
          rememberMe: isRememberMeEnabled()
        })
      } else {
        endInit({ isAuthenticated: false })
      }
    }, 4500)

    try {
      try {
        await hydrateNativeTokenStorage()
      } catch {
        /* ignore */
      }

      let token = getStoredToken()
      let refreshToken = getStoredRefreshToken()

      // One quick Preferences fallback only when web storage is empty
      if (!token) {
        try {
          const native = await getNativePersistedTokens()
          if (native.remember && native.token) {
            // Write web storage sync; native persist is best-effort in background
            localStorage.setItem('rememberMe', '1')
            localStorage.setItem('token', native.token)
            if (native.refreshToken) localStorage.setItem('refreshToken', native.refreshToken)
            token = native.token
            refreshToken = native.refreshToken
            void setAuthTokens(native.token, native.refreshToken, true)
          }
        } catch {
          /* ignore */
        }
      }

      const cached = loadCachedUser()
      const remember = isRememberMeEnabled()

      // Cached session → leave boot immediately
      if (token && cached) {
        set({
          user: cached,
          isAuthenticated: true,
          token,
          refreshToken,
          rememberMe: remember,
          initializing: false,
          loading: false
        })
      }

      if (!token) {
        // Fast path to login — do not block on Preferences clear
        persistCachedUser(null)
        endInit({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null
        })
        void clearAuthTokens()
        return false
      }

      try {
        await syncSupabaseSession(token, refreshToken)
        const { data } = await api.get('/auth/me', { timeout: 5000 })
        const prev = get().user
        const user = mergeUsersPreservingSettings(prev, data.user)
        persistCachedUser(user)
        endInit({
          user,
          isAuthenticated: true,
          rememberMe: isRememberMeEnabled(),
          token: getStoredToken() || token,
          refreshToken: getStoredRefreshToken() || refreshToken,
          membershipNotice: data.membershipNotice || null,
          authSessionTick: (get().authSessionTick || 0) + 1
        })
        return true
      } catch (error) {
        const isTimeout =
          error?.code === 'TIMEOUT' ||
          error?.code === 'ECONNABORTED' ||
          error?.message === 'Auth timeout'
        const isNetwork = !error?.response
        const status = error?.response?.status
        const isServerBlip = status >= 500 && status <= 599
        if (isTimeout || isNetwork || isServerBlip || cached) {
          endInit({
            isAuthenticated: true,
            token,
            refreshToken,
            user: get().user || cached,
            rememberMe: isRememberMeEnabled()
          })
          return true
        }
        if (refreshToken) {
          const refreshed = await get().refreshSession(refreshToken)
          if (refreshed.success || refreshed.transient) {
            endInit({
              isAuthenticated: true,
              user: get().user || cached,
              token: getStoredToken() || token,
              refreshToken: getStoredRefreshToken() || refreshToken
            })
            return true
          }
        }
        persistCachedUser(null)
        endInit({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false
        })
        void clearAuthTokens()
        return false
      }
    } catch (err) {
      console.warn('checkAuth fatal:', err?.message || err)
      const token = getStoredToken()
      const cached = loadCachedUser()
      if (token) {
        endInit({
          isAuthenticated: true,
          token,
          refreshToken: getStoredRefreshToken(),
          user: get().user || cached,
          rememberMe: isRememberMeEnabled()
        })
        return true
      }
      endInit({ isAuthenticated: false })
      return false
    } finally {
      window.clearTimeout(watchdog)
      if (get().initializing) {
        set({ initializing: false, loading: false })
      }
    }
  }
}))
