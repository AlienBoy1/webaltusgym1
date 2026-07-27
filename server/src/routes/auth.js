import express from 'express'
import crypto from 'crypto'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapProfile, attachSocial } from '../lib/mappers.js'

const router = express.Router()

async function countProfiles() {
  const { count, error } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true })
  if (error) throw error
  return count || 0
}

async function getProfileByEmail(email) {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  if (error) throw error
  return data
}

async function createAuthAndProfile({ email, password, name, role, phone, profile, membership, stats }) {
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role }
  })

  if (createError) throw createError

  const userId = created.user.id
  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('profiles')
    .upsert({
      id: userId,
      name: name || 'Usuario',
      email: email.toLowerCase(),
      phone: phone || null,
      role,
      membership: membership || { plan: 'basic', status: 'active', startDate: new Date().toISOString() },
      stats: stats || { totalWorkouts: 0, currentStreak: 0, longestStreak: 0, level: 1, xp: 0 },
      profile: profile || {},
      onboarding_completed: false,
      updated_at: new Date().toISOString()
    })
    .select('*')
    .single()

  if (upsertError) throw upsertError
  return upserted
}

async function sessionFor(email, password) {
  const { data, error } = await supabaseAdmin.auth.signInWithPassword({
    email: email.toLowerCase(),
    password
  })
  if (error) throw error
  return data
}

// Request access
router.post('/request-access', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'El correo es requerido' })

    const existingUser = await getProfileByEmail(email)
    if (existingUser) {
      return res.status(400).json({ message: 'Este correo ya está registrado' })
    }

    const { data: existingRequest } = await supabaseAdmin
      .from('registration_requests')
      .select('*')
      .eq('email', email.toLowerCase())
      .in('status', ['pending', 'approved'])
      .maybeSingle()

    if (existingRequest) {
      return res.status(400).json({
        message: 'Ya existe una solicitud pendiente para este correo',
        requestId: existingRequest.id
      })
    }

    const { data: request, error } = await supabaseAdmin
      .from('registration_requests')
      .insert({ email: email.toLowerCase(), status: 'pending' })
      .select('*')
      .single()

    if (error) throw error

    res.status(201).json({
      message: 'Solicitud enviada exitosamente',
      requestId: request.id
    })
  } catch (error) {
    console.error('Request access error:', error)
    res.status(500).json({ message: 'Error al enviar solicitud', error: error.message })
  }
})

