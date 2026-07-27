import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapClass } from '../lib/mappers.js'
import { authenticate, isAdmin, isTrainerOrAdmin } from '../middleware/auth.js'

const router = express.Router()

function mapUserBrief(u) {
  if (!u) return null
  return { _id: u.id, id: u.id, name: u.name, avatar: u.avatar, email: u.email }
}

async function getProfilesMap(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))]
  if (!unique.length) return {}
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, name, avatar, email, stats')
    .in('id', unique)
  return Object.fromEntries((data || []).map((p) => [p.id, p]))
}

async function hydrateClass(row, { includeWaitlist = false, includeEmail = false } = {}) {
  if (!row) return null

  const [{ data: enrollments }, waitlistResult] = await Promise.all([
    supabaseAdmin
      .from('class_enrollments')
      .select('*')
      .eq('class_id', row.id)
      .order('enrolled_at', { ascending: true }),
    includeWaitlist
      ? supabaseAdmin
          .from('class_waitlist')
          .select('*')
          .eq('class_id', row.id)
          .order('added_at', { ascending: true })
      : Promise.resolve({ data: [] })
  ])

  const waitlist = waitlistResult.data || []
  const userIds = [
    row.instructor_id,
    ...(enrollments || []).map((e) => e.user_id),
    ...waitlist.map((w) => w.user_id)
  ]
  const userMap = await getProfilesMap(userIds)
  const instructor = userMap[row.instructor_id]

  const enrolled = (enrollments || []).map((e) => ({
    user: mapUserBrief(userMap[e.user_id]) || e.user_id,
    enrolledAt: e.enrolled_at,
    completedAt: e.completed_at,
    _id: e.id,
    id: e.id
  }))

  const waitlistMapped = waitlist.map((w) => ({
    user: mapUserBrief(userMap[w.user_id]) || w.user_id,
    addedAt: w.added_at
  }))

  const mapped = mapClass(row, {
    instructor: instructor
      ? {
          _id: instructor.id,
          id: instructor.id,
          name: instructor.name,
          avatar: instructor.avatar,
          ...(includeEmail ? { email: instructor.email } : {})
        }
      : row.instructor_id,
    enrolled,
    waitlist: waitlistMapped
  })

  mapped.maxCapacity = row.capacity
  mapped.capacity = row.capacity
  mapped.cancelled = !!(row.schedule && row.schedule.cancelled)
  mapped.cancelReason = row.schedule?.cancelReason || null
  mapped.difficulty = row.schedule?.difficulty
  mapped.location = row.schedule?.location
  mapped.specificDate = row.schedule?.specificDate

  return mapped
}

function buildClassInsert(body, defaultInstructorId) {
  const schedule = {
    ...(body.schedule || {}),
    ...(body.difficulty ? { difficulty: body.difficulty } : {}),
    ...(body.location ? { location: body.location } : {}),
    ...(body.specificDate ? { specificDate: body.specificDate } : {}),
    cancelled: false
  }

  return {
    name: body.name,
    description: body.description || null,
    instructor_id: body.instructor || body.instructor_id || defaultInstructorId,
    type: body.type,
    capacity: body.maxCapacity ?? body.capacity ?? 20,
    duration: body.duration,
    image: body.image || null,
    equipment: body.equipment || [],
    schedule
  }
}

// Get all classes
router.get('/', authenticate, async (req, res) => {
  try {
    const { type, instructor } = req.query

    let query = supabaseAdmin.from('classes').select('*')
    if (type) query = query.eq('type', type)
    if (instructor) query = query.eq('instructor_id', instructor)

    const { data, error } = await query
    if (error) throw error

    const active = (data || []).filter((c) => !c.schedule?.cancelled)
    active.sort((a, b) => {
      const dayA = a.schedule?.dayOfWeek ?? 99
      const dayB = b.schedule?.dayOfWeek ?? 99
      if (dayA !== dayB) return dayA - dayB
      return String(a.schedule?.startTime || '').localeCompare(String(b.schedule?.startTime || ''))
    })

    const hydrated = await Promise.all(active.map((c) => hydrateClass(c)))
    res.json(hydrated)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clases', error: error.message })
  }
})

// Get single class
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Clase no encontrada' })

    res.json(await hydrateClass(data, { includeWaitlist: true, includeEmail: true }))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clase', error: error.message })
  }
})

