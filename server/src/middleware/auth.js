import { supabaseAdmin } from '../lib/supabase.js'
import { mapProfile, attachSocial } from '../lib/mappers.js'

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')

    if (!token) {
      return res.status(401).json({ message: 'No autorizado' })
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(token)

    if (authError || !authData?.user) {
      return res.status(401).json({ message: 'Token inválido' })
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single()

    if (profileError || !profile) {
      return res.status(401).json({ message: 'Usuario no encontrado' })
    }

    const withSocial = await attachSocial(supabaseAdmin, profile)
    const roleFromMeta = authData.user.app_metadata?.role
    if (roleFromMeta && roleFromMeta !== withSocial.role) {
      withSocial.role = roleFromMeta
    }

    req.accessToken = token
    req.authUser = authData.user
    req.user = mapProfile(withSocial)
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
