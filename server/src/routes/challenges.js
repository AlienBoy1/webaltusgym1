import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapChallenge } from '../lib/mappers.js'
import { authenticate, isAdmin } from '../middleware/auth.js'
import { awardXP } from '../services/xpService.js'
import { notifyUser, notifyAllUsers } from '../services/notificationService.js'

const router = express.Router()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function mapUserBrief(u, includeLevel = false) {
  if (!u) return null
  return {
    _id: u.id,
    id: u.id,
    name: u.name,
    avatar: u.avatar,
    ...(includeLevel ? { stats: { level: u.stats?.level || 1 } } : {})
  }
}

async function getProfilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, avatar, stats')
    .in('id', unique)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

function normalizeExercises(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .map((ex, index) => {
      const name = String(ex?.name || '').trim()
      const targetReps = Number(ex?.targetReps ?? ex?.target_reps ?? ex?.reps)
      if (!name || !Number.isFinite(targetReps) || targetReps <= 0) return null
      return {
        id: String(ex?.id || `ex-${index + 1}`),
        name,
        targetReps
      }
    })
    .filter(Boolean)
}

function clampExerciseProgress(exercises, progressInput) {
  const list = normalizeExercises(exercises)
  const src =
    progressInput && typeof progressInput === 'object' && !Array.isArray(progressInput)
      ? progressInput
      : {}
  const map = {}
  let total = 0
  for (const ex of list) {
    const raw = Number(src[ex.id] ?? src[ex.name] ?? 0)
    const val = Number.isFinite(raw) ? Math.max(0, Math.min(ex.targetReps, raw)) : 0
    map[ex.id] = val
    total += val
  }
  return { map, total }
}

function mapParticipant(row, userMap, includeLevel = false) {
  const u = userMap[row.user_id]
  const exerciseProgress =
    row.exercise_progress && typeof row.exercise_progress === 'object'
      ? row.exercise_progress
      : {}
  return {
    user: mapUserBrief(u, includeLevel) || row.user_id,
    progress: Number(row.progress) || 0,
    completed: !!row.completed,
    completedAt: row.completed_at || (row.completed ? row.joined_at : null),
    joinedAt: row.joined_at,
    status: row.status || 'joined',
    startedAt: row.started_at || null,
    pausedAt: row.paused_at || null,
    accumulatedMs: Number(row.accumulated_ms) || 0,
    lastProgressAt: row.last_progress_at || null,
    resultValue: row.result_value != null ? Number(row.result_value) : null,
    resultUnit: row.result_unit || null,
    exerciseProgress
  }
}

function getChallengeGoalMode(challenge) {
  return challenge?.goal_mode || challenge?.reward?.goalMode || 'quantity'
}

function isTimeGoalChallenge(challenge) {
  if (!challenge) return false
  if (getChallengeGoalMode(challenge) === 'time') return true
  const unit = String(challenge.unit || '').toLowerCase()
  return ['min', 'mins', 'minuto', 'minutos', 'seg', 'segundos'].includes(unit)
}

function getTimeGoalMs(challenge) {
  const goal = Number(challenge?.goal) || 0
  const unit = String(challenge?.unit || '').toLowerCase()
  if (unit === 'seg' || unit === 'segundos') return Math.max(0, goal * 1000)
  return Math.max(0, goal * 60 * 1000)
}

function computeElapsedMs(participant) {
  let ms = Number(participant?.accumulated_ms) || 0
  if (participant?.status === 'active' && participant?.started_at) {
    ms += Date.now() - new Date(participant.started_at).getTime()
  }
  return ms
}

