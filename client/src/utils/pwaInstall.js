import { isInstalledApp } from './appMode'

const NEVER_KEY = 'qyntra_install_never'
const SESSION_KEY = 'qyntra_install_session_dismissed'

let deferredPrompt = null
const listeners = new Set()

function notify() {
  listeners.forEach((fn) => {
    try {
      fn(deferredPrompt)
    } catch {
      /* ignore */
    }
  })
}

/** Call once at app boot so we never lose the browser install event. */
export function captureInstallPrompt() {
  if (typeof window === 'undefined') return () => {}
  if (window.__qyntraInstallCapture) return () => {}
  window.__qyntraInstallCapture = true

  const onBip = (e) => {
    e.preventDefault()
    deferredPrompt = e
    notify()
  }
  const onInstalled = () => {
    deferredPrompt = null
    try {
      localStorage.removeItem(NEVER_KEY)
      sessionStorage.removeItem(SESSION_KEY)
    } catch {
      /* ignore */
    }
    notify()
  }

  window.addEventListener('beforeinstallprompt', onBip)
  window.addEventListener('appinstalled', onInstalled)
  return () => {
    window.removeEventListener('beforeinstallprompt', onBip)
    window.removeEventListener('appinstalled', onInstalled)
    window.__qyntraInstallCapture = false
  }
}

export function getDeferredInstallPrompt() {
  return deferredPrompt
}

export function subscribeInstallPrompt(fn) {
  listeners.add(fn)
  fn(deferredPrompt)
  return () => listeners.delete(fn)
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null
  notify()
}

export function detectInstallPlatform() {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent || ''
  if (/android/i.test(ua)) return 'android'
  if (/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/Win/i.test(navigator.platform || ua)) return 'windows'
  if (/Mac/i.test(navigator.platform || ua)) return 'mac'
  return 'desktop'
}

/**
 * @param {{ isLoggedIn?: boolean }} [opts]
 * Guests: every page load (closing is non-persistent).
 * Logged-in: every visit/session until permanent "never show".
 */
export function shouldOfferInstall(opts = {}) {
  if (typeof window === 'undefined') return false
  if (isInstalledApp()) return false
  const isLoggedIn = Boolean(opts.isLoggedIn)
  try {
    if (isLoggedIn && localStorage.getItem(NEVER_KEY) === '1') return false
    // Session snooze only applies to logged-in users after "Ahora no"
    if (isLoggedIn && sessionStorage.getItem(SESSION_KEY) === '1') return false
  } catch {
    /* ignore */
  }
  return true
}

/** Close for this browser tab/session only — shows again next visit. */
export function dismissInstallForSession() {
  try {
    sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    /* ignore */
  }
}

/** Permanent dismiss — only for authenticated users. */
export function neverShowInstallPrompt() {
  try {
    localStorage.setItem(NEVER_KEY, '1')
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

/** @deprecated use dismissInstallForSession / neverShowInstallPrompt */
export function dismissInstallPrompt() {
  dismissInstallForSession()
}

export async function promptNativeInstall() {
  const evt = deferredPrompt
  if (!evt) return { ok: false, reason: 'unavailable' }
  try {
    evt.prompt()
    const { outcome } = await evt.userChoice
    clearDeferredInstallPrompt()
    return { ok: outcome === 'accepted', outcome }
  } catch {
    return { ok: false, reason: 'error' }
  }
}