router.post('/complete-registration', async (req, res) => {
  try {
    const { email, accessCode, password, confirmPassword } = req.body

    if (!email || !accessCode || !password) {
      return res.status(400).json({ message: 'Todos los campos son requeridos' })
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Las contraseñas no coinciden' })
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const { data: request } = await supabaseAdmin
      .from('registration_requests')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'approved')
      .maybeSingle()

    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada o no aprobada' })
    }

    const { data: code } = await supabaseAdmin
      .from('access_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', accessCode.toUpperCase())
      .eq('used', false)
      .maybeSingle()

    if (!code) {
      const attempts = (request.access_code_attempts || 0) + 1
      const maxAttempts = request.max_attempts || 3

      if (attempts >= maxAttempts) {
        await supabaseAdmin
          .from('registration_requests')
          .update({ status: 'rejected', access_code_attempts: attempts })
          .eq('id', request.id)
        await supabaseAdmin
          .from('access_codes')
          .delete()
          .eq('registration_request_id', request.id)
        return res.status(400).json({
          message: 'Máximo de intentos alcanzado. La solicitud ha sido cancelada.'
        })
      }

      await supabaseAdmin
        .from('registration_requests')
        .update({ access_code_attempts: attempts })
        .eq('id', request.id)

      return res.status(400).json({
        message: `Código inválido. Intentos restantes: ${maxAttempts - attempts}`
      })
    }

    if (new Date() > new Date(code.expires_at)) {
      return res.status(400).json({ message: 'El código de acceso ha expirado' })
    }

    if (await getProfileByEmail(email)) {
      return res.status(400).json({ message: 'Este correo ya está registrado' })
    }

    const userData = request.user_data || {}
    const profile = await createAuthAndProfile({
      email,
      password,
      name: userData.name || 'Usuario',
      role: 'user',
      phone: userData.phone,
      profile: {
        age: userData.age,
        weight: userData.weight,
        height: userData.height
      },
      membership: {
        plan: userData.membershipPlan || 'basic',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(
          Date.now() + (userData.membershipDuration || 30) * 24 * 60 * 60 * 1000
        ).toISOString()
      }
    })

    await supabaseAdmin
      .from('access_codes')
      .update({ used: true, used_at: new Date().toISOString(), used_by: profile.id })
      .eq('id', code.id)

    await supabaseAdmin
      .from('registration_requests')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', request.id)

    await supabaseAdmin.from('notifications').insert({
      user_id: profile.id,
      type: 'welcome',
      title: '¡Bienvenido a QYNTRA GYM!',
      body: '¡Comienza tu viaje fitness hoy! Explora las funciones de la app.',
      icon: '🏋️',
      priority: 'high'
    })

    const session = await sessionFor(email, password)
    const mapped = mapProfile(profile)

    res.status(201).json({
      message: 'Registro completado exitosamente',
      token: session.session.access_token,
      refreshToken: session.session.refresh_token,
      user: {
        _id: mapped._id,
        id: mapped.id,
        name: mapped.name,
        email: mapped.email,
        role: mapped.role,
        membership: mapped.membership,
        stats: mapped.stats
      }
    })
  } catch (error) {
    console.error('Complete registration error:', error)
    res.status(500).json({ message: 'Error al completar registro', error: error.message })
  }
})

router.post('/verify-code', async (req, res) => {
  try {
    const { email, accessCode } = req.body
    if (!email || !accessCode) {
      return res.status(400).json({ message: 'Correo y código son requeridos' })
    }

    const { data: request } = await supabaseAdmin
      .from('registration_requests')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('status', 'approved')
      .maybeSingle()

    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada o no aprobada' })
    }

    const { data: code } = await supabaseAdmin
      .from('access_codes')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('code', accessCode.toUpperCase())
      .eq('used', false)
      .maybeSingle()

    if (!code) {
      const attempts = (request.access_code_attempts || 0) + 1
      const maxAttempts = request.max_attempts || 3

      if (attempts >= maxAttempts) {
        await supabaseAdmin
          .from('registration_requests')
          .update({ status: 'rejected', access_code_attempts: attempts })
          .eq('id', request.id)
        await supabaseAdmin
          .from('access_codes')
          .delete()
          .eq('registration_request_id', request.id)
        return res.status(400).json({
          message: 'Máximo de intentos alcanzado. La solicitud ha sido cancelada.',
          attemptsExceeded: true
        })
      }

      await supabaseAdmin
        .from('registration_requests')
        .update({ access_code_attempts: attempts })
        .eq('id', request.id)

      return res.status(400).json({
        message: `Código inválido. Intentos restantes: ${maxAttempts - attempts}`,
        attemptsRemaining: maxAttempts - attempts
      })
    }

    if (new Date() > new Date(code.expires_at)) {
      return res.status(400).json({ message: 'El código de acceso ha expirado' })
    }

    res.json({ message: 'Código válido', valid: true })
  } catch (error) {
    res.status(500).json({ message: 'Error al verificar código', error: error.message })
  }
})

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body
    if (await getProfileByEmail(email)) {
      return res.status(400).json({ message: 'El email ya está registrado' })
    }

    const userCount = await countProfiles()
    const isFirstUser = userCount === 0
    const role = isFirstUser ? 'admin' : 'user'

    const profile = await createAuthAndProfile({
      email,
      password,
      name,
      role,
      membership: {
        plan: isFirstUser ? 'elite' : 'basic',
        status: 'active',
        startDate: new Date().toISOString(),
        endDate: new Date(
          Date.now() + (isFirstUser ? 365 : 30) * 24 * 60 * 60 * 1000
        ).toISOString()
      }
    })

    await supabaseAdmin.from('notifications').insert({
      user_id: profile.id,
      type: 'welcome',
      title: isFirstUser ? '¡Bienvenido Administrador!' : '¡Bienvenido a QYNTRA GYM!',
      body: isFirstUser
        ? 'Eres el primer usuario y administrador. Tienes acceso completo al panel de administración.'
        : '¡Comienza tu viaje fitness hoy! Explora las funciones de la app.',
      icon: '🏋️',
      priority: 'high'
    })

    const session = await sessionFor(email, password)
    const mapped = mapProfile(profile)

    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token: session.session.access_token,
      refreshToken: session.session.refresh_token,
      user: {
        _id: mapped._id,
        id: mapped.id,
        name: mapped.name,
        email: mapped.email,
        role: mapped.role,
        membership: mapped.membership,
        stats: mapped.stats
      },
      isFirstUser
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Error al registrar usuario', error: error.message })
  }
})

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const session = await sessionFor(email, password)

    // Profile read first; last_login update in background (faster login)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }

    supabaseAdmin
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', session.user.id)
      .then(() => {})
      .catch(() => {})

    const mapped = mapProfile(profile)

    res.json({
      message: 'Login exitoso',
      token: session.session.access_token,
      refreshToken: session.session.refresh_token,
      user: {
        _id: mapped._id,
        id: mapped.id,
        name: mapped.name,
        email: mapped.email,
        role: mapped.role,
        avatar: mapped.avatar,
        membership: mapped.membership,
        stats: mapped.stats,
        mustResetPassword: mapped.mustResetPassword
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(401).json({ message: 'Credenciales inválidas' })
  }
})