async function hydrateChallenge(row, { includeLevel = false, sortParticipants = false } = {}) {
  if (!row) return null

  const { data: participants } = await supabaseAdmin
    .from('challenge_participants')
    .select('*')
    .eq('challenge_id', row.id)

  const userIds = [row.created_by, ...(participants || []).map((p) => p.user_id)]
  const userMap = await getProfilesMap(userIds)
  const creator = userMap[row.created_by]

  let mappedParticipants = (participants || []).map((p) =>
    mapParticipant(p, userMap, includeLevel)
  )
  if (sortParticipants) {
    mappedParticipants = mappedParticipants.sort((a, b) => b.progress - a.progress)
  }

  const mapped = mapChallenge(row, {
    participants: mappedParticipants
  })
  mapped.createdBy = creator
    ? { _id: creator.id, id: creator.id, name: creator.name, avatar: creator.avatar }
    : row.created_by
  mapped.featured = !!(row.reward && row.reward.featured)
  mapped.isPublic = row.reward?.isPublic !== false

  return mapped
}

async function getDefaultXpForType(type) {
  const { data } = await supabaseAdmin
    .from('challenge_types')
    .select('default_xp')
    .eq('id', type)
    .eq('active', true)
    .maybeSingle()
  return data?.default_xp || 50
}

async function createChallengeWithJoin({
  title,
  description,
  type,
  goal,
  unit,
  goalMode = 'quantity',
  exercises = [],
  startDate,
  endDate,
  reward,
  image,
  createdBy,
  featured = false,
  isPublic = true
}) {
  let xp = reward?.xp
  if (!xp) {
    xp = await getDefaultXpForType(type)
  }

  const mode = goalMode === 'time' ? 'time' : 'quantity'
  const normalizedExercises = normalizeExercises(exercises)
  const resolvedUnit =
    unit ||
    (mode === 'time'
      ? 'min'
      : (
          await supabaseAdmin
            .from('challenge_types')
            .select('unit')
            .eq('id', type)
            .maybeSingle()
        ).data?.unit) ||
      null

  let resolvedGoal = Number(goal)
  if (mode === 'quantity' && normalizedExercises.length) {
    resolvedGoal = normalizedExercises.reduce((sum, ex) => sum + ex.targetReps, 0)
  }
  if (!Number.isFinite(resolvedGoal) || resolvedGoal <= 0) {
    const err = new Error('El objetivo debe ser mayor a 0')
    err.status = 400
    throw err
  }

  const rewardPayload = {
    ...(reward || {}),
    xp,
    featured,
    isPublic,
    goalMode: mode,
    exercises: normalizedExercises
  }

  const insertPayload = {
    title,
    description: description || null,
    type,
    goal: resolvedGoal,
    unit: resolvedUnit,
    start_date: startDate,
    end_date: endDate,
    reward: rewardPayload,
    image: image || null,
    created_by: createdBy,
    goal_mode: mode,
    exercises: normalizedExercises
  }

  let { data: challenge, error } = await supabaseAdmin
    .from('challenges')
    .insert(insertPayload)
    .select('*')
    .single()

  // Fallback if goal_mode / exercises columns not migrated yet
  if (error && /goal_mode|exercises/i.test(String(error.message || ''))) {
    delete insertPayload.goal_mode
    delete insertPayload.exercises
    ;({ data: challenge, error } = await supabaseAdmin
      .from('challenges')
      .insert(insertPayload)
      .select('*')
      .single())
  }

  if (error) throw error

  await supabaseAdmin.from('challenge_participants').insert({
    challenge_id: challenge.id,
    user_id: createdBy,
    progress: 0,
    completed: false,
    status: 'joined'
  })

  return challenge
}

// ─── Challenge Types ────────────────────────────────────────────────

router.get('/types', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('challenge_types')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })

    if (error) throw error
    res.json(data || [])
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tipos de reto', error: error.message })
  }
})

// Admin CRUD for challenge types
router.get('/admin/types', authenticate, isAdmin, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('challenge_types')
      .select('*')
      .order('sort_order', { ascending: true })

    if (error) throw error
    res.json(data || [])
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tipos', error: error.message })
  }
})

