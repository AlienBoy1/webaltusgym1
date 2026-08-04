const REMEMBER_KEY = 'rememberMe'
const ACCESS_TOKEN_KEY = 'token'
const REFRESH_TOKEN_KEY = 'refreshToken'

export function getStoredToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY) || sessionStorage.getItem(ACCESS_TOKEN_KEY) || null
}

export function getStoredRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY) || sessionStorage.getItem(REFRESH_TOKEN_KEY) || null
}

export function getStoredTokens() {
  return {
    token: getStoredToken(),
    refreshToken: getStoredRefreshToken(),
    remember: localStorage.getItem(REMEMBER_KEY) === '1'
  }
}

export function setAuthTokens(accessToken, refreshToken, remember = true) {
  clearAuthTokens()
  const store = remember ? localStorage : sessionStorage
  if (accessToken) store.setItem(ACCESS_TOKEN_KEY, accessToken)
  if (refreshToken) store.setItem(REFRESH_TOKEN_KEY, refreshToken)
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
}

export function clearAuthTokens() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(REMEMBER_KEY)
  sessionStorage.removeItem(ACCESS_TOKEN_KEY)
  sessionStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function isRememberMeEnabled() {
  return localStorage.getItem(REMEMBER_KEY) === '1'
}
