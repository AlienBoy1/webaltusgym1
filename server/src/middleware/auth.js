import jwt from 'jsonwebtoken'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapProfile } from '../lib/mappers.js'

/** Minimal columns for every authenticated request — never pull cover/profile blobs. */
const PROFILE_AUTH_COLUMNS =
  'id, name, username, email, phone, role, avatar, goal, membership, stats, badges, settings, onboarding_completed, must_reset_password, last_login, created_at, updated_at'

const AUTH_CACHE_TTL_MS = 120_000
const PROFILE_CACHE_TTL_MS = 180_000
const authCache = new Map()
const profileByUserCache = new Map()

const MAX_INLINE_AVATAR = 12_000

function slimAvatar(avatar) {
  if (!avatar) return null
  const s = String(avatar)
  if (s.startsWith('icon:') || s.startsWith('http://') || s.startsWith('https://')) return s
  // Skip huge base64 on the hot path (Profile loads full avatar when needed)
  if (s.startsWith('data:') && s.length > MAX_INLINE_AVATAR) return null
  if (s.length > MAX_INLINE_AVATAR) return null
  return s
}

function rememberAuth(token, payload) {
  authCache.set(token, { ...payload, exp: Date.now() + AUTH_CACHE_TTL_MS })
  if (authCache.size > 400) {
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
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] })
    const sub = payload?.sub
    if (!sub) return null
    return { id: sub, role: payload?.app_metadata?.role || payload?.role || null, claims: payload }
  } catch {
    return null
  }
}

async function loadAuthProfile(userId, roleFromMeta = null) {
  const cached = profileByUserCache.get(userId)
  if (cached && cached.exp > Date.now()) {
    const profile = { ...cached.profile }
    if (roleFromMeta && roleFromMeta !== profile.role) profile.role = roleFromMeta
    return profile
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_AUTH_COLUMNS)
    .eq('id', userId)
    .single()

  if (profileError || !profile) return null
  if (roleFromMeta && roleFromMeta !== profile.role) {
    profile.role = roleFromMeta
  }
  profile.avatar = slimAvatar(profile.avatar)
  profileByUserCache.set(userId, { profile: { ...profile }, exp: Date.now() + PROFILE_CACHE_TTL_MS })
  return profile
}

/** Call after profile media updates so next request sees fresh avatar. */
export function invalidateAuthProfileCache(userId) {
  if (!userId) return
  profileByUserCache.delete(userId)
  for (const [token, val] of authCache) {
    if (val?.user?.id === userId || val?.user?._id === userId) {
      authCache.delete(token)
    }
  }
}

/**
 * Fast auth — local JWT when possible + slim cached profile.
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

export default { authenticate, isAdmin, isTrainerOrAdmin, invalidateAuthProfileCache }