router.post('/admin/types', authenticate, isAdmin, async (req, res) => {
  try {
    const { id, name, unit, default_xp, icon, sort_order, active } = req.body
    if (!id || !name) {
      return res.status(400).json({ message: 'ID y nombre son requeridos' })
    }

    const { data, error } = await supabaseAdmin
      .from('challenge_types')
      .insert({
        id,
        name,
        unit: unit || 'unidades',
        default_xp: default_xp || 50,
        icon: icon || '🎯',
        sort_order: sort_order || 99,
        active: active !== false
      })
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json(data)
  } catch (error) {
    res.status(500).json({ message: 'Error al crear tipo', error: error.message })
  }
})

router.put('/admin/types/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, unit, default_xp, icon, sort_order, active } = req.body
    const updates = { updated_at: new Date().toISOString() }
    if (name !== undefined) updates.name = name
    if (unit !== undefined) updates.unit = unit
    if (default_xp !== undefined) updates.default_xp = default_xp
    if (icon !== undefined) updates.icon = icon
    if (sort_order !== undefined) updates.sort_order = sort_order
    if (active !== undefined) updates.active = active

    const { data, error } = await supabaseAdmin
      .from('challenge_types')
      .update(updates)
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw error
    res.json(data)
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar tipo', error: error.message })
  }
})

router.delete('/admin/types/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('challenge_types')
      .delete()
      .eq('id', req.params.id)

    if (error) throw error
    res.json({ message: 'Tipo eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar tipo', error: error.message })
  }
})

// ─── Challenge CRUD & Listing ───────────────────────────────────────

router.get('/', authenticate, async (req, res) => {
  try {
    const { active = true, featured } = req.query

    let query = supabaseAdmin.from('challenges').select('*').order('start_date', { ascending: true })

    if (active === 'true' || active === true) {
      query = query.gte('end_date', new Date().toISOString())
    }

    const { data, error } = await query
    if (error) throw error

    let rows = data || []
    if (featured === 'true') {
      rows = rows.filter((c) => c.reward?.featured)
    }

    rows.sort((a, b) => {
      const featA = a.reward?.featured ? 1 : 0
      const featB = b.reward?.featured ? 1 : 0
      if (featA !== featB) return featB - featA
      return new Date(a.start_date) - new Date(b.start_date)
    })

    const hydrated = await Promise.all(rows.map((c) => hydrateChallenge(c)))
    res.json(hydrated)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener retos', error: error.message })
  }
})

router.get('/my', authenticate, async (req, res) => {
  try {
    const { data: parts, error: partsError } = await supabaseAdmin
      .from('challenge_participants')
      .select('challenge_id')
      .eq('user_id', req.user.id)

    if (partsError) throw partsError
    const ids = (parts || []).map((p) => p.challenge_id)
    if (!ids.length) return res.json([])

    const { data, error } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .in('id', ids)
      .order('end_date', { ascending: true })

    if (error) throw error
    const hydrated = await Promise.all((data || []).map((c) => hydrateChallenge(c)))
    res.json(hydrated)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener tus retos', error: error.message })
  }
})

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Reto no encontrado' })

    res.json(await hydrateChallenge(data, { includeLevel: true, sortParticipants: true }))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener reto', error: error.message })
  }
})

