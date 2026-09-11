/**
 * Init Capacitor native chrome. Must never hang the React boot.
 * Unregisters PWA service workers (common cause of blank WebView on Android).
 */
import { isNativeApp } from './appMode'

const BOOT_TIMEOUT_MS = 1800

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
    // Parallelize non-dependent boot work
    const hydrateP = (async () => {
      const { hydrateNativeTokenStorage } = await import('./tokenStorage')
      return withTimeout(hydrateNativeTokenStorage(), 900)
    })()

    await Promise.all([
      withTimeout(disableNativeServiceWorkers(), 700),
      hydrateP
    ])

    const { ensureNativeOAuthListener } = await import('./googleAuth')
    void withTimeout(ensureNativeOAuthListener(), 600)

    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    if (
      !path.startsWith('/auth/callback') &&
      !path.startsWith('/auth/native-handoff') &&
      typeof window !== 'undefined' &&
      String(window.location.hostname || '').includes('vercel.app')
    ) {
      const { recoverNativeLocalOrigin } = await import('./nativeOrigin')
      const redirected = await withTimeout(recoverNativeLocalOrigin(), 1200)
      if (redirected && redirected !== '__timeout__') return
    }

    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar')
      const { SplashScreen } = await import('@capacitor/splash-screen')
      await Promise.all([
        StatusBar.setStyle({ style: Style.Dark }).catch(() => {}),
        StatusBar.setBackgroundColor({ color: '#0A0A0F' }).catch(() => {}),
        SplashScreen.hide().catch(() => {})
      ])
    } catch {
      /* optional chrome */
    }

    try {
      const { bindNativeWorkoutNotificationActions } = await import('./workoutSession')
      void bindNativeWorkoutNotificationActions()
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
