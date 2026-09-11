/**
 * Save / share story media to external apps (IG / FB stories via native share sheet).
 */

import { shareImageFile } from './shareImageExport'
import { isNativeApp } from './appMode'

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

  if (isNativeApp()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const reader = new FileReader()
      const base64 = await new Promise((resolve, reject) => {
        reader.onload = () => {
          const s = String(reader.result || '')
          const i = s.indexOf(',')
          resolve(i >= 0 ? s.slice(i + 1) : s)
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(blob)
      })
      const path = `share/${filename}`
      await Filesystem.writeFile({ path, data: base64, directory: Directory.Cache })
      const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache })
      await Share.share({
        title: 'Guardar historia Qyntra',
        files: [uri],
        dialogTitle: 'Guardar o compartir'
      })
      return true
    } catch (err) {
      if (/cancel/i.test(err?.message || '')) return true
      console.warn('native saveStoryMedia:', err?.message || err)
    }
  }

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

/**
 * Prefer native share sheet (user picks Instagram / Facebook Stories).
 * Falls back to download + deep-link / tip.
 */
export async function shareStoryToNetwork(mediaUrl, mediaType, network) {
  const label =
    network === 'facebook' ? 'Facebook' : network === 'whatsapp' ? 'WhatsApp' : 'Instagram'
  const { blob, filename } = await fetchStoryBlob(mediaUrl, mediaType)

  if (mediaType !== 'video') {
    const result = await shareImageFile({
      blob,
      filename,
      title: `Historia Qyntra · ${label}`,
      text: network === 'whatsapp' ? 'Historia de Qyntra Gym' : `Compartir en historias de ${label}`
    })
    if (result.shared) return { mode: result.mode }
  } else if (navigator.share) {
    const file = new File([blob], filename, { type: blob.type || 'video/mp4' })
    try {
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Historia Qyntra · ${label}`,
          text: network === 'whatsapp' ? 'Historia de Qyntra Gym' : `Compartir en historias de ${label}`
        })
        return { mode: 'web' }
      }
    } catch (err) {
      if (err?.name === 'AbortError') return { mode: 'web' }
    }
  }

  await saveStoryMedia(mediaUrl, mediaType)

  try {
    if (network === 'instagram') {
      window.location.href = 'instagram://story-camera'
    } else if (network === 'facebook') {
      window.open('https://www.facebook.com/stories/create', '_blank', 'noopener,noreferrer')
    } else if (network === 'whatsapp') {
      window.open('https://wa.me/', '_blank', 'noopener,noreferrer')
    }
  } catch {
    /* ignore */
  }

  return { mode: 'download' }
}
