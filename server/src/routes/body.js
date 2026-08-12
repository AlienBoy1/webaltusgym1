import express from 'express'
import { authenticate, invalidateAuthProfileCache } from '../middleware/auth.js'
import { supabaseAdmin } from '../lib/supabase.js'
import {
  normalizeBodySnapshot,
  computeMetrics,
  buildRoutineTips,
  recommendFromBody,
  validateProfilePatch,
  mapGoalDetailToTopGoal,
  clampNum,
  buildTrainingAnalytics
} from '../utils/bodyMetrics.js'
import { listEducation, getEducation } from '../data/bodyEducation.js'
import { bodyAccessMiddleware } from '../utils/bodyAccess.js'

const router = express.Router()

router.use(authenticate, bodyAccessMiddleware)

function mapCheckin(row) {
  if (!row) return null
  return {
    id: row.id,
    _id: row.id,
    userId: row.user_id,
    recordedAt: row.recorded_at,
    weightKg: row.weight_kg != null ? Number(row.weight_kg) : null,
    bodyFatPct: row.body_fat_pct != null ? Number(row.body_fat_pct) : null,
    waistCm: row.waist_cm != null ? Number(row.waist_cm) : null,
    hipCm: row.hip_cm != null ? Number(row.hip_cm) : null,
    note: row.note || null,
    source: row.source || 'manual'
  }
}

async function loadProfileRow(userId) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, goal, profile, stats, settings, membership')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

async function loadWorkoutsForCharts(userId) {
  const { data, error } = await supabaseAdmin
    .from('workouts')
    .select('id, name, exercises, completed_at, created_at')
    .eq('user_id', userId)
    .order('completed_at', { ascending: true })
    .limit(180)
  if (error) throw error
  return data || []
}

function buildSummaryPayload(row) {
  const snapshot = normalizeBodySnapshot(row?.profile || {}, row?.goal)
  const metrics = computeMetrics(snapshot)
  const tips = buildRoutineTips(snapshot, metrics)
  const qysiHints = recommendFromBody(snapshot, metrics)
  const complete =
    Boolean(snapshot.heightCm) &&
    Boolean(snapshot.weightKg) &&
    Boolean(snapshot.sex) &&
    Boolean(snapshot.age)

  return {
    snapshot,
    metrics,
    tips,
    qysiHints,
    profileComplete: complete,
    stats: row?.stats || {},
    goal: row?.goal || snapshot.goal || null,
    access: { allowed: true }
  }
}

router.get('/summary', async (req, res) => {
  try {
    const row = await loadProfileRow(req.user.id)
    res.json(buildSummaryPayload(row))
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar resumen corporal', error: error.message })
  }
})

