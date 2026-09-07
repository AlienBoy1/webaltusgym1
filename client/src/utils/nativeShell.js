/**
 * Init Capacitor native chrome (status bar, splash). Safe no-op on web.
 */
export async function initNativeShell() {
  try {
    const { Capacitor } = await import('@capacitor/core')
    if (!Capacitor.isNativePlatform()) return

    const { StatusBar, Style } = await import('@capacitor/status-bar')
    const { SplashScreen } = await import('@capacitor/splash-screen')

    await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
    await StatusBar.setBackgroundColor({ color: '#0A0A0F' }).catch(() => {})
    await SplashScreen.hide().catch(() => {})
  } catch {
    /* Capacitor plugins unavailable on web */
  }
}
