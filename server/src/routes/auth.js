import express from 'express'
import crypto from 'crypto'
import { supabaseAdmin, createAuthClient } from '../lib/supabase.js'
import { mapProfile } from '../lib/mappers.js'
import { validateUsernameFormat } from '../utils/username.js'
import {
  syncMembershipPlansLifecycle,
  syncUserMembershipOnProfile
} from '../services/membershipService.js'
import {
  FREE_ERA_END_ISO,
  freeEraEndLabel,
  isPastFreeEra,
  paidEraStartLabel
} from '../utils/membershipLifecycle.js'

const router = express.Router()

async function assertUsernameAvailable(username, excludeUserId = null) {
  const check = validateUsernameFormat(username)
  if (!check.ok) {
    const err = new Error(check.message)
    err.status = 400
    err.code = 'USERNAME_INVALID'
    throw err
  }
  let query = supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('username', check.username)
    .limit(1)
  if (excludeUserId) query = query.neq('id', excludeUserId)
  const { data, error } = await query.maybeSingle()
  if (error) throw error
  if (data) {
    const err = new Error('Este username ya está en uso')
    err.status = 409
    err.code = 'USERNAME_TAKEN'
    throw err
  }
  return check.username
}

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

async function upsertProfileRow({
  userId,
  email,
  name,
  role,
  phone,
  profile,
  membership,
  stats,
  username
}) {
  const payload = {
    id: userId,
    name: name || 'Usuario',
    email: email.toLowerCase(),
    phone: phone || null,
    role,
    membership: membership || { plan: 'basic', status: 'active', startDate: new Date().toISOString() },
    stats: stats || { totalWorkouts: 0, currentStreak: 0, longestStreak: 0, level: 1, xp: 0 },
    profile: profile || {},
    settings: {
      theme: 'light',
      colorTheme: 'orange',
      language: 'es'
    },
    onboarding_completed: false,
    updated_at: new Date().toISOString()
  }
  if (username) payload.username = username

  const { data: upserted, error: upsertError } = await supabaseAdmin
    .from('profiles')
    .upsert(payload)
    .select('*')
    .single()

  if (upsertError) throw upsertError
  return upserted
}

async function createAuthAndProfile({
  email,
  password,
  name,
  role,
  phone,
  profile,
  membership,
  stats,
  username
}) {
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email: email.toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role }
  })

  if (createError) throw createError

  return upsertProfileRow({
    userId: created.user.id,
    email,
    name,
    role,
    phone,
    profile,
    membership,
    stats,
    username
  })
}

/** Completes registration for an Auth user already created by Google OAuth (no second auth.users row). */
async function createProfileForExistingAuthUser({
  userId,
  email,
  password,
  name,
  role,
  phone,
  profile,
  membership,
  stats,
  username
}) {
  const updates = {
    email_confirm: true,
    user_metadata: { name },
    app_metadata: { role }
  }
  if (password) updates.password = password

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)
  if (updErr) throw updErr

  return upsertProfileRow({
    userId,
    email,
    name,
    role,
    phone,
    profile,
    membership,
    stats,
    username
  })
}

function mapAuthUserPayload(mapped) {
  return {
    _id: mapped._id,
    id: mapped.id,
    name: mapped.name,
    username: mapped.username || null,
    email: mapped.email,
    role: mapped.role,
    avatar: mapped.avatar,
    membership: mapped.membership,
    stats: mapped.stats,
    mustResetPassword: mapped.mustResetPassword
  }
}

function membershipNoticeFor(membership) {
  if (!membership || membership.__paidEra === true || membership.era === 'paid') return null
  if (isPastFreeEra()) {
    return {
      type: 'expired',
      title: 'Periodo gratuito finalizado',
      body: `Tu membresía gratuita venció el ${freeEraEndLabel()}. Las membresías de pago se habilitan el ${paidEraStartLabel()}.`,
      freeEndsAt: FREE_ERA_END_ISO
    }
  }
  return {
    type: 'free_era_warning',
    title: 'Membresía gratuita por tiempo limitado',
    body: `Tu membresía gratuita vence el ${freeEraEndLabel()}. A partir de enero 2027 se habilitarán los planes de pago en Qyntra.`,
    freeEndsAt: FREE_ERA_END_ISO
  }
}