router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    if (!email) return res.status(400).json({ message: 'El correo es requerido' })

    const normalized = email.toLowerCase().trim()

    // Gym app: clearer UX if account does not exist in Supabase yet
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('email', normalized)
      .maybeSingle()

    if (!profile) {
      return res.status(404).json({
        message:
          'No hay una cuenta con ese correo en Qyntra. Regístrate primero (el primer usuario será admin) o ejecuta la migración desde Mongo.',
        code: 'USER_NOT_FOUND'
      })
    }

    const siteUrl =
      process.env.CLIENT_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:5173'

    const redirectTo = `${siteUrl.replace(/\/$/, '')}/reset-password`

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(normalized, {
      redirectTo
    })
    if (error) throw error

    res.json({
      message: 'Te enviamos un enlace para restablecer tu contraseña. Revisa bandeja y spam.'
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({ message: 'Error al enviar correo', error: error.message })
  }
})

router.post('/update-password', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    const { password } = req.body
    if (!token) return res.status(401).json({ message: 'Sesión de recuperación inválida' })
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' })
    }

    const { data: authData, error: userError } = await supabaseAdmin.auth.getUser(token)
    if (userError || !authData?.user) {
      return res.status(401).json({ message: 'Sesión de recuperación inválida o expirada' })
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
      password
    })
    if (error) throw error

    await supabaseAdmin
      .from('profiles')
      .update({ must_reset_password: false, updated_at: new Date().toISOString() })
      .eq('id', authData.user.id)

    res.json({ message: 'Contraseña actualizada correctamente' })
  } catch (error) {
    console.error('Update password error:', error)
    res.status(500).json({ message: 'Error al actualizar contraseña', error: error.message })
  }
})

router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    if (!token) return res.status(401).json({ message: 'No autorizado' })

    const { data: authData, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !authData?.user) return res.status(401).json({ message: 'Token inválido' })

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (!profile) return res.status(404).json({ message: 'Usuario no encontrado' })

    const withSocial = await attachSocial(supabaseAdmin, profile)
    res.json({ user: mapProfile(withSocial) })
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' })
  }
})

export function generateAccessCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

export default router
