/** Detect Capacitor native shell (Android/iOS). */
export function isNativeApp() {
  if (typeof window === 'undefined') return false
  try {
    const cap = window.Capacitor
    if (cap?.isNativePlatform?.()) return true
    if (cap?.getPlatform?.() === 'android' || cap?.getPlatform?.() === 'ios') return true
  } catch {
    /* ignore */
  }
  return false
}

/** Detect installed PWA / standalone / native app (not browser tab). */
export function isInstalledApp() {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return true
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
    // iOS Safari
    if (navigator.standalone === true) return true
    // Some Android TWA / trusted web activity
    if (document.referrer?.includes('android-app://')) return true
  } catch {
    /* ignore */
  }
  return false
}
