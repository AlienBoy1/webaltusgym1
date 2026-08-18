import { supabaseAdmin } from '../lib/supabase.js'
import {
  FREE_ERA_END_ISO,
  MEMBERSHIP_ERA,
  PAID_ERA_START_ISO,
  getPlanMeta,
  isPaidEraLive,
  isPastFreeEra,
  normalizeUserMembership,
  resolvePlanLifecycle,
  stripPlanMetaFromFeatures,
  withPlanMeta
} from '../utils/membershipLifecycle.js'

export function mapMembershipPlanRow(row) {
  if (!row) return null
  const lifecycle = resolvePlanLifecycle(row)
  const meta = getPlanMeta(row.features)
  return {
    _id: row.id,
    id: row.id,
    plan: row.plan,
    name: row.name,
    description: row.description || '',
    price: Number(row.price) || 0,
    duration: row.duration,
    durationUnit: row.duration_unit || 'days',
    benefits: row.benefits || [],
    features: stripPlanMetaFromFeatures(row.features || {}),
    featuresRaw: row.features || {},
    active: Boolean(row.active),
    era: lifecycle.era,
    phase: lifecycle.phase,
    lifecycleLabel: lifecycle.label,
    publicFrom: lifecycle.publicFrom || meta.publicFrom,
    retiresAt: lifecycle.retiresAt || meta.retiresAt,
    isLegacyFree: meta.isLegacyFree || lifecycle.era === MEMBERSHIP_ERA.LEGACY,
    createdAt: row.created_at
  }
}

/**
 * Tag legacy plans + flip active flags for free→paid cutover.
 */
let lastPlanSyncAt = 0
const PLAN_SYNC_TTL_MS = 30 * 60 * 1000

export async function syncMembershipPlansLifecycle({ force = false } = {}) {
  if (!force && Date.now() - lastPlanSyncAt < PLAN_SYNC_TTL_MS) return
  lastPlanSyncAt = Date.now()

  const { data: rows, error } = await supabaseAdmin
    .from('membership_plans')
    .select('id, plan, name, description, price, duration, duration_unit, benefits, features, active, created_at')
  if (error) throw error

  for (const row of rows || []) {
    const meta = getPlanMeta(row.features)
    let features = row.features || {}
    let needsMeta = !row.features?.__meta

    // Untagged plans are treated as legacy free-era catalog
    if (needsMeta) {
      features = withPlanMeta(features, {
        era: MEMBERSHIP_ERA.LEGACY,
        retiresAt: FREE_ERA_END_ISO,
        isLegacyFree: true,
        publicFrom: null
      })
    } else if (meta.era === MEMBERSHIP_ERA.LEGACY && !meta.retiresAt) {
      features = withPlanMeta(features, {
        ...meta,
        retiresAt: FREE_ERA_END_ISO,
        isLegacyFree: true
      })
      needsMeta = true
    }

    const lifecycle = resolvePlanLifecycle({ ...row, features })
    const update = {}
    if (needsMeta || JSON.stringify(features) !== JSON.stringify(row.features || {})) {
      update.features = features
    }
    if (Boolean(row.active) !== Boolean(lifecycle.desiredActive)) {
      update.active = lifecycle.desiredActive
    }

    // Promote scheduled → paid meta when live
    if (
      isPaidEraLive() &&
      getPlanMeta(features).era === MEMBERSHIP_ERA.SCHEDULED_PAID
    ) {
      update.features = withPlanMeta(features, {
        era: MEMBERSHIP_ERA.PAID,
        publicFrom: PAID_ERA_START_ISO,
        isLegacyFree: false,
        retiresAt: null
      })
      update.active = true
    }

    if (Object.keys(update).length) {
      await supabaseAdmin.from('membership_plans').update(update).eq('id', row.id)
    }
  }
}

export async function syncUserMembershipOnProfile(profile) {
  if (!profile?.id) return profile
  const { membership, changed } = normalizeUserMembership(profile.membership)
  if (!changed) {
    return { ...profile, membership }
  }
  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ membership, updated_at: new Date().toISOString() })
    .eq('id', profile.id)
  if (error) {
    return { ...profile, membership }
  }
  return { ...profile, membership }
}

export function buildScheduledPaidFeatures(featureFlags = {}) {
  return withPlanMeta(featureFlags, {
    era: MEMBERSHIP_ERA.SCHEDULED_PAID,
    publicFrom: PAID_ERA_START_ISO,
    isLegacyFree: false,
    retiresAt: null
  })
}

export function buildLegacyFeatures(featureFlags = {}) {
  return withPlanMeta(featureFlags, {
    era: MEMBERSHIP_ERA.LEGACY,
    retiresAt: FREE_ERA_END_ISO,
    isLegacyFree: true,
    publicFrom: null
  })
}

export { isPastFreeEra, isPaidEraLive, FREE_ERA_END_ISO, PAID_ERA_START_ISO, MEMBERSHIP_ERA }
