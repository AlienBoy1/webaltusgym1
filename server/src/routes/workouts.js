import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapWorkout, mapProfile } from '../lib/mappers.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

const defaultTemplates = [
  {
    id: 1,
    name: 'Pecho y Tríceps',
    exercises: [
      { name: 'Press Banca', sets: 4, reps: 10 },
      { name: 'Press Inclinado', sets: 3, reps: 12 },
      { name: 'Aperturas', sets: 3, reps: 15 },
      { name: 'Fondos', sets: 3, reps: 12 },
      { name: 'Extensiones Tríceps', sets: 3, reps: 15 }
    ]
  },
  {
    id: 2,
    name: 'Espalda y Bíceps',
    exercises: [
      { name: 'Dominadas', sets: 4, reps: 8 },
      { name: 'Remo con Barra', sets: 4, reps: 10 },
      { name: 'Jalón al Pecho', sets: 3, reps: 12 },
      { name: 'Curl con Barra', sets: 3, reps: 12 },
      { name: 'Curl Martillo', sets: 3, reps: 12 }
    ]
  },
  {
    id: 3,
    name: 'Piernas',
    exercises: [
      { name: 'Sentadillas', sets: 4, reps: 10 },
      { name: 'Prensa', sets: 4, reps: 12 },
      { name: 'Peso Muerto Rumano', sets: 3, reps: 10 },
      { name: 'Extensiones', sets: 3, reps: 15 },
      { name: 'Curl Femoral', sets: 3, reps: 12 }
    ]
  },
  {
    id: 4,
    name: 'Hombros y Core',
    exercises: [
      { name: 'Press Militar', sets: 4, reps: 10 },
      { name: 'Elevaciones Laterales', sets: 3, reps: 15 },
      { name: 'Pájaros', sets: 3, reps: 15 },
      { name: 'Plancha', sets: 3, reps: '60s' },
      { name: 'Crunch', sets: 3, reps: 20 }
    ]
  }
]

router.get('/templates/all', authenticate, async (req, res) => {
  res.json(defaultTemplates)
})

