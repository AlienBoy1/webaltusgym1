import { isNativeApp } from './appMode'

const REMEMBER_KEY = 'rememberMe'
const ACCESS_TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'
const PREFS_TIMEOUT_MS = 1800

const NATIVE_KEYS = {
  remember: 'qyntra.auth.rememberMe',
  token: 'qyntra.auth.token',
  refresh: 'qyntra.auth.refreshToken'
}

let hydratePromise = null

async function withTimeout(promise, ms, fallback = null) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve(fallback), ms)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
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

async function prefsGetAll(Preferences) {
  return Promise.all([
    Preferences.get({ key: NATIVE_KEYS.remember }),
    Preferences.get({ key: NATIVE_KEYS.token }),
    Preferences.get({ key: NATIVE_KEYS.refresh })
  ])
}

/** Restore durable native tokens into WebView storage before checkAuth. */
export async function hydrateNativeTokenStorage() {
  // If a previous attempt is still in-flight, wait only briefly — never hang boot forever.
  if (hydratePromise) {
    const raced = await withTimeout(hydratePromise, PREFS_TIMEOUT_MS, '__timeout__')
    if (raced === '__timeout__') {
      hydratePromise = null
      return false
    }
    return Boolean(raced)
  }

  hydratePromise = (async () => {
    const Preferences = await withTimeout(getPreferences(), 1200, null)
    if (!Preferences) return false

    try {
      const result = await withTimeout(prefsGetAll(Preferences), PREFS_TIMEOUT_MS, null)
      if (!result) return false

      const [{ value: remember }, { value: token }, { value: refresh }] = result

      if (!token && !refresh && remember == null) return false

      if (remember === '0') {
        localStorage.setItem(REMEMBER_KEY, '0')
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        sessionStorage.removeItem(ACCESS_TOKEN_KEY)
        sessionStorage.removeItem(REFRESH_TOKEN_KEY)
        return false
      }

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
  })()

  const ok = await hydratePromise
  // Allow retry when Preferences was empty / timed out / not ready
  if (!ok) hydratePromise = null
  return ok
}

async function persistNativeTokens(accessToken, refreshToken, remember) {
  const Preferences = await withTimeout(getPreferences(), 1200, null)
  if (!Preferences) return

  try {
    const op = remember
      ? Promise.all([
          Preferences.set({ key: NATIVE_KEYS.remember, value: '1' }),
          Preferences.set({ key: NATIVE_KEYS.token, value: accessToken || '' }),
          Preferences.set({ key: NATIVE_KEYS.refresh, value: refreshToken || '' })
        ])
      : Promise.all([
          Preferences.set({ key: NATIVE_KEYS.remember, value: '0' }),
          Preferences.remove({ key: NATIVE_KEYS.token }),
          Preferences.remove({ key: NATIVE_KEYS.refresh })
        ])
    await withTimeout(op, PREFS_TIMEOUT_MS, null)
  } catch (err) {
    console.warn('persistNativeTokens:', err?.message || err)
  }
}

async function clearNativeTokens() {
  const Preferences = await withTimeout(getPreferences(), 1200, null)
  if (!Preferences) return
  try {
    await withTimeout(
      Promise.all([
        Preferences.remove({ key: NATIVE_KEYS.remember }),
        Preferences.remove({ key: NATIVE_KEYS.token }),
        Preferences.remove({ key: NATIVE_KEYS.refresh })
      ]),
      PREFS_TIMEOUT_MS,
      null
    )
  } catch {
    /* ignore */
  }
}

export function getStoredToken() {
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

/**
 * Persist tokens. Web storage is sync; Preferences is best-effort with timeout
 * so login / boot never hangs on a stuck Capacitor bridge.
 */
export async function setAuthTokens(accessToken, refreshToken, remember = true) {
  const preferLocal = remember !== false

  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)

  const store = preferLocal ? localStorage : sessionStorage
  if (accessToken) store.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) store.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(REMEMBER_KEY, preferLocal ? '1' : '0')

  await persistNativeTokens(accessToken, refreshToken, preferLocal)
  hydratePromise = null
}

export async function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(REMEMBER_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  await clearNativeTokens()
  hydratePromise = null
}

export function isRememberMeEnabled() {
  const flag = localStorage.getItem(REMEMBER_KEY)
  if (flag === '1') return true
  if (flag === '0') return false
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY))
}

/** Read tokens from Preferences without touching web storage (for remote→local handoff). */
export async function getNativePersistedTokens() {
  const Preferences = await withTimeout(getPreferences(), 1200, null)
  if (!Preferences) return { token: null, refreshToken: null, remember: true }
  try {
    const result = await withTimeout(prefsGetAll(Preferences), PREFS_TIMEOUT_MS, null)
    if (!result) return { token: null, refreshToken: null, remember: true }
    const [{ value: remember }, { value: token }, { value: refresh }] = result
    return {
      token: token || null,
      refreshToken: refresh || null,
      remember: remember !== '0'
    }
  } catch {
    return { token: null, refreshToken: null, remember: true }
  }
}
