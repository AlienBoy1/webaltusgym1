/**
 * Reliable canvas → image export + native/web file sharing.
 * Avoids huge PNG dataURLs (OOM) and WebView file-share gaps on Android.
 */

import { isNativeApp } from './appMode'

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.88) {
  return new Promise((resolve, reject) => {
    try {
      if (canvas.toBlob) {
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size > 0) resolve(blob)
            else reject(new Error('toBlob vacío'))
          },
          type,
          quality
        )
        return
      }
      const dataUrl = canvas.toDataURL(type, quality)
      fetch(dataUrl)
        .then((r) => r.blob())
        .then(resolve)
        .catch(reject)
    } catch (err) {
      reject(err)
    }
  })
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
}

function blobToBase64(blob) {
  return blobToDataUrl(blob).then((dataUrl) => {
    const i = dataUrl.indexOf(',')
    return i >= 0 ? dataUrl.slice(i + 1) : dataUrl
  })
}

/**
 * Export share canvas as compact JPEG data URL (previews + legacy callers).
 */
export async function exportCanvasDataUrl(canvas, { quality = 0.88 } = {}) {
  try {
    const blob = await canvasToBlob(canvas, 'image/jpeg', quality)
    return await blobToDataUrl(blob)
  } catch (jpegErr) {
    try {
      const blob = await canvasToBlob(canvas, 'image/png')
      return await blobToDataUrl(blob)
    } catch (pngErr) {
      // Last resort — may throw SecurityError if canvas is tainted
      try {
        return canvas.toDataURL('image/jpeg', quality)
      } catch {
        throw jpegErr || pngErr
      }
    }
  }
}

export async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl)
  return res.blob()
}

export async function dataUrlToFile(dataUrl, filename = 'qyntra-share.jpg') {
  const blob = await dataUrlToBlob(dataUrl)
  const type = blob.type || (filename.endsWith('.png') ? 'image/png' : 'image/jpeg')
  const safeName = type.includes('jpeg') || type.includes('jpg')
    ? filename.replace(/\.png$/i, '.jpg')
    : filename
  return new File([blob], safeName, { type })
}

/**
 * Share an image file via Capacitor Share (Android) or Web Share API.
 * @returns {{ mode: 'capacitor'|'web'|'text'|'download', shared: boolean }}
 */
export async function shareImageFile({
  dataUrl,
  blob,
  filename = 'qyntra-share.jpg',
  title = 'Qyntra Gym',
  text = '',
  url = ''
} = {}) {
  let fileBlob = blob
  if (!fileBlob && dataUrl) fileBlob = await dataUrlToBlob(dataUrl)
  if (!fileBlob) throw new Error('Sin imagen para compartir')

  const type = fileBlob.type || 'image/jpeg'
  const safeName =
    type.includes('png') && !filename.endsWith('.png')
      ? filename.replace(/\.(jpe?g)$/i, '.png')
      : type.includes('jpeg') || type.includes('jpg')
        ? filename.replace(/\.png$/i, '.jpg')
        : filename

  if (isNativeApp()) {
    try {
      const { Filesystem, Directory } = await import('@capacitor/filesystem')
      const { Share } = await import('@capacitor/share')
      const base64 = await blobToBase64(fileBlob)
      const path = `share/${Date.now()}-${safeName}`
      await Filesystem.writeFile({
        path,
        data: base64,
        directory: Directory.Cache
      })
      const { uri } = await Filesystem.getUri({
        path,
        directory: Directory.Cache
      })
      await Share.share({
        title,
        text: text || undefined,
        url: url || undefined,
        files: [uri],
        dialogTitle: title
      })
      return { mode: 'capacitor', shared: true }
    } catch (err) {
      if (err?.message === 'Share canceled' || /cancel/i.test(err?.message || '')) {
        return { mode: 'capacitor', shared: true }
      }
      console.warn('Capacitor Share failed, trying Web Share:', err?.message || err)
    }
  }

  const file = new File([fileBlob], safeName, { type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: text || undefined,
        url: url || undefined
      })
      return { mode: 'web', shared: true }
    } catch (err) {
      if (err?.name === 'AbortError') return { mode: 'web', shared: true }
      throw err
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title,
        text: text || undefined,
        url: url || undefined
      })
      return { mode: 'text', shared: true }
    } catch (err) {
      if (err?.name === 'AbortError') return { mode: 'text', shared: true }
      throw err
    }
  }

  return { mode: 'download', shared: false }
}
