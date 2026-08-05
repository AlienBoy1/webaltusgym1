/** Detect installed PWA / standalone app (not browser tab). */
export function isInstalledApp() {
  if (typeof window === 'undefined') return false
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