function normalizeDays(days) {
  if (!Array.isArray(days)) return []
  return [...new Set(days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
}

function mapRoutine(row, user = null) {
  return {
    _id: row.id,
    id: row.id,
    localId: row.local_id || null,
    name: row.name,
    color: row.color || 'primary',
    exercises: row.exercises || [],
    days: normalizeDays(row.days),
    isPublic: Boolean(row.is_public),
    userId: row.user_id,
    user: user
      ? {
          _id: user.id,
          id: user.id,
          name: user.name,
          username: user.username || null,
          avatar: user.avatar
        }
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

async function getCommunityUserIds(userId) {
  const [{ data: following }, { data: followers }] = await Promise.all([
    supabaseAdmin.from('follows').select('following_id').eq('follower_id', userId),
    supabaseAdmin.from('follows').select('follower_id').eq('following_id', userId)
  ])
  return [
    ...new Set([
      ...(following || []).map((f) => f.following_id),
      ...(followers || []).map((f) => f.follower_id)
    ])
  ]
}

// My saved routines (server sync for GymRat / public)
router.get('/routines', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('user_id', req.user.id)
      .order('updated_at', { ascending: false })
    if (error) throw error
    res.json((data || []).map((row) => mapRoutine(row)))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener rutinas', error: error.message })
  }
})

// Explore public routines from community (followers graph) + public profiles
router.get('/routines/explore', authenticate, async (req, res) => {
  try {
    const communityIds = await getCommunityUserIds(req.user.id)

    const { data: publicProfiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, avatar, settings')
      .neq('id', req.user.id)

    const openProfileIds = (publicProfiles || [])
      .filter((p) => p.settings?.privacy?.profilePublic === true)
      .map((p) => p.id)

    const allowedIds = [...new Set([req.user.id, ...communityIds, ...openProfileIds])]
    if (!allowedIds.length) {
      return res.json([])
    }

    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('is_public', true)
      .in('user_id', allowedIds)
      .order('updated_at', { ascending: false })
      .limit(100)

    if (error) throw error

    const profileMap = Object.fromEntries((publicProfiles || []).map((p) => [p.id, p]))
    // Also fetch community profiles missing from publicProfiles select if needed
    const missing = (data || []).map((r) => r.user_id).filter((id) => !profileMap[id])
    if (missing.length) {
      const { data: extra } = await supabaseAdmin
        .from('profiles')
        .select('id, name, username, avatar, settings')
        .in('id', missing)
      for (const p of extra || []) profileMap[p.id] = p
    }

    // Community members + own public routines always visible; others only if profilePublic
    const filtered = (data || []).filter((row) => {
      if (row.user_id === req.user.id) return true
      if (communityIds.includes(row.user_id)) return true
      return profileMap[row.user_id]?.settings?.privacy?.profilePublic === true
    })

    res.json(
      filtered.map((row) =>
        mapRoutine(row, profileMap[row.user_id]
          ? {
              id: row.user_id,
              name: profileMap[row.user_id].name,
              username: profileMap[row.user_id].username || null,
              avatar: profileMap[row.user_id].avatar
            }
          : null)
      )
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al explorar rutinas', error: error.message })
  }
})

router.post('/routines', authenticate, async (req, res) => {
  try {
    const { name, exercises, color, isPublic, localId, id, days } = req.body
    if (!name?.trim()) return res.status(400).json({ message: 'Nombre requerido' })

    const payload = {
      user_id: req.user.id,
      name: name.trim(),
      exercises: exercises || [],
      color: color || 'primary',
      days: normalizeDays(days),
      is_public: Boolean(isPublic),
      local_id: localId || null,
      updated_at: new Date().toISOString()
    }

    let row
    if (id) {
      const { data, error } = await supabaseAdmin
        .from('workout_routines')
        .update(payload)
        .eq('id', id)
        .eq('user_id', req.user.id)
        .select('*')
        .maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ message: 'Rutina no encontrada' })
      row = data
    } else if (localId) {
      const { data: existing } = await supabaseAdmin
        .from('workout_routines')
        .select('id')
        .eq('user_id', req.user.id)
        .eq('local_id', localId)
        .maybeSingle()

      if (existing?.id) {
        const { data, error } = await supabaseAdmin
          .from('workout_routines')
          .update(payload)
          .eq('id', existing.id)
          .select('*')
          .single()
        if (error) throw error
        row = data
      } else {
        const { data, error } = await supabaseAdmin
          .from('workout_routines')
          .insert(payload)
          .select('*')
          .single()
        if (error) throw error
        row = data
      }
    } else {
      const { data, error } = await supabaseAdmin
        .from('workout_routines')
        .insert(payload)
        .select('*')
        .single()
      if (error) throw error
      row = data
    }

    res.status(201).json(mapRoutine(row))
  } catch (error) {
    const msg = String(error.message || '')
    if (msg.toLowerCase().includes('days') && req.body) {
      try {
        const { name, exercises, color, isPublic, localId, id } = req.body
        const payload = {
          user_id: req.user.id,
          name: String(name || '').trim(),
          exercises: exercises || [],
          color: color || 'primary',
          is_public: Boolean(isPublic),
          local_id: localId || null,
          updated_at: new Date().toISOString()
        }
        let row
        if (id) {
          const retry = await supabaseAdmin
            .from('workout_routines')
            .update(payload)
            .eq('id', id)
            .eq('user_id', req.user.id)
            .select('*')
            .maybeSingle()
          if (retry.error) throw retry.error
          row = retry.data
        } else {
          const retry = await supabaseAdmin.from('workout_routines').insert(payload).select('*').single()
          if (retry.error) throw retry.error
          row = retry.data
        }
        return res.status(201).json(mapRoutine(row))
      } catch (retryErr) {
        return res.status(500).json({ message: 'Error al guardar rutina', error: retryErr.message })
      }
    }
    res.status(500).json({ message: 'Error al guardar rutina', error: error.message })
  }
})

router.put('/routines/:id', authenticate, async (req, res) => {
  try {
    const { name, exercises, color, isPublic, localId, days } = req.body
    const updateData = { updated_at: new Date().toISOString() }
    if (name !== undefined) updateData.name = name
    if (exercises !== undefined) updateData.exercises = exercises
    if (color !== undefined) updateData.color = color
    if (days !== undefined) updateData.days = normalizeDays(days)
    if (isPublic !== undefined) updateData.is_public = Boolean(isPublic)
    if (localId !== undefined) updateData.local_id = localId

    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .update(updateData)
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Rutina no encontrada' })
    res.json(mapRoutine(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar rutina', error: error.message })
  }
})

router.delete('/routines/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()
    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Rutina no encontrada' })
    res.json({ message: 'Rutina eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar rutina', error: error.message })
  }
})

router.post('/routines/:id/adopt', authenticate, async (req, res) => {
  try {
    const { data: source, error } = await supabaseAdmin
      .from('workout_routines')
      .select('*')
      .eq('id', req.params.id)
      .eq('is_public', true)
      .maybeSingle()
    if (error) throw error
    if (!source) return res.status(404).json({ message: 'Rutina no disponible' })

    // Privacy: community OR public profile
    if (source.user_id !== req.user.id) {
      const communityIds = await getCommunityUserIds(req.user.id)
      if (!communityIds.includes(source.user_id)) {
        const { data: owner } = await supabaseAdmin
          .from('profiles')
          .select('settings')
          .eq('id', source.user_id)
          .maybeSingle()
        if (owner?.settings?.privacy?.profilePublic !== true) {
          return res.status(403).json({ message: 'No tienes acceso a esta rutina' })
        }
      }
    }

    const payload = {
      user_id: req.user.id,
      name: source.name,
      exercises: source.exercises || [],
      color: source.color || 'primary',
      is_public: false,
      local_id: `adopted-${Date.now()}`,
      updated_at: new Date().toISOString()
    }

    const { data, error: insertError } = await supabaseAdmin
      .from('workout_routines')
      .insert(payload)
      .select('*')
      .single()
    if (insertError) throw insertError

    res.status(201).json(mapRoutine(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al adoptar rutina', error: error.message })
  }
})

router.get('/history', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workouts')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    res.json((data || []).map(mapWorkout))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial', error: error.message })
  }
})