router.put('/profile', async (req, res) => {
  try {
    const { errors, patch } = validateProfilePatch(req.body || {})
    if (errors.length) {
      return res.status(400).json({ message: errors[0], errors })
    }

    const row = await loadProfileRow(req.user.id)
    const currentProfile = { ...(row.profile || {}) }

    const {
      goal: goalPatch,
      bodyGoals: bodyGoalsPatch,
      targetWeightKg: targetFromRoot,
      ...rest
    } = patch

    Object.assign(currentProfile, rest)

    if (targetFromRoot !== undefined) {
      currentProfile.targetWeightKg = targetFromRoot
      currentProfile.bodyGoals = {
        ...(currentProfile.bodyGoals || {}),
        targetWeightKg: targetFromRoot
      }
    }

    if (bodyGoalsPatch) {
      currentProfile.bodyGoals = {
        ...(currentProfile.bodyGoals || {}),
        ...bodyGoalsPatch
      }
      if (bodyGoalsPatch.targetWeightKg !== undefined) {
        currentProfile.targetWeightKg = bodyGoalsPatch.targetWeightKg
      }
    }

    // Keep legacy keys in sync for admin-registered users
    if (currentProfile.heightCm != null) currentProfile.height = currentProfile.heightCm
    if (currentProfile.weightKg != null) currentProfile.weight = currentProfile.weightKg
    if (currentProfile.age != null) currentProfile.age = currentProfile.age

    let nextGoal = row.goal
    if (goalPatch !== undefined) nextGoal = goalPatch
    else if (currentProfile.goalDetail) {
      nextGoal = mapGoalDetailToTopGoal(currentProfile.goalDetail, row.goal)
    }

    const updateData = {
      profile: currentProfile,
      updated_at: new Date().toISOString()
    }
    if (nextGoal !== undefined) updateData.goal = nextGoal

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', req.user.id)
      .select('id, goal, profile, stats, settings, membership')
      .single()

    if (error) throw error
    invalidateAuthProfileCache(req.user.id)

    // Seed first check-in if weight set and no history
    if (currentProfile.weightKg != null) {
      const { count } = await supabaseAdmin
        .from('body_checkins')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.user.id)
      if (!count) {
        await supabaseAdmin.from('body_checkins').insert({
          user_id: req.user.id,
          weight_kg: currentProfile.weightKg,
          body_fat_pct: currentProfile.bodyFatPct ?? null,
          waist_cm: currentProfile.waistCm ?? null,
          hip_cm: currentProfile.hipCm ?? null,
          source: 'profile_seed',
          recorded_at: new Date().toISOString()
        })
      }
    }

    res.json(buildSummaryPayload(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar ficha corporal', error: error.message })
  }
})

router.get('/checkins', async (req, res) => {
  try {
    let query = supabaseAdmin
      .from('body_checkins')
      .select('*')
      .eq('user_id', req.user.id)
      .order('recorded_at', { ascending: true })
      .limit(365)

    if (req.query.from) query = query.gte('recorded_at', String(req.query.from))
    if (req.query.to) query = query.lte('recorded_at', String(req.query.to))

    const { data, error } = await query
    if (error) throw error
    res.json((data || []).map(mapCheckin))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial', error: error.message })
  }
})

router.post('/checkins', async (req, res) => {
  try {
    const weightKg = clampNum(req.body?.weightKg, 30, 300)
    const bodyFatPct = clampNum(req.body?.bodyFatPct, 3, 60)
    const waistCm = clampNum(req.body?.waistCm, 40, 200)
    const hipCm = clampNum(req.body?.hipCm, 40, 200)
    const note = typeof req.body?.note === 'string' ? req.body.note.slice(0, 200) : null

    if (weightKg == null && bodyFatPct == null && waistCm == null && hipCm == null) {
      return res.status(400).json({ message: 'Incluye al menos peso, % grasa, cintura o cadera' })
    }

    let recordedAt = new Date().toISOString()
    if (req.body?.recordedAt) {
      const d = new Date(req.body.recordedAt)
      if (!Number.isNaN(d.getTime())) recordedAt = d.toISOString()
    }

    const payload = {
      user_id: req.user.id,
      recorded_at: recordedAt,
      weight_kg: weightKg,
      body_fat_pct: bodyFatPct,
      waist_cm: waistCm,
      hip_cm: hipCm,
      note,
      source: req.body?.source || 'manual'
    }

    const { data, error } = await supabaseAdmin
      .from('body_checkins')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error

    // Sync snapshot weight to latest
    if (weightKg != null) {
      const row = await loadProfileRow(req.user.id)
      const profile = { ...(row.profile || {}), weightKg, weight: weightKg }
      if (bodyFatPct != null) {
        profile.bodyFatPct = bodyFatPct
        profile.bodyFat = bodyFatPct
      }
      if (waistCm != null) profile.waistCm = waistCm
      if (hipCm != null) profile.hipCm = hipCm
      await supabaseAdmin
        .from('profiles')
        .update({ profile, updated_at: new Date().toISOString() })
        .eq('id', req.user.id)
      invalidateAuthProfileCache(req.user.id)
    }

    res.status(201).json(mapCheckin(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar check-in', error: error.message })
  }
})

router.delete('/checkins/:id', async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('body_checkins')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
    if (error) throw error
    res.json({ ok: true })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar check-in', error: error.message })
  }
})

router.get('/charts', async (req, res) => {
  try {
    const { data: checkins, error } = await supabaseAdmin
      .from('body_checkins')
      .select('*')
      .eq('user_id', req.user.id)
      .order('recorded_at', { ascending: true })
      .limit(365)
    if (error) throw error

    const weight = (checkins || [])
      .filter((c) => c.weight_kg != null)
      .map((c) => ({
        date: String(c.recorded_at).slice(0, 10),
        weight: Number(c.weight_kg),
        bodyFatPct: c.body_fat_pct != null ? Number(c.body_fat_pct) : null,
        id: c.id
      }))

    const row = await loadProfileRow(req.user.id)
    const snapshot = normalizeBodySnapshot(row?.profile || {}, row?.goal)
    const weeklyTarget = snapshot.bodyGoals?.weeklyWorkouts || 3
    const workouts = await loadWorkoutsForCharts(req.user.id)
    const { training, projection, coaching } = buildTrainingAnalytics(workouts, { weeklyTarget })

    res.json({
      weight,
      training,
      projection,
      coaching,
      // legacy alias (empty) — clients should use training/projection
      strength: []
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al cargar gráficas', error: error.message })
  }
})

router.get('/education', (req, res) => {
  const id = req.query.id
  if (id) {
    const item = getEducation(String(id))
    if (!item) return res.status(404).json({ message: 'Ficha no encontrada' })
    return res.json(item)
  }
  return res.json(listEducation())
})

export default router
