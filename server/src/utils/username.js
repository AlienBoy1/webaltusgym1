/**
 * Username rules (Instagram/FB style): 3–20 chars, [a-z0-9._], lowercase.
 */

export const USERNAME_MIN = 3
export const USERNAME_MAX = 20
export const USERNAME_REGEX = /^[a-z0-9._]{3,20}$/

const RESERVED = new Set([
  'admin',
  'administrador',
  'qyntra',
  'qyntragym',
  'support',
  'soporte',
  'help',
  'ayuda',
  'oficial',
  'official',
  'root',
  'system',
  'null',
  'undefined',
  'me',
  'api',
  'www'
])

export function normalizeUsername(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
}

export function validateUsernameFormat(raw) {
  const username = normalizeUsername(raw)
  if (!username) {
    return { ok: false, username: '', message: 'El username es obligatorio' }
  }
  if (username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
    return {
      ok: false,
      username,
      message: `Usa entre ${USERNAME_MIN} y ${USERNAME_MAX} caracteres`
    }
  }
  if (!USERNAME_REGEX.test(username)) {
    return {
      ok: false,
      username,
      message: 'Solo letras minúsculas, números, punto y guion bajo'
    }
  }
  if (username.startsWith('.') || username.endsWith('.') || username.includes('..')) {
    return { ok: false, username, message: 'El username no puede empezar/terminar con punto' }
  }
  if (RESERVED.has(username)) {
    return { ok: false, username, message: 'Este username no está disponible' }
  }
  return { ok: true, username, message: '' }
}

/** Extract unique @handles from free text */
export function extractMentionUsernames(text) {
  const found = new Set()
  const re = /@([a-z0-9._]{3,20})\b/gi
  let m
  const src = String(text || '')
  while ((m = re.exec(src))) {
    const n = normalizeUsername(m[1])
    if (USERNAME_REGEX.test(n) && !RESERVED.has(n)) found.add(n)
  }
  return [...found]
}
