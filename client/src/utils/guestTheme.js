import { applyThemeMode } from './theme'

export const LANDING_THEME_KEY = 'qyntra:landing-theme'

export function getGuestTheme() {
  try {
    return localStorage.getItem(LANDING_THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

export function setGuestTheme(mode) {
  const next = mode === 'light' ? 'light' : 'dark'
  try {
    localStorage.setItem(LANDING_THEME_KEY, next)
  } catch {
    /* ignore */
  }
  return next
}

/** Persists guest preference and applies it to <html> (semantic tokens). */
export function applyGuestTheme(mode) {
  const next = setGuestTheme(mode)
  applyThemeMode(next)
  return next
}

export function syncGuestThemeFromStorage() {
  return applyGuestTheme(getGuestTheme())
}
