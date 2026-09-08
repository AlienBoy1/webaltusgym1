import { supabase } from '../lib/supabase'
import { getAppOrigin } from './appLinks'
import { isNativeApp } from './appMode'

const PENDING_KEY = 'pendingGoogleRegistration'
/** Custom scheme — must be in Supabase Auth → Redirect URLs */
export const NATIVE_OAUTH_REDIRECT = 'gym.qyntra.app://auth/callback'

export function getGoogleRedirectTo({ link = false } = {}) {
  if (isNativeApp()) {
    const url = new URL(NATIVE_OAUTH_REDIRECT)
    if (link) url.searchParams.set('link', '1')
    return url.toString()
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : getAppOrigin()
  const url = new URL(`${origin}/auth/callback`)
  if (link) url.searchParams.set('link', '1')
  return url.toString()
}

let oauthListenerReady = false

/**
 * Deep link / App Link return from Google OAuth (Custom Tabs).
 * Brings the callback URL into the Capacitor WebView and closes the browser.
 */
export async function ensureNativeOAuthListener() {
  if (!isNativeApp() || oauthListenerReady) return
  oauthListenerReady = true

  try {
    const { App } = await import('@capacitor/app')
    const { Browser } = await import('@capacitor/browser')

    await App.addListener('appUrlOpen', async ({ url }) => {
      if (!url || typeof url !== 'string') return
      const isAuthReturn =
        url.includes('auth/callback') ||
        url.startsWith('gym.qyntra.app://') ||
        url.includes('access_token=') ||
        url.includes('code=')
      if (!isAuthReturn) return

      try {
        await Browser.close()
      } catch {
        /* ignore */
      }

      const inAppUrl = normalizeOAuthReturnUrl(url)
      if (!inAppUrl) return

      // Load callback inside the app WebView (plugins + Preferences work here)
      window.location.href = inAppUrl
    })
  } catch (err) {
    console.warn('ensureNativeOAuthListener:', err?.message || err)
  }
}

/** gym.qyntra.app://auth/callback?... → https://localhost/auth/callback?... */
export function normalizeOAuthReturnUrl(rawUrl) {
  try {
    let raw = String(rawUrl || '').trim()
    if (!raw) return null

    if (raw.startsWith('gym.qyntra.app://')) {
      raw = raw.replace('gym.qyntra.app://', 'https://localhost/')
    }

    const u = new URL(raw)
    // Only accept auth callback paths
    if (!u.pathname.includes('auth/callback') && !u.hash.includes('access_token')) {
      // custom scheme host "auth" → path /callback
      if (u.host === 'auth' || u.pathname === '/callback' || u.pathname.endsWith('/callback')) {
        const q = u.search || ''
        const h = u.hash || ''
        return `https://localhost/auth/callback${q}${h}`
      }
    }

    if (u.pathname.includes('auth/callback') || u.hash.includes('access_token') || u.searchParams.has('code')) {
      return `https://localhost${u.pathname.startsWith('/') ? u.pathname : `/auth/callback`}${u.search}${u.hash}`
    }

    return null
  } catch {
    return null
  }
}

export async function startGoogleOAuth({ link = false } = {}) {
  await ensureNativeOAuthListener()

  const redirectTo = getGoogleRedirectTo({ link })

  if (isNativeApp()) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: true,
        queryParams: {
          access_type: 'offline',
          // Chrome Custom Tabs shows saved Google accounts; WebView does not
          prompt: 'select_account'
        }
      }
    })
    if (error) throw error
    if (!data?.url) throw new Error('No se recibió URL de Google')

    const { Browser } = await import('@capacitor/browser')
    await Browser.open({
      url: data.url,
      presentationStyle: 'popover',
      windowName: '_blank'
    })
    return data
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: link ? 'consent' : 'select_account'
      }
    }
  })
  if (error) throw error
  return data
}

export async function startGoogleLink() {
  return startGoogleOAuth({ link: true })
}

export function savePendingGoogleRegistration({ email, name, avatar } = {}) {
  try {
    sessionStorage.setItem(
      PENDING_KEY,
      JSON.stringify({
        email: (email || '').toLowerCase(),
        name: name || '',
        avatar: avatar || null,
        at: Date.now()
      })
    )
  } catch {
    /* ignore */
  }
}

export function readPendingGoogleRegistration() {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    // 30 minutes
    if (parsed?.at && Date.now() - parsed.at > 30 * 60 * 1000) {
      sessionStorage.removeItem(PENDING_KEY)
      return null
    }
    return parsed
  } catch {
    return null
  }
}

export function clearPendingGoogleRegistration() {
  try {
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    /* ignore */
  }
}

export async function getGoogleLinkedStatus() {
  const {
    data: { user },
    error
  } = await supabase.auth.getUser()
  if (error || !user) return { linked: false, email: null }
  const linked = (user.identities || []).some((i) => i.provider === 'google')
  return { linked, email: user.email || null }
}