router.post('/', authenticate, async (req, res) => {
  try {
    const {
      title,
      type,
      goal,
      startDate,
      endDate,
      reward,
      targetUsers,
      description,
      unit,
      image,
      goalMode,
      exercises
    } = req.body

    if (!title || !type || !goal || !startDate || !endDate) {
      return res.status(400).json({ message: 'Faltan campos requeridos' })
    }

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'La fecha de inicio debe ser anterior a la fecha de fin' })
    }

    if (targetUsers && Array.isArray(targetUsers) && targetUsers.length > 0) {
      const validUserIds = targetUsers.filter((id) => UUID_RE.test(String(id)))

      if (validUserIds.length !== targetUsers.length) {
        return res.status(400).json({ message: 'Algunos IDs de usuarios no son válidos' })
      }

      const uniqueUserIds = [...new Set(validUserIds.map((id) => String(id)))]

      const challenge = await createChallengeWithJoin({
        title,
        description,
        type,
        goal,
        unit,
        goalMode,
        exercises,
        startDate,
        endDate,
        reward: reward || {},
        image,
        createdBy: req.user.id,
        isPublic: false
      })

      if (uniqueUserIds.length > 0) {
        process.nextTick(async () => {
          try {
            await Promise.all(
              uniqueUserIds.map((userId) =>
                notifyUser({
                  userId,
                  type: 'challenge_invite',
                  title: '¡Nuevo reto disponible!',
                  body: `${req.user.name} te ha invitado a "${title}"`,
                  icon: '🎯',
                  relatedData: { challengeId: challenge.id },
                  priority: 'normal'
                })
              )
            )
          } catch (err) {
            console.error('Error sending challenge notifications:', err)
          }
        })
      }

      res.status(201).json(await hydrateChallenge(challenge))
    } else {
      const challenge = await createChallengeWithJoin({
        title,
        description,
        type,
        goal,
        unit,
        goalMode,
        exercises,
        startDate,
        endDate,
        reward: reward || {},
        image,
        createdBy: req.user.id,
        isPublic: true
      })

      notifyAllUsers(
        {
          type: 'challenge_invite',
          title: '¡Nuevo reto disponible!',
          body: `${req.user.name} creó el reto "${title}"`,
          icon: '🎯',
          relatedData: { challengeId: challenge.id },
          priority: 'normal'
        },
        { excludeId: req.user.id }
      )

      res.status(201).json(await hydrateChallenge(challenge))
    }
  } catch (error) {
    res.status(500).json({ message: 'Error al crear reto', error: error.message })
  }
})

// ─── Join / Leave ───────────────────────────────────────────────────

router.post('/:id/join', authenticate, async (req, res) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    const { data: existing } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ message: 'Ya participas en este reto' })
    }

    if (new Date() > new Date(challenge.end_date)) {
      return res.status(400).json({ message: 'Este reto ya ha terminado' })
    }

    await supabaseAdmin.from('challenge_participants').insert({
      challenge_id: challenge.id,
      user_id: req.user.id,
      progress: 0,
      completed: false,
      status: 'joined'
    })

    await notifyUser({
      userId: req.user.id,
      type: 'challenge_invite',
      title: '¡Te uniste al reto!',
      body: `Ahora participas en "${challenge.title}"`,
      icon: '🎯',
      relatedData: { challengeId: challenge.id }
    })

    res.json({
      message: 'Te has unido al reto',
      challenge: await hydrateChallenge(challenge)
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al unirse al reto', error: error.message })
  }
})

router.delete('/:id/leave', authenticate, async (req, res) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('id')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    await supabaseAdmin
      .from('challenge_participants')
      .delete()
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)

    res.json({ message: 'Has abandonado el reto' })
  } catch (error) {
    res.status(500).json({ message: 'Error al abandonar reto', error: error.message })
  }
})

// ─── Session flow: Start / Pause / Resume ───────────────────────────

router.post('/:id/start', authenticate, async (req, res) => {
  try {
    const { data: participant } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!participant) {
      return res.status(400).json({ message: 'No participas en este reto' })
    }
    if (participant.completed) {
      return res.status(400).json({ message: 'Ya completaste este reto' })
    }
    if (participant.status === 'active') {
      return res.status(400).json({ message: 'El reto ya está en curso' })
    }

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('challenge_participants')
      .update({
        status: 'active',
        started_at: now,
        paused_at: null
      })
      .eq('challenge_id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .single()

    if (error) throw error
    res.json({ message: 'Reto iniciado', participant: data })
  } catch (error) {
    res.status(500).json({ message: 'Error al iniciar reto', error: error.message })
  }
})

