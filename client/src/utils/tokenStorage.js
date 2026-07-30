const REMEMBER_KEY = 'rememberMe'

export function getStoredToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token') || null
}

export function getStoredRefreshToken() {
  return localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken') || null
}

export function setAuthTokens(accessToken, refreshToken, remember = true) {
  clearAuthTokens()
  const store = remember ? localStorage : sessionStorage
  if (accessToken) store.setItem('token', accessToken)
  if (refreshToken) store.setItem('refreshToken', refreshToken)
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0')
}

export function clearAuthTokens() {
  localStorage.removeItem('token')
  localStorage.removeItem('refreshToken')
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('refreshToken')
}

export function isRememberMeEnabled() {
  return localStorage.getItem(REMEMBER_KEY) !== '0'
}
