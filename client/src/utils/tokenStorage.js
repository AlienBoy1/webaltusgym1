const REMEMBER_KEY = 'rememberMe'
const ACCESS_TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'

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
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(REMEMBER_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function isRememberMeEnabled() {
  const flag = localStorage.getItem(REMEMBER_KEY)
  if (flag === '1') return true
  if (flag === '0') return false
  // Legacy sessions: token only in localStorage ⇒ treat as remembered
  return Boolean(localStorage.getItem(ACCESS_TOKEN_KEY))
}
