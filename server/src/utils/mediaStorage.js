import { randomUUID } from 'crypto'
import { supabaseAdmin } from '../lib/supabase.js'

export const MEDIA_BUCKET = 'media'
const MAX_BYTES = 15 * 1024 * 1024

const MIME_EXT = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'audio/webm': 'webm',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg'
}

export function isHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

export function isInlineDataUrl(value) {
  return typeof value === 'string' && value.startsWith('data:') && value.includes(',')
}

export function isLocalOrIcon(value) {
  if (typeof value !== 'string' || !value) return false
  return value.startsWith('icon:') || value.startsWith('/')
}

/** Already a URL/path the client can load without Postgres blobs. */
export function isExternalMedia(value) {
  return isHttpUrl(value) || isLocalOrIcon(value)
}

function extForMime(mime) {
  const key = String(mime || '').toLowerCase().split(';')[0].trim()
  return MIME_EXT[key] || (key.startsWith('video/') ? 'mp4' : key.startsWith('audio/') ? 'webm' : 'jpg')
}

function parseDataUrl(dataUrl) {
  const raw = String(dataUrl)
  const comma = raw.indexOf(',')
  if (comma < 0) return null
  const header = raw.slice(5, comma) // after "data:"
  const payload = raw.slice(comma + 1)
  const mime = header.split(';')[0] || 'application/octet-stream'
  const isBase64 = /;base64/i.test(header)
  try {
    const buffer = isBase64
      ? Buffer.from(payload, 'base64')
      : Buffer.from(decodeURIComponent(payload), 'utf8')
    if (!buffer.length) return null
    return { mime, buffer }
  } catch {
    return null
  }
}

function publicUrlFor(path) {
  const { data } = supabaseAdmin.storage.from(MEDIA_BUCKET).getPublicUrl(path)
  return data?.publicUrl || null
}

/**
 * Upload a data URL (or pass through http/icon paths). Returns a stable public URL.
 * On Storage failure, returns the original value so UX does not break.
 */
export async function persistMedia(value, { folder, userId, id } = {}) {
  if (!value || typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  if (isExternalMedia(trimmed)) return trimmed
  if (!isInlineDataUrl(trimmed)) return trimmed

  const parsed = parseDataUrl(trimmed)
  if (!parsed) return trimmed
  if (parsed.buffer.length > MAX_BYTES) {
    const err = new Error('El archivo supera el límite de 5 MB')
    err.status = 413
    throw err
  }

  const owner = String(userId || 'shared').replace(/[^a-zA-Z0-9_-]/g, '')
  const safeFolder = String(folder || 'misc').replace(/[^a-zA-Z0-9/_-]/g, '')
  const name = `${id || randomUUID()}.${extForMime(parsed.mime)}`
  const path = `${safeFolder}/${owner}/${name}`

  const { error } = await supabaseAdmin.storage.from(MEDIA_BUCKET).upload(path, parsed.buffer, {
    contentType: parsed.mime,
    upsert: true,
    cacheControl: '31536000'
  })
  if (error) {
    console.warn('mediaStorage upload:', error.message)
    if (/bucket|not found|does not exist/i.test(error.message || '')) {
      console.warn('Crea el bucket `media` con supabase/migrations/APPLY_NOW_media_storage.sql')
    }
    return trimmed
  }
  return publicUrlFor(path) || trimmed
}

export async function persistMediaList(values, opts) {
  if (!Array.isArray(values)) return []
  const out = []
  for (let i = 0; i < values.length; i += 1) {
    out.push(await persistMedia(values[i], { ...opts, id: opts?.id ? `${opts.id}-${i}` : undefined }))
  }
  return out
}

/** For list payloads: never ship multi-MB data URLs. */
export function slimMediaForList(value, maxChars = 12_000) {
  if (value == null) return null
  const s = String(value)
  if (!s) return null
  if (isExternalMedia(s)) return s
  if (s.startsWith('data:') && s.length > maxChars) return null
  if (s.length > maxChars) return null
  return s
}

export async function migrateProfileMediaRow(row) {
  if (!row?.id) return row
  const patch = {}
  let profile = row.profile && typeof row.profile === 'object' ? { ...row.profile } : row.profile

  if (isInlineDataUrl(row.avatar)) {
    const next = await persistMedia(row.avatar, { folder: 'avatars', userId: row.id, id: 'avatar' })
    if (next && next !== row.avatar) {
      patch.avatar = next
      row.avatar = next
    }
  }
  if (profile && isInlineDataUrl(profile.coverUrl)) {
    const next = await persistMedia(profile.coverUrl, { folder: 'covers', userId: row.id, id: 'cover' })
    if (next && next !== profile.coverUrl) {
      profile = { ...profile, coverUrl: next }
      patch.profile = profile
      row.profile = profile
    }
  }

  if (Object.keys(patch).length) {
    await supabaseAdmin
      .from('profiles')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', row.id)
  }
  return row
}

/** Move inline images off Postgres without blocking the HTTP response. */
export function scheduleProfileMediaMigrate(rows) {
  const list = (Array.isArray(rows) ? rows : [rows]).filter(
    (row) =>
      row?.id &&
      (isInlineDataUrl(row.avatar) || isInlineDataUrl(row.profile?.coverUrl))
  )
  if (!list.length) return
  process.nextTick(() => {
    ;(async () => {
      for (const row of list.slice(0, 8)) {
        try {
          const { data } = await supabaseAdmin
            .from('profiles')
            .select('id, avatar, profile')
            .eq('id', row.id)
            .maybeSingle()
          if (data) await migrateProfileMediaRow(data)
        } catch (err) {
          console.warn('scheduleProfileMediaMigrate:', err?.message || err)
        }
      }
    })()
  })
}