router.post('/:id/pause', authenticate, async (req, res) => {
  try {
    const { data: participant } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!participant) {
      return res.status(400).json({ message: 'No participas en este reto' })
    }
    if (participant.status !== 'active') {
      return res.status(400).json({ message: 'El reto no está activo' })
    }

    const now = Date.now()
    const startedMs = new Date(participant.started_at).getTime()
    const elapsedSinceStart = now - startedMs
    const newAccumulated = (Number(participant.accumulated_ms) || 0) + elapsedSinceStart

    const { data, error } = await supabaseAdmin
      .from('challenge_participants')
      .update({
        status: 'paused',
        paused_at: new Date().toISOString(),
        accumulated_ms: newAccumulated
      })
      .eq('challenge_id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .single()

    if (error) throw error
    res.json({ message: 'Reto pausado', participant: data })
  } catch (error) {
    res.status(500).json({ message: 'Error al pausar reto', error: error.message })
  }
})

router.post('/:id/resume', authenticate, async (req, res) => {
  try {
    const { data: participant } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!participant) {
      return res.status(400).json({ message: 'No participas en este reto' })
    }
    if (participant.status !== 'paused') {
      return res.status(400).json({ message: 'El reto no está pausado' })
    }

    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('challenge_participants')
      .update({
        status: 'active',
        started_at: now,
        paused_at: null
      })
      .eq('challenge_id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .single()

    if (error) throw error
    res.json({ message: 'Reto reanudado', participant: data })
  } catch (error) {
    res.status(500).json({ message: 'Error al reanudar reto', error: error.message })
  }
})

// ─── Progress ───────────────────────────────────────────────────────