// Create class (admin/trainer only)
router.post('/', authenticate, isTrainerOrAdmin, async (req, res) => {
  try {
    const payload = buildClassInsert(req.body, req.user.id)
    const { data, error } = await supabaseAdmin
      .from('classes')
      .insert(payload)
      .select('*')
      .single()

    if (error) throw error
    res.status(201).json(await hydrateClass(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al crear clase', error: error.message })
  }
})

// Update class
router.put('/:id', authenticate, isTrainerOrAdmin, async (req, res) => {
  try {
    const { data: existing } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!existing) return res.status(404).json({ message: 'Clase no encontrada' })

    const updateData = {}
    if (req.body.name !== undefined) updateData.name = req.body.name
    if (req.body.description !== undefined) updateData.description = req.body.description
    if (req.body.type !== undefined) updateData.type = req.body.type
    if (req.body.duration !== undefined) updateData.duration = req.body.duration
    if (req.body.image !== undefined) updateData.image = req.body.image
    if (req.body.equipment !== undefined) updateData.equipment = req.body.equipment
    if (req.body.instructor || req.body.instructor_id) {
      updateData.instructor_id = req.body.instructor || req.body.instructor_id
    }
    if (req.body.maxCapacity !== undefined || req.body.capacity !== undefined) {
      updateData.capacity = req.body.maxCapacity ?? req.body.capacity
    }
    if (req.body.schedule || req.body.difficulty || req.body.location || req.body.specificDate) {
      updateData.schedule = {
        ...(existing.schedule || {}),
        ...(req.body.schedule || {}),
        ...(req.body.difficulty ? { difficulty: req.body.difficulty } : {}),
        ...(req.body.location ? { location: req.body.location } : {}),
        ...(req.body.specificDate ? { specificDate: req.body.specificDate } : {})
      }
    }

    const { data, error } = await supabaseAdmin
      .from('classes')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw error
    res.json(await hydrateClass(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar clase', error: error.message })
  }
})

// Enroll in class
router.post('/:id/enroll', authenticate, async (req, res) => {
  try {
    const { data: classItem } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }

    const { data: existing } = await supabaseAdmin
      .from('class_enrollments')
      .select('id')
      .eq('class_id', classItem.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ message: 'Ya estás inscrito en esta clase' })
    }

    const { count } = await supabaseAdmin
      .from('class_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classItem.id)

    if ((count || 0) >= (classItem.capacity || 20)) {
      await supabaseAdmin.from('class_waitlist').upsert({
        class_id: classItem.id,
        user_id: req.user.id
      })

      const { count: waitCount } = await supabaseAdmin
        .from('class_waitlist')
        .select('*', { count: 'exact', head: true })
        .eq('class_id', classItem.id)

      return res.json({
        message: 'Clase llena. Te agregamos a la lista de espera',
        waitlistPosition: waitCount || 1
      })
    }

    await supabaseAdmin.from('class_enrollments').insert({
      class_id: classItem.id,
      user_id: req.user.id
    })

    await supabaseAdmin.from('notifications').insert({
      user_id: req.user.id,
      type: 'class_reminder',
      title: '¡Inscripción confirmada!',
      body: `Te has inscrito en ${classItem.name}`,
      icon: '📅'
    })

    const hydrated = await hydrateClass(classItem)
    res.json({ message: 'Inscripción exitosa', classItem: hydrated })
  } catch (error) {
    res.status(500).json({ message: 'Error al inscribirse', error: error.message })
  }
})

// Cancel enrollment
router.delete('/:id/enroll', authenticate, async (req, res) => {
  try {
    const { data: classItem } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }

    await supabaseAdmin
      .from('class_enrollments')
      .delete()
      .eq('class_id', classItem.id)
      .eq('user_id', req.user.id)

    await supabaseAdmin
      .from('class_waitlist')
      .delete()
      .eq('class_id', classItem.id)
      .eq('user_id', req.user.id)

    const { count } = await supabaseAdmin
      .from('class_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('class_id', classItem.id)

    if ((count || 0) < (classItem.capacity || 20)) {
      const { data: nextWait } = await supabaseAdmin
        .from('class_waitlist')
        .select('*')
        .eq('class_id', classItem.id)
        .order('added_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (nextWait) {
        await supabaseAdmin
          .from('class_waitlist')
          .delete()
          .eq('class_id', classItem.id)
          .eq('user_id', nextWait.user_id)

        await supabaseAdmin.from('class_enrollments').insert({
          class_id: classItem.id,
          user_id: nextWait.user_id
        })

        await supabaseAdmin.from('notifications').insert({
          user_id: nextWait.user_id,
          type: 'class_reminder',
          title: '¡Tienes un lugar!',
          body: `Se liberó un espacio en ${classItem.name}. Ya estás inscrito.`,
          icon: '🎉',
          priority: 'high'
        })
      }
    }

    const hydrated = await hydrateClass(classItem)
    res.json({ message: 'Inscripción cancelada', classItem: hydrated })
  } catch (error) {
    res.status(500).json({ message: 'Error al cancelar inscripción', error: error.message })
  }
})

// Cancel class (admin/trainer)
router.post('/:id/cancel', authenticate, isTrainerOrAdmin, async (req, res) => {
  try {
    const { reason } = req.body

    const { data: classItem } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }

    const schedule = {
      ...(classItem.schedule || {}),
      cancelled: true,
      cancelReason: reason || null
    }

    await supabaseAdmin.from('classes').update({ schedule }).eq('id', classItem.id)

    const { data: enrollments } = await supabaseAdmin
      .from('class_enrollments')
      .select('user_id')
      .eq('class_id', classItem.id)

    if (enrollments?.length) {
      await supabaseAdmin.from('notifications').insert(
        enrollments.map((e) => ({
          user_id: e.user_id,
          type: 'class_cancelled',
          title: 'Clase cancelada',
          body: `La clase ${classItem.name} ha sido cancelada. ${reason || ''}`,
          icon: '❌',
          priority: 'high'
        }))
      )
    }

    res.json({ message: 'Clase cancelada y usuarios notificados' })
  } catch (error) {
    res.status(500).json({ message: 'Error al cancelar clase', error: error.message })
  }
})

