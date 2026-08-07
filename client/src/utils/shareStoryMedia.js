/**
 * Save / share story media to external apps (IG / FB stories via native share sheet).
 * Web cannot publish directly into IG/FB Stories APIs without native SDKs;
 * navigator.share({ files }) is the supported PWA path.
 */

function extFromMime(mime, mediaType) {
  if (mime?.includes('png')) return 'png'
  if (mime?.includes('webp')) return 'webp'
  if (mime?.includes('gif')) return 'gif'
  if (mime?.includes('mp4')) return 'mp4'
  if (mime?.includes('webm')) return 'webm'
  return mediaType === 'video' ? 'mp4' : 'jpg'
}

export async function fetchStoryBlob(mediaUrl, mediaType = 'image') {
  if (!mediaUrl) throw new Error('Sin media')

  if (mediaUrl.startsWith('data:')) {
    const res = await fetch(mediaUrl)
    const blob = await res.blob()
    const mime = blob.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg')
    return { blob, mime, filename: `qyntra-story.${extFromMime(mime, mediaType)}` }
  }

  const res = await fetch(mediaUrl, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
  if (!res.ok) throw new Error('No se pudo descargar el archivo')
  const blob = await res.blob()
  const mime = blob.type || (mediaType === 'video' ? 'video/mp4' : 'image/jpeg')
  return { blob, mime, filename: `qyntra-story.${extFromMime(mime, mediaType)}` }
}

export async function saveStoryMedia(mediaUrl, mediaType = 'image') {
  const { blob, filename } = await fetchStoryBlob(mediaUrl, mediaType)
  const objectUrl = URL.createObjectURL(blob)
  try {
    const a = document.createElement('a')
    a.href = objectUrl
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2500)
  }
  return true
}

async function shareWithFiles(file, title, text) {
  if (!navigator.share) return false
  const payload = { files: [file], title, text }
  if (navigator.canShare && !navigator.canShare(payload)) {
    // Some browsers accept share without files
    try {
      await navigator.share({ title, text })
      return true
    } catch (err) {
      if (err?.name === 'AbortError') return true
      return false
    }
  }
  try {
    await navigator.share(payload)
    return true
  } catch (err) {
    if (err?.name === 'AbortError') return true
    return false
  }
}

/**
 * Prefer native share sheet (user picks Instagram / Facebook Stories).
 * Falls back to download + deep-link / tip.
 */
export async function shareStoryToNetwork(mediaUrl, mediaType, network) {
  const label = network === 'facebook' ? 'Facebook' : 'Instagram'
  const { blob, mime, filename } = await fetchStoryBlob(mediaUrl, mediaType)
  const file = new File([blob], filename, { type: mime })

  const shared = await shareWithFiles(
    file,
    `Historia Qyntra · ${label}`,
    `Compartir en historias de ${label}`
  )
  if (shared) return { mode: 'native' }

  await saveStoryMedia(mediaUrl, mediaType)

  // Best-effort open create surfaces (may no-op on desktop / restricted browsers)
  try {
    if (network === 'instagram') {
      window.location.href = 'instagram://story-camera'
    } else if (network === 'facebook') {
      window.open('https://www.facebook.com/stories/create', '_blank', 'noopener,noreferrer')
    }
  } catch {
    /* ignore */
  }

  return { mode: 'download' }
}
