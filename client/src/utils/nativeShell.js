/**
 * Init Capacitor native chrome. Must never hang the React boot.
 * Unregisters PWA service workers (common cause of blank WebView on Android).
 */
import { isNativeApp } from './appMode'

const BOOT_TIMEOUT_MS = 4000

async function withTimeout(promise, ms) {
  let timer
  try {
    return await Promise.race([
      promise,
      new Promise((resolve) => {
        timer = setTimeout(() => resolve('__timeout__'), ms)
      })
    ])
  } finally {
    clearTimeout(timer)
  }
}

/** Kill SW + caches so Capacitor always loads bundled assets. */
export async function disableNativeServiceWorkers() {
  if (!isNativeApp() || typeof navigator === 'undefined') return
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})))
    }
  } catch {
    /* ignore */
  }
  try {
    if (typeof caches !== 'undefined') {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})))
    }
  } catch {
    /* ignore */
  }
}

export async function initNativeShell() {
  if (!isNativeApp()) return

  try {
    await withTimeout(disableNativeServiceWorkers(), 1500)

    // Preferences → WebView MUST complete before React/authStore reads tokens
    const { hydrateNativeTokenStorage } = await import('./tokenStorage')
    const hydrated = await withTimeout(hydrateNativeTokenStorage(), 3000)
    if (hydrated === '__timeout__') {
      console.warn('hydrateNativeTokenStorage timed out — checkAuth will retry')
    }

    const { ensureNativeOAuthListener } = await import('./googleAuth')
    await withTimeout(ensureNativeOAuthListener(), 1000)

    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    // Only recover if WebView is clearly on the public site — never on localhost
    if (
      !path.startsWith('/auth/callback') &&
      !path.startsWith('/auth/native-handoff') &&
      typeof window !== 'undefined' &&
      String(window.location.hostname || '').includes('vercel.app')
    ) {
      const { recoverNativeLocalOrigin } = await import('./nativeOrigin')
      const redirected = await withTimeout(recoverNativeLocalOrigin(), 2000)
      if (redirected && redirected !== '__timeout__') return
    }

    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
      await StatusBar.setBackgroundColor({ color: '#0A0A0F' }).catch(() => {})
      await SplashScreen.hide().catch(() => {})
    } catch {
      /* optional chrome */
    }

    try {
      const { bindNativeWorkoutNotificationActions } = await import('./workoutSession')
      await bindNativeWorkoutNotificationActions()
    } catch {
      /* optional */
    }
  } catch (err) {
    console.warn('initNativeShell:', err?.message || err)
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await SplashScreen.hide().catch(() => {})
    } catch {
      /* ignore */
    }
  }
}

/** Bound for main.jsx so React always mounts. */
export async function initNativeShellSafe() {
  await withTimeout(initNativeShell(), BOOT_TIMEOUT_MS)
}
