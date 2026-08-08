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

/** Deep link path to open a post in Comunidad (PostDetailSheet). */
export function getPostPath(postId) {
  if (!postId) return '/social'
  return `/social?post=${encodeURIComponent(String(postId))}`
}

export function getPostUrl(postId) {
  const origin = getAppOrigin()
  const path = getPostPath(postId)
  return origin ? `${origin}${path}` : path
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

export function buildPostShareText({ authorName, snippet, postUrl, inviteUrl } = {}) {
  const who = authorName || 'Usuario'
  const what = snippet || 'Publicación de Qyntra Gym'
  const link = postUrl || inviteUrl || getInviteUrl()
  return (
    `🏋️ Qyntra Gym\n` +
    `${who}: ${what}\n\n` +
    `Ver publicación:\n${link}`
  )
}

/** Deep link to Challenges page */
export function getChallengesUrl() {
  const origin = getAppOrigin()
  const path = '/challenges'
  return origin ? `${origin}${path}` : path
}

export function buildChallengeInviteShareText({
  challengeTitle,
  goalLabel,
  unit,
  xp,
  inviteUrl
} = {}) {
  const title = challengeTitle || 'Reto'
  const metaParts = []
  if (goalLabel != null) {
    metaParts.push(`Meta: ${goalLabel}${unit ? ` ${unit}` : ''}`)
  }
  if (xp != null) metaParts.push(`+${xp} XP`)
  const meta = metaParts.length ? `\n${metaParts.join(' · ')}` : ''
  const link = inviteUrl || getChallengesUrl() || getInviteUrl()
  return (
    `🎯 Qyntra Gym — ¡Únete a este reto!\n` +
    `${title}${meta}\n\n` +
    `Entra a Retos aquí:\n${link}`
  )
}
