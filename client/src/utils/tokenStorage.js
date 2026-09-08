import { isNativeApp } from './appMode'

const REMEMBER_KEY = 'rememberMe'
const ACCESS_TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'

const NATIVE_KEYS = {
  remember: 'qyntra.auth.rememberMe',
  token: 'qyntra.auth.token',
  refresh: 'qyntra.auth.refreshToken'
}

async function getPreferences() {
  if (!isNativeApp()) return null
  try {
    const { Preferences } = await import('@capacitor/preferences')
    return Preferences
  } catch {
    return null
  }
}

/** Restore durable native tokens into WebView storage before checkAuth. */
export async function hydrateNativeTokenStorage() {
  const Preferences = await getPreferences()
  if (!Preferences) return false

  try {
    const [{ value: remember }, { value: token }, { value: refresh }] = await Promise.all([
      Preferences.get({ key: NATIVE_KEYS.remember }),
      Preferences.get({ key: NATIVE_KEYS.token }),
      Preferences.get({ key: NATIVE_KEYS.refresh })
    ])

    if (!token && !refresh && remember == null) return false

    if (remember === '0') {
      localStorage.setItem(REMEMBER_KEY, '0')
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token)
      if (refresh) sessionStorage.setItem(REFRESH_TOKEN_KEY, refresh)
      return Boolean(token)
    }

    // remember on (or legacy without flag)
    localStorage.setItem(REMEMBER_KEY, '1')
    if (token) localStorage.setItem(ACCESS_TOKEN_KEY, token)
    if (refresh) localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
    sessionStorage.removeItem(ACCESS_TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_TOKEN_KEY)
    return Boolean(token)
  } catch (err) {
    console.warn('hydrateNativeTokenStorage:', err?.message || err)
    return false
  }
}

async function persistNativeTokens(accessToken, refreshToken, remember) {
  const Preferences = await getPreferences()
  if (!Preferences) return

  try {
    if (remember) {
      await Promise.all([
        Preferences.set({ key: NATIVE_KEYS.remember, value: '1' }),
        Preferences.set({ key: NATIVE_KEYS.token, value: accessToken || '' }),
        Preferences.set({ key: NATIVE_KEYS.refresh, value: refreshToken || '' })
      ])
    } else {
      // Session-only: keep in Preferences for this process death on Android is optional;
      // clear durable remember keys so cold start does not restore.
      await Promise.all([
        Preferences.set({ key: NATIVE_KEYS.remember, value: '0' }),
        Preferences.remove({ key: NATIVE_KEYS.token }),
        Preferences.remove({ key: NATIVE_KEYS.refresh })
      ])
    }
  } catch (err) {
    console.warn('persistNativeTokens:', err?.message || err)
  }
}

async function clearNativeTokens() {
  const Preferences = await getPreferences()
  if (!Preferences) return
  try {
    await Promise.all([
      Preferences.remove({ key: NATIVE_KEYS.remember }),
      Preferences.remove({ key: NATIVE_KEYS.token }),
      Preferences.remove({ key: NATIVE_KEYS.refresh })
    ])
  } catch {
    /* ignore */
  }
}

export function getStoredToken() {
  // Prefer persistent store when "recordarme" is on
  if (isRememberMeEnabled()) {
    return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY) || null
  }
  return sessionStorage.getItem(ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY) || null
}

export function getStoredRefreshToken() {
  if (isRememberMeEnabled()) {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY) || null
  }
  return sessionStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem(REFRESH_TOKEN_KEY) || null
}

export function getStoredTokens() {
  return {
    token: getStoredToken(),
    refreshToken: getStoredRefreshToken(),
    remember: isRememberMeEnabled()
  }
}

export function setAuthTokens(accessToken, refreshToken, remember = true) {
  const preferLocal = remember !== false

  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)

  const store = preferLocal ? localStorage : sessionStorage
  if (accessToken) store.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) store.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(REMEMBER_KEY, preferLocal ? '1' : '0')

  // Native: Preferences survive WebView origin switches + process death
  void persistNativeTokens(accessToken, refreshToken, preferLocal)
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(REMEMBER_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  void clearNativeTokens()
}

export function isRememberMeEnabled() {
  const flag = localStorage.getItem(REMEMBER_KEY)
  if (flag === '1') return true
  if (flag === '0') return false
  // Legacy sessions: token only in localStorage ⇒ treat as remembered
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY))
}

/** Read tokens from Preferences without touching web storage (for remote→local handoff). */
export async function getNativePersistedTokens() {
  const Preferences = await getPreferences()
  if (!Preferences) return { token: null, refreshToken: null, remember: true }
  try {
    const [{ value: remember }, { value: token }, { value: refresh }] = await Promise.all([
      Preferences.get({ key: NATIVE_KEYS.remember }),
      Preferences.get({ key: NATIVE_KEYS.token }),
      Preferences.get({ key: NATIVE_KEYS.refresh })
    ])
    return {
      token: token || null,
      refreshToken: refresh || null,
      remember: remember !== '0'
    }
  } catch {
    return { token: null, refreshToken: null, remember: true }
  }
}
