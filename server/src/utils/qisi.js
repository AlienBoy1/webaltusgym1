/** QySi — Sistema inteligente Qyntra interno */

export const QISI_USERNAME = 'qyntra_inner'
export const QISI_HANDLE = 'Qyntra-inner'
export const QISI_NAME = 'QySi'
export const QISI_MEANING = 'Sistema inteligente Qyntra interno'
export const QISI_TAGLINE = 'Qyntra-inner · trainer inteligente'
export const QISI_EMAIL = 'qisi@qyntra.internal'
export const QISI_SOURCE_KIND = 'qisi'
export const QISI_LAUNCH_STORY_KEY = 'qisi-launch-v1'

export const QISI_MESSAGING_TITLE = 'QySi se está preparando'
export const QISI_MESSAGING_COPY =
  'QySi se está preparando para funcionar como sistema inteligente de mensajería y resolver tus dudas sobre ejercicio. Inténtalo de nuevo en el futuro.'
export const QISI_MESSAGING_CODE = 'QISI_MESSAGING_UNAVAILABLE'

export function normalizeHandle(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
}

export function isQiSiUsername(username) {
  const u = normalizeHandle(username)
  return (
    u === QISI_USERNAME ||
    u === 'qyntra-inner' ||
    u === 'qisi' ||
    u === 'qysi' ||
    u === 'siqi'
  )
}

export function isQiSiProfile(userOrProfile) {
  if (!userOrProfile) return false
  if (userOrProfile.isQiSi || userOrProfile.is_qisi || userOrProfile.isQiSi) return true
  if (userOrProfile.settings?.systemKind === 'qisi') return true
  if (userOrProfile.profile?.isQiSi || userOrProfile.profile?.isQiSi) return true
  return isQiSiUsername(userOrProfile.username)
}

export function isQiSiRoutine(rowOrTemplate) {
  if (!rowOrTemplate) return false
  if (
    rowOrTemplate.isQiSi ||
    rowOrTemplate.isQiSi ||
    rowOrTemplate.sourceKind === QISI_SOURCE_KIND
  ) {
    return true
  }
  if (rowOrTemplate.source_kind === QISI_SOURCE_KIND) return true
  const creator = rowOrTemplate.originalCreator || rowOrTemplate.user
  if (isQiSiProfile(creator)) return true
  return false
}

export function qisiPublicBlockMessage() {
  return (
    'Esta rutina pertenece a QySi, nuestro Sistema inteligente Qyntra interno (@Qyntra-inner). ' +
    'Las rutinas de QySi no se pueden hacer públicas ni aparecen en Explorar rutinas.'
  )
}

export function displayQiSiHandle(username) {
  if (isQiSiUsername(username)) return QISI_HANDLE
  return String(username || '').replace(/^@+/, '')
}
