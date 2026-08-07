/**
 * Recover from post-deploy blank screens (stale chunk hashes / SW takeover).
 * Soft-reloads at most once per short window to avoid loops.
 */

const RELOAD_AT_KEY = 'qyntra:runtime_reload_at'
const COOLDOWN_MS = 45_000

function canSoftReload() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_AT_KEY) || 0)
    return !last || Date.now() - last > COOLDOWN_MS
  } catch {
    return true
  }
}

function markSoftReload() {
  try {
    sessionStorage.setItem(RELOAD_AT_KEY, String(Date.now()))
  } catch {
    /* ignore */
  }
}

function softReload(reason) {
  if (!canSoftReload()) return
  markSoftReload()
  console.warn(`[runtimeIntegrity] Reloading after ${reason}`)
  window.location.reload()
}

function isChunkLoadError(err) {
  if (!err) return false
  const msg = String(err?.message || err || '')
  return (
    err?.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    /Loading chunk [\d]+ failed/i.test(msg) ||
    /error loading dynamically imported module/i.test(msg)
  )
}

/** Call once from App boot. */
export function installRuntimeIntegrityGuards() {
  if (typeof window === 'undefined') return () => {}

  const onVitePreload = (event) => {
    try {
      event.preventDefault()
    } catch {
      /* ignore */
    }
    softReload('vite-preload')
  }

  const onRejection = (event) => {
    if (isChunkLoadError(event?.reason)) {
      softReload('chunk-reject')
    }
  }

  const onError = (event) => {
    if (isChunkLoadError(event?.error) || isChunkLoadError(event?.message)) {
      softReload('chunk-error')
    }
  }

  window.addEventListener('vite:preloadError', onVitePreload)
  window.addEventListener('unhandledrejection', onRejection)
  window.addEventListener('error', onError)

  let refreshing = false
  const onControllerChange = () => {
    // Skip while UpdateCenter is mid-theater (it reloads itself)
    if (document.body?.dataset?.qyntraUpdating === '1') return
    if (refreshing) return
    refreshing = true
    softReload('sw-controller')
  }
  navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)

  return () => {
    window.removeEventListener('vite:preloadError', onVitePreload)
    window.removeEventListener('unhandledrejection', onRejection)
    window.removeEventListener('error', onError)
    navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
  }
}
