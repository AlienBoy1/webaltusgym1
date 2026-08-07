/**
 * Client-side membership era schedule (mirrors server/src/utils/membershipLifecycle.js).
 */

export const FREE_ERA_END = new Date('2026-12-31T23:59:59.999-06:00')
export const FREE_ERA_END_ISO = FREE_ERA_END.toISOString()
export const PAID_ERA_START = new Date('2027-01-01T00:00:00.000-06:00')
export const PAID_ERA_START_ISO = PAID_ERA_START.toISOString()

export function isPastFreeEra(at = Date.now()) {
  return at > FREE_ERA_END.getTime()
}

export function isPaidEraLive(at = Date.now()) {
  return at >= PAID_ERA_START.getTime()
}

export function freeEraEndLabel(locale = 'es-MX') {
  return FREE_ERA_END.toLocaleString(locale, {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export function paidEraStartLabel(locale = 'es-MX') {
  return PAID_ERA_START.toLocaleString(locale, {
    timeZone: 'America/Mexico_City',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  })
}

export function formatMembershipDate(iso, locale = 'es-MX') {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  } catch {
    return String(iso)
  }
}

export function membershipStatusLabel(status) {
  if (status === 'active') return 'Activa'
  if (status === 'expiring') return 'Por vencer'
  if (status === 'expired') return 'Vencida'
  if (status === 'scheduled') return 'Programada'
  return status || '—'
}

export function getPlanMeta(features = {}) {
  const meta = features?.__meta && typeof features.__meta === 'object' ? features.__meta : null
  return {
    era: meta?.era || 'legacy',
    publicFrom: meta?.publicFrom || null,
    retiresAt: meta?.retiresAt || FREE_ERA_END_ISO,
    isLegacyFree: meta?.isLegacyFree !== false && (meta?.era || 'legacy') === 'legacy'
  }
}

export function displayFeatures(features = {}) {
  if (!features || typeof features !== 'object') return {}
  const { __meta, ...rest } = features
  return rest
}

export const FEATURE_LABELS = {
  accessToClasses: 'Clases',
  accessToChallenges: 'Retos',
  accessToSocial: 'Social',
  accessToChat: 'Chat',
  accessToReports: 'Reportes',
  personalTrainer: 'Entrenador personal',
  nutritionPlan: 'Plan nutricional'
}