router.put('/:id/progress', authenticate, async (req, res) => {
  try {
    const { progress, exerciseProgress } = req.body

    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    if (isTimeGoalChallenge(challenge)) {
      return res.status(400).json({
        message: 'En retos de tiempo el progreso se registra al completar el cronómetro'
      })
    }

    const { data: participant } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!participant) {
      return res.status(400).json({ message: 'No participas en este reto' })
    }

    if (participant.status !== 'active') {
      return res.status(400).json({ message: 'Debes tener el reto activo para actualizar progreso' })
    }

    const exercises = normalizeExercises(challenge.exercises || challenge.reward?.exercises)
    const goal = Number(challenge.goal) || 0
    let nextProgress = 0
    let nextExerciseProgress = participant.exercise_progress || {}

    if (exercises.length) {
      const clamped = clampExerciseProgress(exercises, exerciseProgress)
      nextExerciseProgress = clamped.map
      nextProgress = Math.min(goal, clamped.total)
    } else {
      if (progress === undefined || progress === null || Number(progress) < 0) {
        return res.status(400).json({
          message: 'El progreso es requerido y debe ser un número no negativo'
        })
      }
      nextProgress = Math.min(goal, Number(progress))
    }

    const reachedGoal = goal > 0 && nextProgress >= goal
    const nowIso = new Date().toISOString()
    const updatePayload = {
      progress: nextProgress,
      last_progress_at: nowIso,
      exercise_progress: nextExerciseProgress
    }

    // Hitting the objective pauses the stopwatch so the user can finish for XP
    if (reachedGoal && participant.status === 'active') {
      let accumulated = Number(participant.accumulated_ms) || 0
      if (participant.started_at) {
        accumulated += Math.max(0, Date.now() - new Date(participant.started_at).getTime())
      }
      updatePayload.status = 'paused'
      updatePayload.paused_at = nowIso
      updatePayload.started_at = null
      updatePayload.accumulated_ms = accumulated
    }

    let { data: updatedParticipant, error } = await supabaseAdmin
      .from('challenge_participants')
      .update(updatePayload)
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)
      .select('*')
      .single()

    // Fallback if exercise_progress column missing
    if (error && /exercise_progress/i.test(String(error.message || ''))) {
      delete updatePayload.exercise_progress
      ;({ data: updatedParticipant, error } = await supabaseAdmin
        .from('challenge_participants')
        .update(updatePayload)
        .eq('challenge_id', challenge.id)
        .eq('user_id', req.user.id)
        .select('*')
        .single())
    }

    if (error) throw error

    const hydrated = await hydrateChallenge(challenge, { includeLevel: true })
    const { data: updatedUser } = await supabaseAdmin
      .from('profiles')
      .select('stats, badges')
      .eq('id', req.user.id)
      .single()

    const updatedPart = hydrated.participants.find(
      (p) => (p.user?.id || p.user?._id || p.user) === req.user.id
    )

    res.json({
      message: reachedGoal
        ? 'Objetivo alcanzado. Reto pausado: puedes completar y obtener XP'
        : 'Progreso actualizado',
      participant: updatedPart || {
        ...mapParticipant(updatedParticipant, {}),
        user: req.user.id
      },
      challenge: {
        _id: challenge.id,
        id: challenge.id,
        title: challenge.title,
        goal: challenge.goal,
        exercises,
        participants: hydrated.participants
      },
      canComplete: reachedGoal && !participant.completed,
      autoPaused: reachedGoal,
      userStats: {
        xp: updatedUser?.stats?.xp || 0,
        level: updatedUser?.stats?.level || 1
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar progreso', error: error.message })
  }
})

// ─── Complete ───────────────────────────────────────────────────────

router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const { exerciseResult, resultUnit, timeReached, exerciseProgress } = req.body || {}

    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    const { data: participant } = await supabaseAdmin
      .from('challenge_participants')
      .select('*')
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!participant) {
      return res.status(400).json({ message: 'No participas en este reto' })
    }

    if (participant.completed) {
      return res.status(400).json({ message: 'Ya completaste este reto' })
    }

    const timeGoal = isTimeGoalChallenge(challenge)
    const targetMs = getTimeGoalMs(challenge)
    let finalAccumulatedMs = computeElapsedMs(participant)
    const exercises = normalizeExercises(challenge.exercises || challenge.reward?.exercises)

    // Cap time-goal chronometer at the objective
    if (timeGoal && targetMs > 0 && finalAccumulatedMs > targetMs) {
      finalAccumulatedMs = targetMs
    }

    const timeObjectiveMet = timeGoal && targetMs > 0 && finalAccumulatedMs >= targetMs
    let progressValue = Number(participant.progress) || 0
    let nextExerciseProgress = participant.exercise_progress || {}
    let parsedResult =
      exerciseResult !== undefined && exerciseResult !== null && exerciseResult !== ''
        ? Number(exerciseResult)
        : null
    let resolvedResultUnit = resultUnit || null

    if (timeGoal) {
      if (!timeObjectiveMet && !(timeReached && finalAccumulatedMs >= targetMs * 0.98)) {
        return res.status(400).json({ message: 'Aún no has alcanzado el tiempo objetivo del reto' })
      }
      progressValue = Number(challenge.goal)

      if (exercises.length) {
        const clamped = clampExerciseProgress(exercises, exerciseProgress)
        nextExerciseProgress = clamped.map
        parsedResult = clamped.total
        resolvedResultUnit = 'reps'
      } else {
        if (parsedResult == null || Number.isNaN(parsedResult) || parsedResult < 0) {
          return res.status(400).json({
            message: 'Registra tu resultado (puede ser menor al objetivo, nunca mayor)'
          })
        }
        const maxResult = Number(challenge.reward?.resultTarget)
        if (Number.isFinite(maxResult) && maxResult > 0) {
          if (parsedResult > maxResult) {
            return res.status(400).json({
              message: `No puedes registrar más de ${maxResult}`
            })
          }
        }
      }
    } else if (progressValue < Number(challenge.goal)) {
      return res.status(400).json({ message: 'No has alcanzado el objetivo del reto' })
    }

    if (parsedResult != null && (Number.isNaN(parsedResult) || parsedResult < 0)) {
      return res.status(400).json({ message: 'Resultado de ejercicio inválido' })
    }

    const completedAt = new Date().toISOString()

    const updatePayload = {
      completed: true,
      status: 'completed',
      completed_at: completedAt,
      accumulated_ms: finalAccumulatedMs,
      progress: progressValue,
      paused_at: completedAt,
      started_at: null,
      exercise_progress: nextExerciseProgress
    }

    if (parsedResult != null) {
      updatePayload.result_value = parsedResult
      updatePayload.result_unit = resolvedResultUnit
    }

    let { error: completeErr } = await supabaseAdmin
      .from('challenge_participants')
      .update(updatePayload)
      .eq('challenge_id', challenge.id)
      .eq('user_id', req.user.id)

    if (
      completeErr &&
      /result_|exercise_progress/i.test(String(completeErr.message || ''))
    ) {
      delete updatePayload.result_value
      delete updatePayload.result_unit
      delete updatePayload.exercise_progress
      ;({ error: completeErr } = await supabaseAdmin
        .from('challenge_participants')
        .update(updatePayload)
        .eq('challenge_id', challenge.id)
        .eq('user_id', req.user.id))
    }

    if (completeErr) throw completeErr

    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()

    const oldLevel = user.stats?.level || 1
    const stats = { ...(user.stats || {}) }
    stats.challengesCompleted = (stats.challengesCompleted || 0) + 1
    await supabaseAdmin
      .from('profiles')
      .update({ stats, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)

    let xpResult = null
    let unlockedBadges = []
    try {
      xpResult = await awardXP(
        req.user.id,
        challenge.reward?.xp || 100,
        `Completaste el reto: ${challenge.title}`,
        false
      )
      const { checkBadgeUnlocks } = await import('../services/xpService.js')
      unlockedBadges = await checkBadgeUnlocks(req.user.id, false)
    } catch (xpError) {
      console.error('Error awarding XP:', xpError)
    }

    const { getBadgeDefinitions } = await import('../services/xpService.js')
    const badgeDefinitions = getBadgeDefinitions()
    const { data: refreshed } = await supabaseAdmin
      .from('profiles')
      .select('stats, badges')
      .eq('id', req.user.id)
      .single()

    const userBadgeIds = (refreshed?.badges || user.badges || []).map((b) => b.id || b._id)
    const nextBadge = badgeDefinitions
      .filter((b) => !userBadgeIds.includes(b.id) && b.type === 'xp')
      .sort((a, b) => a.xpRequired - b.xpRequired)[0]

    let challengeBadge = null
    if (challenge.reward?.badge) {
      const hasBadge = (refreshed?.badges || []).some(
        (b) => (b.id || b._id) === challenge.reward.badge.id
      )
      if (!hasBadge) {
        challengeBadge = {
          id: challenge.reward.badge.id,
          name: challenge.reward.badge.name,
          icon: challenge.reward.badge.icon
        }
        const badges = [
          ...(refreshed?.badges || []),
          { ...challengeBadge, earnedAt: new Date().toISOString() }
        ]
        await supabaseAdmin
          .from('profiles')
          .update({ badges, updated_at: new Date().toISOString() })
          .eq('id', req.user.id)
      }
    }

    const { data: updatedUser } = await supabaseAdmin
      .from('profiles')
      .select('stats, badges')
      .eq('id', req.user.id)
      .single()

    const motivationalMessages = [
      '¡Increíble! Sigues superando tus límites 💪',
      '¡Eres una máquina! Sigue así 🚀',
      '¡Excelente trabajo! Tu dedicación es admirable ⭐',
      '¡Felicidades! Cada reto te acerca más a tus metas 🎯',
      '¡Impresionante! Tu constancia es inspiradora 🔥'
    ]
    const randomMessage = motivationalMessages[Math.floor(Math.random() * motivationalMessages.length)]

    process.nextTick(async () => {
      try {
        await notifyUser({
          userId: req.user.id,
          type: 'challenge_completed',
          title: '🏆 ¡Reto completado!',
          body: `${randomMessage} Completaste "${challenge.title}" y ganaste ${challenge.reward?.xp || 100} XP`,
          icon: '🏆',
          priority: 'high',
          relatedData: {
            challengeId: challenge.id,
            challengeTitle: challenge.title,
            xpAwarded: challenge.reward?.xp || 100,
            unlockedBadges: unlockedBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
            challengeBadge,
            nextBadge: nextBadge
              ? {
                  id: nextBadge.id,
                  name: nextBadge.name,
                  icon: nextBadge.icon,
                  xpRequired: nextBadge.xpRequired,
                  currentXP: updatedUser?.stats?.xp || 0,
                  xpNeeded: nextBadge.xpRequired - (updatedUser?.stats?.xp || 0)
                }
              : null
          }
        })
      } catch (err) {
        console.error('Error creating completion notification:', err)
      }
    })

    res.json({
      message: 'Reto completado exitosamente',
      xpAwarded: challenge.reward?.xp || 100,
      participant: {
        user: req.user.id,
        progress: progressValue,
        completed: true,
        completedAt,
        accumulatedMs: finalAccumulatedMs,
        resultValue: parsedResult,
        resultUnit: resultUnit || null
      },
      challengeData: {
        challengeId: challenge.id,
        title: challenge.title,
        type: challenge.type,
        goal: challenge.goal,
        unit: challenge.unit,
        goalMode: getChallengeGoalMode(challenge),
        xpAwarded: challenge.reward?.xp || 100,
        accumulatedMs: finalAccumulatedMs,
        createdBy: challenge.created_by,
        resultValue: parsedResult,
        resultUnit: resultUnit || null
      },
      motivationalMessage: randomMessage,
      unlockedBadges: unlockedBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
      challengeBadge,
      nextBadge: nextBadge
        ? {
            id: nextBadge.id,
            name: nextBadge.name,
            icon: nextBadge.icon,
            xpRequired: nextBadge.xpRequired,
            currentXP: updatedUser?.stats?.xp || 0,
            xpNeeded: nextBadge.xpRequired - (updatedUser?.stats?.xp || 0)
          }
        : null,
      leveledUp: xpResult?.leveledUp || false,
      newLevel: xpResult?.level || updatedUser?.stats?.level || oldLevel,
      userStats: {
        xp: updatedUser?.stats?.xp || 0,
        level: updatedUser?.stats?.level || 1
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al completar reto', error: error.message })
  }
})

// ─── Leaderboard ────────────────────────────────────────────────────

router.get('/:id/leaderboard', authenticate, async (req, res) => {
  try {
    const { data: challenge } = await supabaseAdmin
      .from('challenges')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!challenge) {
      return res.status(404).json({ message: 'Reto no encontrado' })
    }

    const hydrated = await hydrateChallenge(challenge, {
      includeLevel: true,
      sortParticipants: true
    })

    const leaderboard = hydrated.participants.map((p, index) => ({
      rank: index + 1,
      user: p.user,
      progress: p.progress,
      completed: p.completed,
      completedAt: p.completedAt,
      percentage: Math.min(100, (p.progress / Number(challenge.goal)) * 100)
    }))

    res.json(leaderboard)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener ranking', error: error.message })
  }
})

// Admin: Delete challenge
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await supabaseAdmin.from('challenge_participants').delete().eq('challenge_id', req.params.id)
    await supabaseAdmin.from('challenges').delete().eq('id', req.params.id)
    res.json({ message: 'Reto eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar reto', error: error.message })
  }
})

export default router
