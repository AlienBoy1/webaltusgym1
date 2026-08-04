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
