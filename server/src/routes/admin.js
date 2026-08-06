import express from 'express'
import crypto from 'crypto'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapProfile } from '../lib/mappers.js'
import { authenticate, isAdmin } from '../middleware/auth.js'

const router = express.Router()
router.use(authenticate, isAdmin)

function mapMembershipPlan(row) {
  if (!row) return null
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
    features: row.features || {},
    active: row.active,
    createdAt: row.created_at
  }
}

function mapRegistrationRequest(row, extras = {}) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    email: row.email,
    status: row.status,
    accessCodeAttempts: row.access_code_attempts,
    maxAttempts: row.max_attempts,
    userData: row.user_data || {},
    accessCode: extras.accessCode || null,
    approvedBy: extras.approvedBy || null,
    createdAt: row.created_at,
    completedAt: row.completed_at
  }
}

function mapAttendance(row, user = null) {
  if (!row) return null
  return {
    _id: row.id,
    id: row.id,
    user: user || row.user_id,
    checkIn: row.check_in,
    checkOut: row.check_out,
    duration: row.duration,
    createdAt: row.created_at
  }
}

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      { count: totalUsers },
      { data: profiles },
      { count: pendingRequests },
      { count: todayAttendance }
    ] = await Promise.all([
      supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('profiles').select('membership'),
      supabaseAdmin
        .from('registration_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
      (() => {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        return supabaseAdmin
          .from('attendance')
          .select('*', { count: 'exact', head: true })
          .gte('check_in', today.toISOString())
      })()
    ])

    let activeMembers = 0
    let expiringMembers = 0
    let expiredMembers = 0
    for (const p of profiles || []) {
      const status = p.membership?.status
      if (status === 'active') activeMembers++
      else if (status === 'expiring') expiringMembers++
      else if (status === 'expired') expiredMembers++
    }

    res.json({
      totalUsers: totalUsers || 0,
      activeMembers,
      expiringMembers,
      expiredMembers,
      pendingRequests: pendingRequests || 0,
      todayAttendance: todayAttendance || 0,
      monthlyRevenue: activeMembers * 45
    })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { status, plan, search, page = 1, limit = 20 } = req.query
    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)

    let query = supabaseAdmin
      .from('profiles')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })

    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`)
    }

    const { data, error, count } = await query
    if (error) throw error

    let users = data || []
    if (status && status !== 'all') {
      users = users.filter((u) => u.membership?.status === status)
    }
    if (plan) {
      users = users.filter((u) => u.membership?.plan === plan)
    }

    const total = status || plan ? users.length : count || users.length
    const start = (pageNum - 1) * limitNum
    const paged = users.slice(start, start + limitNum)

    res.json({
      users: paged.map(mapProfile),
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum) || 1
    })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Get registration requests
router.get('/registration-requests', async (req, res) => {
  try {
    const { status = 'pending' } = req.query
    const { data, error } = await supabaseAdmin
      .from('registration_requests')
      .select('*')
      .eq('status', status)
      .order('created_at', { ascending: false })

    if (error) throw error
    res.json((data || []).map((r) => mapRegistrationRequest(r)))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener solicitudes', error: error.message })
  }
})

// Register user from request
router.post('/register-user', async (req, res) => {
  try {
    const {
      requestId,
      name,
      lastName,
      age,
      weight,
      height,
      phone,
      membershipPlan,
      membershipDuration
    } = req.body

    if (!requestId || !name || !membershipPlan) {
      return res.status(400).json({ message: 'Campos requeridos: requestId, name, membershipPlan' })
    }

    const { data: request } = await supabaseAdmin
      .from('registration_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle()

    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada' })
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Esta solicitud ya fue procesada' })
    }

    const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    const { error: codeError } = await supabaseAdmin.from('access_codes').insert({
      code: accessCode,
      email: request.email,
      registration_request_id: request.id,
      created_by: req.user.id,
      expires_at: expiresAt,
      used: false
    })
    if (codeError) throw codeError

    const userData = {
      name: `${name} ${lastName || ''}`.trim(),
      age: parseInt(age) || null,
      weight: parseFloat(weight) || null,
      height: parseFloat(height) || null,
      phone: phone || null,
      membershipPlan,
      membershipDuration: parseInt(membershipDuration) || 30
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('registration_requests')
      .update({
        status: 'approved',
        user_data: userData
      })
      .eq('id', request.id)
      .select('*')
      .single()

    if (updateError) throw updateError

    res.json({
      message: 'Usuario registrado exitosamente',
      accessCode,
      request: mapRegistrationRequest(updated, {
        accessCode,
        approvedBy: { _id: req.user.id, id: req.user.id, name: req.user.name, email: req.user.email }
      })
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar usuario', error: error.message })
  }
})

// Create user (admin - direct)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, plan = 'basic' } = req.body

    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle()

    if (existing) return res.status(400).json({ message: 'El email ya existe' })

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase(),
      password: password || crypto.randomBytes(8).toString('hex'),
      email_confirm: true,
      user_metadata: { name },
      app_metadata: { role: 'user' }
    })
    if (createError) throw createError

    const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: profile, error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: created.user.id,
        name,
        email: email.toLowerCase(),
        role: 'user',
        membership: {
          plan,
          status: 'active',
          startDate: new Date().toISOString(),
          endDate
        },
        stats: { totalWorkouts: 0, currentStreak: 0, longestStreak: 0, level: 1, xp: 0 },
        settings: { theme: 'light', colorTheme: 'orange', language: 'es' },
        updated_at: new Date().toISOString()
      })
      .select('*')
      .single()

    if (upsertError) throw upsertError

    res.status(201).json({ message: 'Usuario creado', user: mapProfile(profile) })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const updates = { ...req.body }
    delete updates.password
    delete updates._id
    delete updates.id

    const updateData = { updated_at: new Date().toISOString() }
    const allowed = [
      'name',
      'email',
      'phone',
      'role',
      'avatar',
      'goal',
      'membership',
      'stats',
      'badges',
      'settings',
      'profile'
    ]
    for (const key of allowed) {
      if (updates[key] !== undefined) updateData[key] = updates[key]
    }
    if (updates.onboardingCompleted !== undefined) {
      updateData.onboarding_completed = updates.onboardingCompleted
    }
    if (updates.mustResetPassword !== undefined) {
      updateData.must_reset_password = updates.mustResetPassword
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Usuario no encontrado' })

    if (updateData.role) {
      await supabaseAdmin.auth.admin.updateUserById(req.params.id, {
        app_metadata: { role: updateData.role }
      })
    }

    res.json(mapProfile(data))
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Delete user — purge all related app data
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id
    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })

    // User-authored posts → likes/comments on those posts, then posts
    const { data: userPosts } = await supabaseAdmin.from('posts').select('id').eq('user_id', userId)
    const postIds = (userPosts || []).map((p) => p.id)
    if (postIds.length) {
      await supabaseAdmin.from('post_likes').delete().in('post_id', postIds)
      await supabaseAdmin.from('post_comments').delete().in('post_id', postIds)
      await supabaseAdmin.from('posts').delete().in('id', postIds)
    }

    // Activity on others' content
    await supabaseAdmin.from('post_comments').delete().eq('user_id', userId)
    await supabaseAdmin.from('post_likes').delete().eq('user_id', userId)

    // Stories + reactions/views/favorites
    const { data: userStories } = await supabaseAdmin.from('stories').select('id').eq('user_id', userId)
    const storyIds = (userStories || []).map((s) => s.id)
    if (storyIds.length) {
      await supabaseAdmin.from('story_reactions').delete().in('story_id', storyIds)
      await supabaseAdmin.from('story_views').delete().in('story_id', storyIds)
      await supabaseAdmin.from('stories').delete().in('id', storyIds)
    }
    await supabaseAdmin.from('story_reactions').delete().eq('user_id', userId)
    await supabaseAdmin.from('story_views').delete().eq('user_id', userId)
    await supabaseAdmin.from('story_favorites').delete().eq('user_id', userId)
    await supabaseAdmin.from('story_favorite_albums').delete().eq('user_id', userId)

    // Social graph, chat, notifications
    await supabaseAdmin.from('follows').delete().eq('follower_id', userId)
    await supabaseAdmin.from('follows').delete().eq('following_id', userId)
    await supabaseAdmin.from('messages').delete().eq('from_user_id', userId)
    await supabaseAdmin.from('messages').delete().eq('to_user_id', userId)
    await supabaseAdmin.from('notifications').delete().eq('user_id', userId)
    await supabaseAdmin.from('notifications').delete().eq('related_user_id', userId)
    await supabaseAdmin.from('follow_requests').delete().eq('from_user_id', userId)
    await supabaseAdmin.from('follow_requests').delete().eq('to_user_id', userId)

    // Classes, challenges, gym activity
    await supabaseAdmin.from('class_enrollments').delete().eq('user_id', userId)
    await supabaseAdmin.from('class_waitlist').delete().eq('user_id', userId)
    await supabaseAdmin.from('challenge_participants').delete().eq('user_id', userId)
    // Challenges created by the user
    const { data: ownedChallenges } = await supabaseAdmin
      .from('challenges')
      .select('id')
      .eq('created_by', userId)
    const challengeIds = (ownedChallenges || []).map((c) => c.id)
    if (challengeIds.length) {
      await supabaseAdmin.from('challenge_participants').delete().in('challenge_id', challengeIds)
      await supabaseAdmin.from('challenges').delete().in('id', challengeIds)
    }

    await supabaseAdmin.from('workouts').delete().eq('user_id', userId)
    await supabaseAdmin.from('attendance').delete().eq('user_id', userId)

    // Profile + auth (username lives on profile)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    await supabaseAdmin.auth.admin.deleteUser(userId)

    res.json({ message: 'Usuario y todo su contenido eliminados' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar usuario', error: error.message })
  }
})

// MEMBERSHIPS MANAGEMENT

const initializeDefaultMemberships = async () => {
  try {
    const defaultMemberships = [
      {
        plan: 'basic',
        name: 'Básico',
        price: 29,
        duration: 30,
        benefits: ['Acceso al gimnasio', 'Horario limitado'],
        features: {
          accessToClasses: true,
          accessToChallenges: true,
          accessToSocial: true,
          accessToChat: true,
          accessToReports: false,
          personalTrainer: false,
          nutritionPlan: false
        },
        active: true
      },
      {
        plan: 'premium',
        name: 'Premium',
        price: 49,
        duration: 30,
        benefits: ['Acceso completo', 'Clases grupales', 'Área de pesas'],
        features: {
          accessToClasses: true,
          accessToChallenges: true,
          accessToSocial: true,
          accessToChat: true,
          accessToReports: true,
          personalTrainer: false,
          nutritionPlan: false
        },
        active: true
      },
      {
        plan: 'elite',
        name: 'Elite',
        price: 79,
        duration: 30,
        benefits: ['Todo Premium', 'Entrenador personal', 'Nutrición', 'Spa'],
        features: {
          accessToClasses: true,
          accessToChallenges: true,
          accessToSocial: true,
          accessToChat: true,
          accessToReports: true,
          personalTrainer: true,
          nutritionPlan: true
        },
        active: true
      }
    ]

    for (const membershipData of defaultMemberships) {
      const { data: existing } = await supabaseAdmin
        .from('membership_plans')
        .select('id')
        .eq('plan', membershipData.plan)
        .maybeSingle()

      if (!existing) {
        await supabaseAdmin.from('membership_plans').insert(membershipData)
        console.log(`Membresía ${membershipData.plan} inicializada`)
      }
    }
  } catch (error) {
    console.error('Error inicializando membresías:', error)
  }
}

// Get all memberships
router.get('/memberships', async (req, res) => {
  try {
    await initializeDefaultMemberships()

    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .select('*')
      .order('plan', { ascending: true })

    if (error) throw error
    res.json((data || []).map(mapMembershipPlan))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresías', error: error.message })
  }
})

// Get single membership
router.get('/memberships/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Membresía no encontrada' })
    res.json(mapMembershipPlan(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresía', error: error.message })
  }
})

// Create membership
router.post('/memberships', async (req, res) => {
  try {
    const { plan, name, description, price, duration, durationUnit, benefits, features } = req.body

    if (!plan || !name || price === undefined || !duration) {
      return res.status(400).json({ message: 'Campos requeridos: plan, name, price, duration' })
    }

    const { data: existing } = await supabaseAdmin
      .from('membership_plans')
      .select('id')
      .eq('plan', plan)
      .maybeSingle()

    if (existing) {
      return res.status(400).json({ message: 'Ya existe una membresía con este plan' })
    }

    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .insert({
        plan,
        name,
        price: parseFloat(price),
        duration: parseInt(duration),
        benefits: benefits || [],
        features: features || {
          accessToClasses: true,
          accessToChallenges: true,
          accessToSocial: true,
          accessToChat: true,
          accessToReports: false,
          personalTrainer: false,
          nutritionPlan: false
        },
        active: true
      })
      .select('*')
      .single()

    if (error) throw error
    const mapped = mapMembershipPlan(data)
    if (description) mapped.description = description
    if (durationUnit) mapped.durationUnit = durationUnit
    res.status(201).json(mapped)
  } catch (error) {
    res.status(500).json({ message: 'Error al crear membresía', error: error.message })
  }
})

// Update membership
router.put('/memberships/:id', async (req, res) => {
  try {
    const { name, price, duration, benefits, features, active } = req.body

    const updateData = {}
    if (name) updateData.name = name
    if (price !== undefined) updateData.price = parseFloat(price)
    if (duration !== undefined) updateData.duration = parseInt(duration)
    if (benefits) updateData.benefits = benefits
    if (features) updateData.features = features
    if (active !== undefined) updateData.active = active

    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .update(updateData)
      .eq('id', req.params.id)
      .select('*')
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Membresía no encontrada' })

    res.json(mapMembershipPlan(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar membresía', error: error.message })
  }
})

// Delete membership
router.delete('/memberships/:id', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .delete()
      .eq('id', req.params.id)
      .select('id')
      .maybeSingle()

    if (error) throw error
    if (!data) return res.status(404).json({ message: 'Membresía no encontrada' })
    res.json({ message: 'Membresía eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar membresía', error: error.message })
  }
})

// ATTENDANCE MANAGEMENT

router.post('/attendance/checkin', async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario requerido' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: existingCheckIn } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .gte('check_in', today.toISOString())
      .lt('check_in', tomorrow.toISOString())
      .maybeSingle()

    if (existingCheckIn) {
      if (!existingCheckIn.check_out) {
        return res.status(400).json({ message: 'El usuario ya tiene un registro de entrada activo hoy' })
      }
      return res.status(400).json({ message: 'El usuario ya registró su visita completa hoy' })
    }

    const checkInTime = new Date().toISOString()
    const { data: attendance, error } = await supabaseAdmin
      .from('attendance')
      .insert({ user_id: userId, check_in: checkInTime })
      .select('*')
      .single()

    if (error) throw error

    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, avatar')
      .eq('id', userId)
      .maybeSingle()

    res.status(201).json({
      _id: attendance.id,
      id: attendance.id,
      user: user
        ? { _id: user.id, id: user.id, name: user.name, email: user.email, avatar: user.avatar }
        : userId,
      checkIn: checkInTime,
      checkOut: null,
      duration: null
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar entrada', error: error.message })
  }
})

router.post('/attendance/checkout', async (req, res) => {
  try {
    const { userId } = req.body

    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario requerido' })
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const { data: attendance } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .gte('check_in', today.toISOString())
      .lt('check_in', tomorrow.toISOString())
      .is('check_out', null)
      .maybeSingle()

    if (!attendance) {
      return res.status(400).json({ message: 'No se encontró un registro de entrada para hoy' })
    }

    const checkOutTime = new Date()
    const duration = Math.round((checkOutTime - new Date(attendance.check_in)) / 1000 / 60)

    const { error } = await supabaseAdmin
      .from('attendance')
      .update({ check_out: checkOutTime.toISOString(), duration })
      .eq('id', attendance.id)

    if (error) throw error

    res.json({
      _id: attendance.id,
      id: attendance.id,
      user: userId,
      checkIn: attendance.check_in,
      checkOut: checkOutTime.toISOString(),
      duration
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar salida', error: error.message })
  }
})

router.get('/attendance', async (req, res) => {
  try {
    const { userId, startDate, endDate, limit = 100 } = req.query

    let query = supabaseAdmin
      .from('attendance')
      .select('*')
      .order('check_in', { ascending: false })
      .limit(parseInt(limit))

    if (userId) query = query.eq('user_id', userId)
    if (startDate) query = query.gte('check_in', new Date(startDate).toISOString())
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query = query.lte('check_in', end.toISOString())
    }

    const { data, error } = await query
    if (error) throw error

    const userIds = [...new Set((data || []).map((a) => a.user_id))]
    let userMap = {}
    if (userIds.length) {
      const { data: users } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, avatar')
        .in('id', userIds)
      userMap = Object.fromEntries(
        (users || []).map((u) => [
          u.id,
          { _id: u.id, id: u.id, name: u.name, email: u.email, avatar: u.avatar }
        ])
      )
    }

    res.json((data || []).map((row) => mapAttendance(row, userMap[row.user_id] || row.user_id)))
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener asistencias', error: error.message })
  }
})

router.get('/attendance/stats', async (req, res) => {
  try {
    const { period = 'month' } = req.query

    let startDate = new Date()
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      case 'month':
      default:
        startDate.setMonth(startDate.getMonth() - 1)
    }

    const { data: rows, error } = await supabaseAdmin
      .from('attendance')
      .select('*')
      .gte('check_in', startDate.toISOString())

    if (error) throw error
    const attendance = rows || []

    const dailyMap = {}
    const userMapStats = {}
    let durationSum = 0
    let durationCount = 0

    for (const row of attendance) {
      const day = new Date(row.check_in).toISOString().slice(0, 10)
      if (!dailyMap[day]) dailyMap[day] = { _id: day, count: 0, totalDuration: 0 }
      dailyMap[day].count++
      dailyMap[day].totalDuration += row.duration || 0

      if (!userMapStats[row.user_id]) {
        userMapStats[row.user_id] = { _id: row.user_id, visits: 0, totalDuration: 0 }
      }
      userMapStats[row.user_id].visits++
      userMapStats[row.user_id].totalDuration += row.duration || 0

      if (row.duration != null) {
        durationSum += row.duration
        durationCount++
      }
    }

    const dailyStats = Object.values(dailyMap).sort((a, b) => a._id.localeCompare(b._id))
    const userStats = Object.values(userMapStats)
      .sort((a, b) => b.visits - a.visits)
      .slice(0, 10)

    const topUserIds = userStats.map((s) => s._id)
    let profilesMap = {}
    if (topUserIds.length) {
      const { data: users } = await supabaseAdmin
        .from('profiles')
        .select('id, name, email, avatar')
        .in('id', topUserIds)
      profilesMap = Object.fromEntries(
        (users || []).map((u) => [
          u.id,
          { _id: u.id, id: u.id, name: u.name, email: u.email, avatar: u.avatar }
        ])
      )
    }

    res.json({
      period,
      startDate,
      dailyStats,
      userStats: userStats.map((s) => ({ ...s, user: profilesMap[s._id] || null })),
      overall: {
        totalVisits: attendance.length,
        uniqueUsers: Object.keys(userMapStats).length,
        avgDuration: durationCount ? durationSum / durationCount : 0
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message })
  }
})

router.get('/reports/attendance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const { data, error } = await supabaseAdmin
      .from('attendance')
      .select('check_in')
      .gte('check_in', start.toISOString())
      .lte('check_in', end.toISOString())

    if (error) throw error

    const grouped = {}
    for (const row of data || []) {
      const day = new Date(row.check_in).toISOString().slice(0, 10)
      grouped[day] = (grouped[day] || 0) + 1
    }

    res.json(
      Object.entries(grouped)
        .map(([day, count]) => ({ _id: day, count }))
        .sort((a, b) => a._id.localeCompare(b._id))
    )
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.get('/reports/memberships', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('profiles').select('membership')
    if (error) throw error

    const byPlanMap = {}
    const byStatusMap = {}
    for (const p of data || []) {
      const plan = p.membership?.plan || 'unknown'
      const status = p.membership?.status || 'unknown'
      byPlanMap[plan] = (byPlanMap[plan] || 0) + 1
      byStatusMap[status] = (byStatusMap[status] || 0) + 1
    }

    res.json({
      byPlan: Object.entries(byPlanMap).map(([_id, count]) => ({ _id, count })),
      byStatus: Object.entries(byStatusMap).map(([_id, count]) => ({ _id, count }))
    })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
