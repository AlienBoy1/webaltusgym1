import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapProfile } from '../lib/mappers.js'

const PROFILE_AUTH_COLUMNS =
  'id, name, username, email, phone, role, avatar, goal, membership, stats, badges, settings, onboarding_completed, must_reset_password, last_login, created_at, updated_at'

/** Best-effort per-isolate cache (helps bursty SPA mounts on warm instances). */
const AUTH_CACHE_TTL_MS = 45_000
const authCache = new Map()

function rememberAuth(token, payload) {
  authCache.set(token, { ...payload, exp: Date.now() + AUTH_CACHE_TTL_MS })
  if (authCache.size > 300) {
    const now = Date.now()
    for (const [key, val] of authCache) {
      if (val.exp <= now) authCache.delete(key)
    }
  }
}

function verifyAccessTokenLocally(token) {
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET
  if (!secret) return null
  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ['HS256']
    })
    const sub = payload?.sub
    if (!sub) return null
    return { id: sub, role: payload?.app_metadata?.role || payload?.role || null, claims: payload }
  } catch {
    return null
  }
}

async function loadAuthProfile(userId, roleFromMeta = null) {
  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_AUTH_COLUMNS)
    .eq('id', userId)
    .single()

  if (profileError || !profile) return null
  if (roleFromMeta && roleFromMeta !== profile.role) {
    profile.role = roleFromMeta
  }
  return profile
}

/**
 * Fast auth — prefer local JWT verify (no Auth network hop).
 * Does NOT load followers/following.
 */
export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ message: 'No autorizado' })
    }

    const cached = authCache.get(token)
    if (cached && cached.exp > Date.now()) {
      req.accessToken = token
      req.authUser = cached.authUser
      req.user = cached.user
      return next()
    }

    let authUser = null
    const local = verifyAccessTokenLocally(token)
    if (local) {
      authUser = { id: local.id, app_metadata: { role: local.role } }
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)
      if (authError || !authData?.user) {
        authCache.delete(token)
        return res.status(401).json({ message: 'Token inválido' })
      }
      authUser = authData.user
    }

    const profile = await loadAuthProfile(
      authUser.id,
      authUser.app_metadata?.role || null
    )

    if (!profile) {
      return res.status(401).json({ message: 'Usuario no encontrado' })
    }

    req.accessToken = token
    req.authUser = authUser
    req.user = mapProfile(profile)
    rememberAuth(token, { authUser, user: req.user })
    next()
  } catch (error) {
    console.error('Auth error:', error)
    res.status(401).json({ message: 'Token inválido' })
  }
}

export const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' })
  }
  next()
}

export const isTrainerOrAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin' && req.user?.role !== 'trainer') {
    return res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador o entrenador.' })
  }
  next()
}

export default { authenticate, isAdmin, isTrainerOrAdmin }
