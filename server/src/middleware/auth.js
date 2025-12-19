import jwt from 'jsonwebtoken'
import User from '../models/User.js'

export const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ message: 'No autorizado' })
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'altus_secret_key_2024')
    const user = await User.findById(decoded.userId).select('-password')
    
    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' })
    }
    
    req.user = user
    next()
  } catch (error) {
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
