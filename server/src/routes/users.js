import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapProfile, mapWorkout, attachSocial } from '../lib/mappers.js'
import { authenticate, isAdmin } from '../middleware/auth.js'

const router = express.Router()

router.get('/stats', authenticate, async (req, res) => {
  try {
    const { count } = await supabaseAdmin
      .from('workouts')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', req.user.id)

    const stats = req.user.stats || {}
    res.json({
      totalWorkouts: count || stats.totalWorkouts || 0,
      currentStreak: stats.currentStreak || 0,
      longestStreak: stats.longestStreak || 0,
      level: stats.level || 1,
      xp: stats.xp || 0
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message })
  }
})

router.get('/profile', authenticate, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', req.user.id)
      .single()
    const withSocial = await attachSocial(supabaseAdmin, profile)
    res.json({ ...mapProfile(withSocial), settings: profile.settings || {} })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener perfil', error: error.message })
  }
})

router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, avatar, phone, settings, goal, profile } = req.body
    const updateData = { updated_at: new Date().toISOString() }
    if (name) updateData.name = name
    if (avatar !== undefined) updateData.avatar = avatar
    if (phone !== undefined) updateData.phone = phone
    if (settings !== undefined) updateData.settings = settings
    if (goal !== undefined) updateData.goal = goal
    if (profile !== undefined) updateData.profile = profile

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', req.user.id)
      .select('*')
      .single()

    if (error) throw error
    res.json({ message: 'Perfil actualizado', user: mapProfile(data) })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar perfil', error: error.message })
  }
})

router.put('/:id/role', authenticate, isAdmin, async (req, res) => {
  try {
    const { role } = req.body
    if (!['user', 'admin', 'trainer'].includes(role)) {
      return res.status(400).json({ message: 'Rol inválido' })
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error || !data) return res.status(404).json({ message: 'Usuario no encontrado' })

    await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
      app_metadata: { role }
    })

    res.json({ message: 'Rol actualizado', user: mapProfile(data) })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar rol', error: error.message })
  }
})

router.put('/:id/membership', authenticate, isAdmin, async (req, res) => {
  try {
    const { plan, status, endDate } = req.body
    const { data: current } = await supabaseAdmin
      .from('profiles')
      .select('membership')
      .eq('id', req.params.id)
      .single()

    if (!current) return res.status(404).json({ message: 'Usuario no encontrado' })

    const membership = {
      ...(current.membership || {}),
      ...(plan !== undefined ? { plan } : {}),
      ...(status !== undefined ? { status } : {}),
      ...(endDate !== undefined ? { endDate } : {})
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ membership, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select('*')
      .single()

    if (error) throw error
    res.json({ message: 'Membresía actualizada', user: mapProfile(data) })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar membresía', error: error.message })
  }
})

router.get('/memberships', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .select('*')
      .eq('active', true)
      .order('price', { ascending: true })
    if (error) throw error
    res.json(
      (data || []).map((p) => ({
        _id: p.id,
        id: p.id,
        plan: p.plan,
        name: p.name,
        price: p.price,
        duration: p.duration,
        benefits: p.benefits,
        features: p.features,
        active: p.active
      }))
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresías', error: error.message })
  }
})

router.get('/badges/definitions', authenticate, async (req, res) => {
  try {
    const { getBadgeDefinitions } = await import('../services/xpService.js')
    res.json(getBadgeDefinitions())
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener definiciones de insignias', error: error.message })
  }
})

router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, filter } = req.query
    let query = supabaseAdmin
      .from('profiles')
      .select('id, name, email, avatar')
      .neq('id', req.user.id)
      .limit(50)

    if (q?.trim()) {
      query = query.or(`name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`).limit(20)
    }

    if (filter === 'following') {
      const { data: following } = await supabaseAdmin
        .from('follows')
        .select('following_id')
        .eq('follower_id', req.user.id)
      const ids = (following || []).map((f) => f.following_id)
      if (!ids.length) return res.json([])
      query = query.in('id', ids)
    } else if (filter === 'not_following') {
      const { data: following } = await supabaseAdmin
        .from('follows')
        .select('following_id')
        .eq('follower_id', req.user.id)
      const ids = (following || []).map((f) => f.following_id)
      if (ids.length) query = query.not('id', 'in', `(${ids.join(',')})`)
    } else if (filter === 'with_conversation') {
      const { data: msgs } = await supabaseAdmin
        .from('messages')
        .select('from_user_id, to_user_id')
        .or(`from_user_id.eq.${req.user.id},to_user_id.eq.${req.user.id}`)
      const ids = [
        ...new Set(
          (msgs || []).map((m) =>
            m.from_user_id === req.user.id ? m.to_user_id : m.from_user_id
          )
        )
      ]
      if (!ids.length) return res.json([])
      query = query.in('id', ids)
    }

    const { data, error } = await query
    if (error) throw error
    res.json((data || []).map((u) => ({ _id: u.id, id: u.id, name: u.name, email: u.email, avatar: u.avatar })))
  } catch (error) {
    console.error('Error searching users:', error)
    res.status(500).json({ message: 'Error al buscar usuarios', error: error.message })
  }
})

router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params
    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ message: 'ID de usuario inválido' })
    }

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !profile) return res.status(404).json({ message: 'Usuario no encontrado' })
    const withSocial = await attachSocial(supabaseAdmin, profile)
    res.json(mapProfile(withSocial))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener usuario', error: error.message })
  }
})

export default router