async function prepareAuthProfile(profile, { notifyMembership = false } = {}) {
  try {
    const synced = await syncUserMembershipOnProfile(profile)
    syncMembershipPlansLifecycle().catch((err) => {
      console.warn('syncMembershipPlansLifecycle:', err?.message || err)
    })
    const mapped = mapProfile(synced)

    if (notifyMembership) {
      const uid = synced?.id || mapped?.id || mapped?._id
      import('../services/notificationService.js')
        .then(({ notifyFreeMembershipCountdown }) =>
          notifyFreeMembershipCountdown(uid, mapped.membership || synced?.membership)
        )
        .catch((err) => console.warn('membership countdown notify:', err?.message || err))
    }

    return {
      mapped,
      membershipNotice: membershipNoticeFor(mapped.membership)
    }
  } catch (err) {
    // Never block login/session because of membership sync
    console.error('prepareAuthProfile:', err?.message || err)
    return {
      mapped: mapProfile(profile),
      membershipNotice: membershipNoticeFor(profile?.membership)
    }
  }
}

/** If client has a Google (or other OAuth) session for this email and no profile yet, reuse that auth user. */
async function resolveExistingAuthUserForRegistration(req, email) {
  const bearer = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (!bearer) return null

  const { data: authData, error } = await supabaseAdmin.auth.getUser(bearer)
  if (error || !authData?.user) return null

  const authUser = authData.user
  if ((authUser.email || '').toLowerCase() !== email.toLowerCase()) return null

  const { data: existingProfile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('id', authUser.id)
    .maybeSingle()

  if (existingProfile) return null
  return authUser
}

async function sessionFor(email, password) {
  // Use a fresh anon client — never sign in on supabaseAdmin (session pollution)
  const authClient = createAuthClient()
  const { data, error } = await authClient.auth.signInWithPassword({
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
    const membership = {
      plan: userData.membershipPlan || 'basic',
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: new Date(
        Date.now() + (userData.membershipDuration || 30) * 24 * 60 * 60 * 1000
      ).toISOString()
    }
    const profilePayload = {
      age: userData.age,
      weight: userData.weight,
      height: userData.height
    }

    const existingAuthUser = await resolveExistingAuthUserForRegistration(req, email)
    const profile = existingAuthUser
      ? await createProfileForExistingAuthUser({
          userId: existingAuthUser.id,
          email,
          password,
          name: userData.name || existingAuthUser.user_metadata?.full_name || 'Usuario',
          role: 'user',
          phone: userData.phone,
          profile: profilePayload,
          membership
        })
      : await createAuthAndProfile({
          email,
          password,
          name: userData.name || 'Usuario',
          role: 'user',
          phone: userData.phone,
          profile: profilePayload,
          membership
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
      user: mapAuthUserPayload(mapped)
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

router.get('/username-check', async (req, res) => {
  try {
    const raw = req.query.u || req.query.username || ''
    const format = validateUsernameFormat(raw)
    if (!format.ok) {
      return res.json({ available: false, username: format.username, message: format.message })
    }
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('username', format.username)
      .maybeSingle()
    if (data) {
      return res.json({
        available: false,
        username: format.username,
        message: 'Este username ya está en uso'
      })
    }
    res.json({ available: true, username: format.username, message: 'Username disponible' })
  } catch (error) {
    res.status(500).json({ message: 'Error al validar username', error: error.message })
  }
})

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, username } = req.body
    if (await getProfileByEmail(email)) {
      return res.status(400).json({ message: 'El email ya está registrado' })
    }

    let normalizedUsername
    try {
      normalizedUsername = await assertUsernameAvailable(username)
    } catch (err) {
      return res.status(err.status || 400).json({
        message: err.message,
        code: err.code
      })
    }

    const userCount = await countProfiles()
    const isFirstUser = userCount === 0
    const role = isFirstUser ? 'admin' : 'user'
    const membership = {
      plan: isFirstUser ? 'elite' : 'basic',
      status: 'active',
      startDate: new Date().toISOString(),
      endDate: new Date(
        Date.now() + (isFirstUser ? 365 : 30) * 24 * 60 * 60 * 1000
      ).toISOString()
    }

    const existingAuthUser = await resolveExistingAuthUserForRegistration(req, email)
    const profile = existingAuthUser
      ? await createProfileForExistingAuthUser({
          userId: existingAuthUser.id,
          email,
          password,
          name: name || existingAuthUser.user_metadata?.full_name || 'Usuario',
          role,
          membership,
          username: normalizedUsername
        })
      : await createAuthAndProfile({
          email,
          password,
          name,
          role,
          membership,
          username: normalizedUsername
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
      user: mapAuthUserPayload(mapped),
      isFirstUser
    })
  } catch (error) {
    console.error('Register error:', error)
    const msg = String(error.message || '')
    if (msg.includes('profiles_username') || msg.toLowerCase().includes('duplicate')) {
      return res.status(409).json({ message: 'Este username ya está en uso', code: 'USERNAME_TAKEN' })
    }
    res.status(500).json({ message: 'Error al registrar usuario', error: error.message })
  }
})

router.post('/google', async (req, res) => {
  try {
    const { accessToken, refreshToken } = req.body
    if (!accessToken) {
      return res.status(400).json({ message: 'Token de Google requerido' })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken)
    if (authError || !authData?.user) {
      return res.status(401).json({ message: 'Sesión de Google inválida o expirada' })
    }

    const authUser = authData.user
    const email = (authUser.email || '').toLowerCase()

    const { data: profileById } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle()

    if (!profileById) {
      if (email) {
        const profileByEmail = await getProfileByEmail(email)
        if (profileByEmail) {
          return res.status(409).json({
            code: 'EMAIL_EXISTS_NEEDS_LINK',
            message:
              'Ya existe una cuenta con este correo. Inicia sesión con email y contraseña y vincula Google desde Configuración.'
          })
        }
      }

      return res.status(403).json({
        code: 'NEEDS_REGISTRATION',
        message:
          'Esta cuenta de Google aún no está registrada en Qyntra. Completa tu registro (username, nombre y contraseña).',
        email,
        name:
          authUser.user_metadata?.full_name ||
          authUser.user_metadata?.name ||
          authUser.user_metadata?.preferred_username ||
          '',
        avatar: authUser.user_metadata?.avatar_url || authUser.user_metadata?.picture || null
      })
    }

    supabaseAdmin
      .from('profiles')
      .update({ last_login: new Date().toISOString() })
      .eq('id', authUser.id)
      .then(() => {})
      .catch(() => {})

    const { mapped, membershipNotice } = await prepareAuthProfile(profileById, {
      notifyMembership: true
    })

    const token = accessToken
    let nextRefresh = refreshToken || null

    if (!nextRefresh) {
      return res.status(400).json({
        message: 'Falta refresh token de la sesión. Vuelve a iniciar con Google.'
      })
    }

    res.json({
      message: 'Login exitoso',
      token,
      refreshToken: nextRefresh,
      user: mapAuthUserPayload(mapped),
      membershipNotice
    })
  } catch (error) {
    console.error('Google auth error:', error)
    res.status(500).json({ message: 'Error al autenticar con Google', error: error.message })
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

    const { mapped, membershipNotice } = await prepareAuthProfile(profile, {
      notifyMembership: true
    })

    res.json({
      message: 'Login exitoso',
      token: session.session.access_token,
      refreshToken: session.session.refresh_token,
      user: mapAuthUserPayload(mapped),
      membershipNotice
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(401).json({ message: 'Credenciales inválidas' })
  }
})

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body
    if (!refreshToken) {
      return res.status(400).json({ message: 'Refresh token requerido' })
    }

    const authClient = createAuthClient()
    const { data, error } = await authClient.auth.refreshSession({ refreshToken })
    if (error || !data?.session || !data.session.user) {
      console.error('Refresh session failed:', error)
      return res.status(401).json({ message: 'No se pudo refrescar la sesión' })
    }

    const session = data.session
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ message: 'Usuario inválido' })
    }

    const { mapped, membershipNotice } = await prepareAuthProfile(profile)
    res.json({
      message: 'Sesión renovada',
      token: session.access_token,
      refreshToken: session.refresh_token,
      user: mapAuthUserPayload(mapped),
      membershipNotice
    })
  } catch (error) {
    console.error('Refresh token error:', error)
    res.status(500).json({ message: 'Error al refrescar la sesión' })
  }
})