router.post('/', authenticate, async (req, res) => {
  try {
    const { name, exercises, duration, notes, metrics, durationSeconds } = req.body

    const payload = {
      user_id: req.user.id,
      name,
      exercises: exercises || [],
      duration: duration ?? (durationSeconds ? Math.max(1, Math.round(durationSeconds / 60)) : 0),
      notes: notes || null,
      completed_at: new Date().toISOString()
    }

    const metricsPayload = metrics || null
    if (metricsPayload) {
      payload.metrics = metricsPayload
      // Fallback if metrics column missing: embed in notes
      if (!payload.notes) {
        payload.notes = JSON.stringify({ metrics: metricsPayload })
      }
    }

    let workout
    let { data, error } = await supabaseAdmin
      .from('workouts')
      .insert(payload)
      .select('*')
      .single()

    // Retry without metrics column if schema not migrated yet
    if (error && String(error.message || '').toLowerCase().includes('metrics')) {
      const fallback = { ...payload }
      delete fallback.metrics
      fallback.notes = JSON.stringify({
        metrics: metricsPayload || {},
        note: notes || ''
      })
      const retry = await supabaseAdmin.from('workouts').insert(fallback).select('*').single()
      data = retry.data
      error = retry.error
    }

    if (error) throw error
    workout = data

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()

    const stats = { ...(profile.stats || {}) }
    stats.totalWorkouts = (stats.totalWorkouts || 0) + 1

    const { data: lastWorkouts } = await supabaseAdmin
      .from('workouts')
      .select('created_at')
      .eq('user_id', req.user.id)
      .neq('id', workout.id)
      .order('created_at', { ascending: false })
      .limit(1)

    const lastWorkout = lastWorkouts?.[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)

    if (!lastWorkout || new Date(lastWorkout.created_at) >= yesterday) {
      stats.currentStreak = (stats.currentStreak || 0) + 1
      if (stats.currentStreak > (stats.longestStreak || 0)) {
        stats.longestStreak = stats.currentStreak
      }
    } else {
      stats.currentStreak = 1
    }

    await supabaseAdmin
      .from('profiles')
      .update({ stats, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)

    const { awardXP, checkBadgeUnlocks } = await import('../services/xpService.js')
    let xpResult = null
    let unlockedBadges = []
    try {
      xpResult = await awardXP(req.user.id, 50, `Completaste el entrenamiento: ${name}`, false)
      unlockedBadges = await checkBadgeUnlocks(req.user.id, false)
    } catch (xpError) {
      console.error('Error awarding XP:', xpError)
    }

    const { data: updatedUser } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()

    res.status(201).json({
      workout: mapWorkout(workout),
      stats: updatedUser.stats,
      xpAwarded: 50,
      leveledUp: xpResult?.leveledUp || false,
      unlockedBadges: unlockedBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
      message: '¡Entrenamiento registrado!'
    })
  } catch (error) {
    console.error('Workout error:', error)
    res.status(500).json({ message: 'Error al registrar entrenamiento', error: error.message })
  }
})

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workouts')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single()

    if (error || !data) return res.status(404).json({ message: 'Entrenamiento no encontrado' })
    res.json(mapWorkout(data))
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('workouts')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()

    if (error || !data) return res.status(404).json({ message: 'Entrenamiento no encontrado' })
    res.json({ message: 'Entrenamiento eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
