import { isPastFreeEra, isPaidEraLive } from './membershipLifecycle.js'

/**
 * Body hub access: free during FREE_ERA; after cutover requires plan flag
 * accessToBodyHealth (or premium-ish fallbacks) and non-expired membership.
 */
export function canAccessBodyHealth(user, at = Date.now()) {
  if (!isPastFreeEra(at) && !isPaidEraLive(at)) {
    return { allowed: true, reason: 'free_era' }
  }
  // Transition window: still free until paid era is live
  if (!isPaidEraLive(at)) {
    return { allowed: true, reason: 'free_era' }
  }

  const status = user?.membership?.status
  if (status === 'expired') {
    return { allowed: false, reason: 'membership_expired' }
  }

  const features = user?.membership?.features || {}
  if (
    features.accessToBodyHealth === true ||
    features.nutritionPlan === true ||
    features.accessToReports === true ||
    features.personalTrainer === true
  ) {
    return { allowed: true, reason: 'plan_feature' }
  }

  // Paid era but plan has no flag yet — allow basic/premium defaults softly
  const plan = user?.membership?.plan
  if (plan === 'premium' || plan === 'elite' || plan === 'annual') {
    return { allowed: true, reason: 'plan_tier' }
  }

  return { allowed: false, reason: 'plan_missing_feature' }
}

export function bodyAccessMiddleware(req, res, next) {
  const gate = canAccessBodyHealth(req.user)
  if (!gate.allowed) {
    return res.status(403).json({
      message: 'El hub de cuerpo y métricas requiere un plan activo con esta función.',
      code: 'BODY_HEALTH_LOCKED',
      reason: gate.reason
    })
  }
  req.bodyAccess = gate
  return next()
}