function resolvePasswordResetRedirect() {
  // Always send users to the real SPA reset page — never Site URL / localhost:3000
  const PRODUCTION = 'https://qyntagymweb.vercel.app'
  const configured = (process.env.CLIENT_URL || '').trim().replace(/\/$/, '')
  const onVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV)

  let base
  if (onVercel) {
    base =
      configured && !/localhost|127\.0\.0\.1/i.test(configured) ? configured : PRODUCTION
  } else if (configured && !/localhost|127\.0\.0\.1/i.test(configured)) {
    base = configured
  } else {
    base = 'http://localhost:5173'
  }

  // Guard against common misconfig (Supabase Site URL / wrong CLIENT_URL)
  if (/localhost:3000/i.test(base) || !base) {
    base = onVercel ? PRODUCTION : 'http://localhost:5173'
  }

  return `${base.replace(/\/$/, '')}/reset-password`
}

function forceRedirectInActionLink(actionLink, redirectTo) {
  try {
    const url = new URL(actionLink)
    url.searchParams.set('redirect_to', redirectTo)
    return url.toString()
  } catch {
    return actionLink
  }
}

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

    const redirectTo = resolvePasswordResetRedirect()

    // Generate recovery link via Admin API (does not send email).
    // App sends the branded email itself — avoids broken Supabase custom SMTP 500s.
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email: normalized,
      options: { redirectTo }
    })
    if (linkError) throw linkError

    let actionLink = linkData?.properties?.action_link
    if (!actionLink) {
      throw new Error('No se pudo generar el enlace de recuperación')
    }
    actionLink = forceRedirectInActionLink(actionLink, redirectTo)

    const { sendPasswordResetEmail, isSmtpConfigured } = await import('../lib/mailer.js')

    if (!isSmtpConfigured()) {
      return res.status(503).json({
        message:
          'Falta configurar SMTP en Vercel (SMTP_USER y SMTP_PASS con la contraseña de aplicación de Gmail). También desactiva el SMTP custom roto en Supabase → Authentication → SMTP.',
        code: 'SMTP_NOT_CONFIGURED'
      })
    }

    try {
      await sendPasswordResetEmail({ to: normalized, actionLink })
    } catch (mailErr) {
      console.error('SMTP send error:', mailErr)
      return res.status(502).json({
        message:
          'No se pudo enviar el correo por Gmail. Revisa SMTP_USER/SMTP_PASS (contraseña de aplicación, no la de la cuenta) y que 2FA esté activo en Google.',
        code: 'SMTP_SEND_FAILED',
        error: mailErr.message
      })
    }

    res.json({
      message: 'Te enviamos un enlace para restablecer tu contraseña. Revisa bandeja y spam.',
      redirectTo
    })
  } catch (error) {
    console.error('Forgot password error:', error)
    res.status(500).json({
      message: error.message || 'Error al enviar correo',
      error: error.message
    })
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

    // Prefer local JWT when SUPABASE_JWT_SECRET is set; otherwise Auth API.
    let userId = null
    let roleFromMeta = null
    const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET
    if (secret) {
      try {
        const jwt = (await import('jsonwebtoken')).default
        const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
        userId = payload?.sub || null
        roleFromMeta = payload?.app_metadata?.role || null
      } catch {
        userId = null
      }
    }
    if (!userId) {
      const { data: authData, error } = await supabaseAdmin.auth.getUser(token)
      if (error || !authData?.user) return res.status(401).json({ message: 'Token inválido' })
      userId = authData.user.id
      roleFromMeta = authData.user.app_metadata?.role || null
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select(
        'id, name, username, email, phone, role, avatar, goal, membership, stats, badges, settings, onboarding_completed, must_reset_password, last_login, created_at, updated_at'
      )
      .eq('id', userId)
      .single()

    if (!profile) return res.status(404).json({ message: 'Usuario no encontrado' })
    if (roleFromMeta && roleFromMeta !== profile.role) profile.role = roleFromMeta

    // Never ship base64 covers on boot; skip huge avatars on /me
    if (profile.avatar && String(profile.avatar).startsWith('data:') && String(profile.avatar).length > 12000) {
      profile.avatar = null
    }

    const { mapped, membershipNotice } = await prepareAuthProfile(profile)

    // Social graph is loaded on demand (profile / follow endpoints) — keep boot fast
    res.setHeader('Cache-Control', 'private, max-age=30')
    res.json({ user: mapped, membershipNotice })
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' })
  }
})

export function generateAccessCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase()
}

export default router
