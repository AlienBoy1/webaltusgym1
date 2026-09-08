/**
 * Init Capacitor native chrome (status bar, splash). Safe no-op on web.
 * Hydrates remember-me tokens from Preferences, then recovers if OAuth left
 * the WebView on the public Vercel host.
 */
export async function initNativeShell() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return

    const { hydrateNativeTokenStorage } = await import('./tokenStorage')
    await hydrateNativeTokenStorage()

    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    // Let /auth/callback finish on Vercel, then it hands off itself.
    if (!path.startsWith('/auth/callback') && !path.startsWith('/auth/native-handoff')) {
      const { recoverNativeLocalOrigin } = await import('./nativeOrigin')
      const redirected = await recoverNativeLocalOrigin()
      if (redirected) return
    }

    const { StatusBar, Style } = await import('@capacitor/status-bar')
    const { SplashScreen } = await import('@capacitor/splash-screen')

    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    await StatusBar.setBackgroundColor({ color: '#0A0A0F' }).catch(() => {})
    await SplashScreen.hide().catch(() => {})

    // Tap on workout local notification → open Entrenos
    try {
      const { LocalNotifications } = await import('@capacitor/local-notifications')
      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        const url = event?.notification?.extra?.url || '/workouts'
        if (typeof window !== 'undefined') {
          window.location.assign(url.startsWith('/') ? url : `/${url}`)
        }
      })
    } catch {
      /* optional */
    }
  } catch {
    /* Capacitor plugins unavailable on web */
  }
}