// Mark class as completed (for enrolled users)
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const { data: classItem } = await supabaseAdmin
      .from('classes')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }

    const { data: enrollment } = await supabaseAdmin
      .from('class_enrollments')
      .select('*')
      .eq('class_id', classItem.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (!enrollment) {
      return res.status(400).json({ message: 'No estás inscrito en esta clase' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    if (
      enrollment.completed_at &&
      new Date(enrollment.completed_at) >= today &&
      new Date(enrollment.completed_at) < tomorrow
    ) {
      return res.status(400).json({ message: 'Ya completaste esta clase hoy' })
    }

    await supabaseAdmin
      .from('class_enrollments')
      .update({ completed_at: new Date().toISOString() })
      .eq('id', enrollment.id)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stats')
      .eq('id', req.user.id)
      .single()

    const stats = { ...(profile?.stats || {}) }
    stats.classesCompleted = (stats.classesCompleted || 0) + 1
    await supabaseAdmin
      .from('profiles')
      .update({ stats, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)

    const { awardXP, checkBadgeUnlocks } = await import('../services/xpService.js')
    let xpResult = null
    let unlockedBadges = []

    try {
      xpResult = await awardXP(req.user.id, 30, `Completaste la clase: ${classItem.name}`, false)
      unlockedBadges = await checkBadgeUnlocks(req.user.id, false)
    } catch (xpError) {
      console.error('Error awarding XP:', xpError)
    }

    const { data: updatedUser } = await supabaseAdmin
      .from('profiles')
      .select('stats')
      .eq('id', req.user.id)
      .single()

    res.json({
      message: '¡Clase completada!',
      xpAwarded: 30,
      leveledUp: xpResult?.leveledUp || false,
      unlockedBadges: unlockedBadges.map((b) => ({ id: b.id, name: b.name, icon: b.icon })),
      stats: updatedUser?.stats || stats
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al completar clase', error: error.message })
  }
})

// Delete class
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await supabaseAdmin.from('class_enrollments').delete().eq('class_id', req.params.id)
    await supabaseAdmin.from('class_waitlist').delete().eq('class_id', req.params.id)
    await supabaseAdmin.from('classes').delete().eq('id', req.params.id)
    res.json({ message: 'Clase eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar clase', error: error.message })
  }
})

export default router
