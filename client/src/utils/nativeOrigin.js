/**
 * Capacitor local WebView origin helpers.
 * Plugins (PushNotifications, etc.) only inject on the app origin (https://localhost),
 * not on allowNavigation hosts like qyntagymweb.vercel.app after OAuth.
 */
import { isNativeApp } from './appMode'
import { getNativePersistedTokens } from './tokenStorage'

export const NATIVE_WEB_ORIGIN = 'https://localhost'
export const PRODUCTION_WEB_HOST = 'qyntagymweb.vercel.app'

export function isRemoteWebHost(hostname = typeof window !== 'undefined' ? window.location.hostname : '') {
  const host = String(hostname || '').toLowerCase()
  return host.includes('vercel.app') || host === PRODUCTION_WEB_HOST
}

/** True when Capacitor WebView is showing the public site instead of bundled assets. */
export function isNativeOnRemoteOrigin() {
  if (!isNativeApp() || typeof window === 'undefined') return false
  return isRemoteWebHost(window.location.hostname)
}

export function buildNativeHandoffUrl({ accessToken, refreshToken, next = '/dashboard' } = {}) {
  const url = new URL(`${NATIVE_WEB_ORIGIN}/auth/native-handoff`)
  if (next) url.searchParams.set('next', next)
  if (accessToken) url.searchParams.set('access_token', accessToken)
  if (refreshToken) url.searchParams.set('refresh_token', refreshToken)
  return url.toString()
}

/**
 * If the native shell is stuck on the remote site, jump back to local assets.
 * Prefer live OAuth session tokens; otherwise Preferences-backed tokens; else plain local URL
 * so hydrateNativeTokenStorage can restore the remembered session.
 */
export async function recoverNativeLocalOrigin({ next } = {}) {
  if (!isNativeOnRemoteOrigin()) return false

  let accessToken = null
  let refreshToken = null
  try {
    const { supabase } = await import('../lib/supabase')
    const { data } = await supabase.auth.getSession()
    accessToken = data?.session?.access_token || null
    refreshToken = data?.session?.refresh_token || null
  } catch {
    /* ignore */
  }

  if (!accessToken || !refreshToken) {
    const persisted = await getNativePersistedTokens()
    accessToken = persisted.token
    refreshToken = persisted.refreshToken
  }

  const pathNext =
    next ||
    `${window.location.pathname}${window.location.search || ''}${window.location.hash || ''}` ||
    '/dashboard'
  const safeNext = pathNext.startsWith('/auth/') ? '/dashboard' : pathNext

  if (accessToken && refreshToken) {
    window.location.replace(
      buildNativeHandoffUrl({
        accessToken,
        refreshToken,
        next: safeNext
      })
    )
  } else {
    // No tokens on remote origin — go home to local assets; Preferences hydrate may still restore.
    window.location.replace(`${NATIVE_WEB_ORIGIN}${safeNext.startsWith('/') ? safeNext : '/dashboard'}`)
  }
  return true
}
