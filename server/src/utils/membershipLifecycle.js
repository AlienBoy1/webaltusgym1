/**
 * Membership era schedule for Qyntra Gym.
 * Free/legacy catalog + user memberships retire Dec 31, 2026 23:59 (America/Mexico_City).
 * Admin-registered paid plans go public Jan 1, 2027 00:00 (same zone).
 */

/** Dec 31, 2026 23:59:59.999 CST (UTC-6) */
export const FREE_ERA_END = new Date('2026-12-31T23:59:59.999-06:00')
export const FREE_ERA_END_ISO = FREE_ERA_END.toISOString()

/** Jan 1, 2027 00:00:00.000 CST (UTC-6) */
export const PAID_ERA_START = new Date('2027-01-01T00:00:00.000-06:00')
export const PAID_ERA_START_ISO = PAID_ERA_START.toISOString()

export const MEMBERSHIP_ERA = {
  LEGACY: 'legacy',
  SCHEDULED_PAID: 'scheduled_paid',
  PAID: 'paid'
}

const DAY_MS = 24 * 60 * 60 * 1000

export function nowMs() {
  return Date.now()
}

export function isPastFreeEra(at = nowMs()) {
  return at > FREE_ERA_END.getTime()
}

export function isPaidEraLive(at = nowMs()) {
  return at >= PAID_ERA_START.getTime()
}

export function getPlanMeta(features = {}) {
  const meta = features?.__meta && typeof features.__meta === 'object' ? features.__meta : null
  return {
    era: meta?.era || MEMBERSHIP_ERA.LEGACY,
    publicFrom: meta?.publicFrom || null,
    retiresAt: meta?.retiresAt || FREE_ERA_END_ISO,
    isLegacyFree: meta?.isLegacyFree !== false && (meta?.era || MEMBERSHIP_ERA.LEGACY) === MEMBERSHIP_ERA.LEGACY
  }
}

export function withPlanMeta(features = {}, meta = {}) {
  const clean = { ...(features || {}) }
  clean.__meta = {
    era: meta.era || MEMBERSHIP_ERA.LEGACY,
    publicFrom: meta.publicFrom || null,
    retiresAt: meta.retiresAt || null,
    isLegacyFree: Boolean(meta.isLegacyFree)
  }
  return clean
}

export function stripPlanMetaFromFeatures(features = {}) {
  if (!features || typeof features !== 'object') return {}
  const { __meta, ...rest } = features
  return rest
}

export function resolvePlanLifecycle(row, at = nowMs()) {
  const meta = getPlanMeta(row?.features)
  const era = meta.era || MEMBERSHIP_ERA.LEGACY

  if (era === MEMBERSHIP_ERA.LEGACY) {
    const desiredActive = !isPastFreeEra(at)
    return {
      era,
      desiredActive,
      phase: desiredActive ? 'retiring' : 'retired',
      publicFrom: null,
      retiresAt: FREE_ERA_END_ISO,
      label: desiredActive ? 'Gratuita (vence 31 dic 2026)' : 'Retirada'
    }
  }

  if (era === MEMBERSHIP_ERA.SCHEDULED_PAID || era === MEMBERSHIP_ERA.PAID) {
    const live = isPaidEraLive(at)
    return {
      era: live ? MEMBERSHIP_ERA.PAID : MEMBERSHIP_ERA.SCHEDULED_PAID,
      desiredActive: live,
      phase: live ? 'public' : 'scheduled',
      publicFrom: PAID_ERA_START_ISO,
      retiresAt: null,
      label: live ? 'Pública' : 'Pendiente · 1 ene 2027'
    }
  }

  return {
    era,
    desiredActive: Boolean(row?.active),
    phase: row?.active ? 'public' : 'hidden',
    publicFrom: meta.publicFrom,
    retiresAt: meta.retiresAt,
    label: row?.active ? 'Activa' : 'Inactiva'
  }
}

/**
 * Normalize a user membership for the free → paid transition.
 * Returns { membership, changed }.
 */
export function normalizeUserMembership(membership, at = nowMs()) {
  const base = {
    plan: 'basic',
    status: 'active',
    startDate: new Date(at).toISOString(),
    ...(membership && typeof membership === 'object' ? membership : {})
  }

  // Paid-era assignments skip free-era caps
  if (base.era === MEMBERSHIP_ERA.PAID || base.__paidEra === true) {
    return { membership: base, changed: false }
  }

  let changed = false
  const next = { ...base }

  // Cap free-era end date
  const freeEnd = FREE_ERA_END.getTime()
  const currentEnd = next.endDate ? new Date(next.endDate).getTime() : null
  if (!currentEnd || Number.isNaN(currentEnd) || currentEnd > freeEnd) {
    next.endDate = FREE_ERA_END_ISO
    changed = true
  }

  next.era = MEMBERSHIP_ERA.LEGACY
  next.isLegacyFree = true

  const endMs = new Date(next.endDate).getTime()
  if (at > endMs) {
    if (next.status !== 'expired') {
      next.status = 'expired'
      changed = true
    }
  } else if (at > endMs - 45 * DAY_MS) {
    if (next.status === 'active') {
      next.status = 'expiring'
      changed = true
    }
  }

  if (next.isLegacyFree !== true) {
    next.isLegacyFree = true
    changed = true
  }

  return { membership: next, changed }
}

export function formatMembershipDate(iso, locale = 'es-MX') {
  if (!iso) return null
  try {
    return new Date(iso).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return String(iso)
  }
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
