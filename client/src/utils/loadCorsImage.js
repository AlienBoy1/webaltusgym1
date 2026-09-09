/**
 * Load remote images for canvas export without tainting the canvas.
 * Prefer fetch→blob→objectURL so drawImage is same-origin to the blob.
 */

function loadFromUrl(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (!String(src).startsWith('blob:') && !String(src).startsWith('data:')) {
      img.crossOrigin = 'anonymous'
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('image load failed'))
    img.src = src
  })
}

export async function loadCorsImage(src) {
  if (!src) throw new Error('empty src')
  const s = String(src)

  if (s.startsWith('data:') || s.startsWith('blob:')) {
    return loadFromUrl(s)
  }

  // Relative / same-origin assets
  if (s.startsWith('/') && typeof window !== 'undefined') {
    try {
      return await loadFromUrl(new URL(s, window.location.href).href)
    } catch {
      /* continue */
    }
  }

  try {
    const res = await fetch(s, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const blob = await res.blob()
    const objectUrl = URL.createObjectURL(blob)
    try {
      return await loadFromUrl(objectUrl)
    } finally {
      URL.revokeObjectURL(objectUrl)
    }
  } catch {
    // Fallback: may fail export if tainted — callers should catch
    return loadFromUrl(s)
  }
}
