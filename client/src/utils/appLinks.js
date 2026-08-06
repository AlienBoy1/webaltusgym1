/**
 * App / invite deep links for shares (WhatsApp, native share, etc.)
 */

export function getAppOrigin() {
  const fromEnv = String(import.meta.env.VITE_APP_URL || '').trim().replace(/\/$/, '')
  if (fromEnv) return fromEnv
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return ''
}

/** Public landing / register URL with optional inviter ref */
export function getInviteUrl(inviterId) {
  const origin = getAppOrigin()
  const base = `${origin}/register`
  if (!inviterId) return base
  const params = new URLSearchParams({ ref: String(inviterId) })
  return `${base}?${params.toString()}`
}

export function buildInviteMessage({ inviterName, inviteUrl } = {}) {
  const name = inviterName?.trim() || 'Un amigo'
  const url = inviteUrl || getInviteUrl()
  return (
    `¡Hola! ${name} te invita a unirte a Qyntra Gym 🏋️\n\n` +
    `Entrena, sigue tu progreso y forma parte de la comunidad.\n\n` +
    `Únete aquí:\n${url}`
  )
}

export function buildPostShareText({ authorName, snippet, inviteUrl } = {}) {
  const url = inviteUrl || getInviteUrl()
  const who = authorName || 'Usuario'
  const what = snippet || 'Publicación de Qyntra Gym'
  return (
    `🏋️ Qyntra Gym\n` +
    `${who}: ${what}\n\n` +
    `Únete a la comunidad en Qyntra Gym:\n${url}`
  )
}
