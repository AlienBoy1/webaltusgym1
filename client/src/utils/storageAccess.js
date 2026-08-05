const STORAGE_KEY = 'qyntra:storage-access'

/** App-managed preference: user granted Qyntra access to device storage/gallery. */
export function getStorageAccessGranted() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function setStorageAccessGranted(granted) {
  try {
    localStorage.setItem(STORAGE_KEY, granted ? '1' : '0')
    window.dispatchEvent(new CustomEvent('qyntra:storage-access', { detail: { granted: !!granted } }))
  } catch {
    /* ignore */
  }
}

export function subscribeStorageAccess(callback) {
  const handler = () => callback(getStorageAccessGranted())
  window.addEventListener('qyntra:storage-access', handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener('qyntra:storage-access', handler)
    window.removeEventListener('storage', handler)
  }
}
