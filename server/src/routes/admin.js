import express from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import User from '../models/User.js'
import Attendance from '../models/Attendance.js'
import Workout from '../models/Workout.js'
import Membership from '../models/Membership.js'
import RegistrationRequest from '../models/RegistrationRequest.js'
import AccessCode from '../models/AccessCode.js'
import { authenticate, isAdmin } from '../middleware/auth.js'

const router = express.Router()
router.use(authenticate, isAdmin)

// Dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const totalUsers = await User.countDocuments()
    const activeMembers = await User.countDocuments({ 'membership.status': 'active' })
    const expiringMembers = await User.countDocuments({ 'membership.status': 'expiring' })
    const expiredMembers = await User.countDocuments({ 'membership.status': 'expired' })
    const pendingRequests = await RegistrationRequest.countDocuments({ status: 'pending' })
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const todayAttendance = await Attendance.countDocuments({ checkIn: { $gte: today } })
    const monthlyRevenue = activeMembers * 45
    res.json({ 
      totalUsers, 
      activeMembers, 
      expiringMembers, 
      expiredMembers, 
      pendingRequests,
      todayAttendance, 
      monthlyRevenue 
    })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Get all users
router.get('/users', async (req, res) => {
  try {
    const { status, plan, search, page = 1, limit = 20 } = req.query
    const filter = {}
    if (status && status !== 'all') filter['membership.status'] = status
    if (plan) filter['membership.plan'] = plan
    if (search) filter.$or = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }]
    const users = await User.find(filter).select('-password -twoFactorSecret').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(parseInt(limit))
    const total = await User.countDocuments(filter)
    res.json({ users, total, page: parseInt(page), pages: Math.ceil(total / limit) })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Get registration requests
router.get('/registration-requests', async (req, res) => {
  try {
    const { status = 'pending' } = req.query
    const requests = await RegistrationRequest.find({ status })
      .sort({ createdAt: -1 })
      .populate('approvedBy', 'name email')
    
    res.json(requests)
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
    
    const request = await RegistrationRequest.findById(requestId)
    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada' })
    }
    
    if (request.status !== 'pending') {
      return res.status(400).json({ message: 'Esta solicitud ya fue procesada' })
    }
    
    // Generate access code
    const accessCode = crypto.randomBytes(4).toString('hex').toUpperCase()
    
    // Create access code
    const code = new AccessCode({
      code: accessCode,
      email: request.email,
      registrationRequest: request._id,
      createdBy: req.user._id
    })
    await code.save()
    
    // Update request with user data
    request.status = 'approved'
    request.approvedAt = new Date()
    request.approvedBy = req.user._id
    request.accessCode = accessCode
    request.userData = {
      name: `${name} ${lastName || ''}`.trim(),
      age: parseInt(age) || null,
      weight: parseFloat(weight) || null,
      height: parseFloat(height) || null,
      phone: phone || null,
      membershipPlan: membershipPlan,
      membershipDuration: parseInt(membershipDuration) || 30
    }
    await request.save()
    
    res.json({
      message: 'Usuario registrado exitosamente',
      accessCode: accessCode,
      request: request
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar usuario', error: error.message })
  }
})

// Create user (admin - direct)
router.post('/users', async (req, res) => {
  try {
    const { name, email, password, plan = 'basic' } = req.body
    const existing = await User.findOne({ email })
    if (existing) return res.status(400).json({ message: 'El email ya existe' })
    
    const user = new User({
      name, email, password, role: 'user',
      membership: { plan, status: 'active', startDate: new Date(), endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) },
      stats: { totalWorkouts: 0, currentStreak: 0, longestStreak: 0, level: 1, xp: 0 }
    })
    await user.save()
    res.status(201).json({ message: 'Usuario creado', user: { ...user.toObject(), password: undefined } })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const updates = req.body
    delete updates.password
    const user = await User.findByIdAndUpdate(req.params.id, { ...updates, updatedAt: new Date() }, { new: true }).select('-password')
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })
    res.json(user)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id)
    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' })
    await Workout.deleteMany({ user: user._id })
    await Attendance.deleteMany({ user: user._id })
    res.json({ message: 'Usuario eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// MEMBERSHIPS MANAGEMENT

// Initialize default memberships if they don't exist
const initializeDefaultMemberships = async () => {
  try {
    const defaultMemberships = [
      {
        plan: 'basic',
        name: 'Básico',
        description: 'Plan básico de membresía',
        price: 29,
        duration: 30, // 30 days (1 month)
        durationUnit: 'months',
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
        description: 'Plan premium con acceso completo',
        price: 49,
        duration: 30, // 30 days (1 month)
        durationUnit: 'months',
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
        description: 'Plan elite con todos los beneficios',
        price: 79,
        duration: 30, // 30 days (1 month)
        durationUnit: 'months',
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
      const existing = await Membership.findOne({ plan: membershipData.plan })
      if (!existing) {
        const membership = new Membership(membershipData)
        await membership.save()
        console.log(`Membresía ${membershipData.plan} inicializada`)
      }
    }
  } catch (error) {
    console.error('Error inicializando membresías:', error)
  }
}

// Get all memberships
router.get('/memberships', authenticate, isAdmin, async (req, res) => {
  try {
    // Initialize default memberships if needed
    await initializeDefaultMemberships()
    
    const memberships = await Membership.find().sort({ plan: 1 })
    res.json(memberships)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresías', error: error.message })
  }
})

// Get single membership
router.get('/memberships/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const membership = await Membership.findById(req.params.id)
    if (!membership) {
      return res.status(404).json({ message: 'Membresía no encontrada' })
    }
    res.json(membership)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresía', error: error.message })
  }
})

// Create membership
router.post('/memberships', authenticate, isAdmin, async (req, res) => {
  try {
    const { plan, name, description, price, duration, durationUnit, benefits, features } = req.body
    
    if (!plan || !name || price === undefined || !duration) {
      return res.status(400).json({ message: 'Campos requeridos: plan, name, price, duration' })
    }
    
    const existing = await Membership.findOne({ plan })
    if (existing) {
      return res.status(400).json({ message: 'Ya existe una membresía con este plan' })
    }
    
    const membership = new Membership({
      plan,
      name,
      description: description || '',
      price: parseFloat(price),
      duration: parseInt(duration),
      durationUnit: durationUnit || 'days',
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
      createdBy: req.user._id
    })
    
    await membership.save()
    res.status(201).json(membership)
  } catch (error) {
    res.status(500).json({ message: 'Error al crear membresía', error: error.message })
  }
})

// Update membership
router.put('/memberships/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, description, price, duration, durationUnit, benefits, features, active } = req.body
    
    const updateData = {}
    if (name) updateData.name = name
    if (description !== undefined) updateData.description = description
    if (price !== undefined) updateData.price = parseFloat(price)
    if (duration !== undefined) updateData.duration = parseInt(duration)
    if (durationUnit) updateData.durationUnit = durationUnit
    if (benefits) updateData.benefits = benefits
    if (features) updateData.features = features
    if (active !== undefined) updateData.active = active
    
    const membership = await Membership.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    )
    
    if (!membership) {
      return res.status(404).json({ message: 'Membresía no encontrada' })
    }
    
    res.json(membership)
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar membresía', error: error.message })
  }
})

// Delete membership
router.delete('/memberships/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const membership = await Membership.findByIdAndDelete(req.params.id)
    if (!membership) {
      return res.status(404).json({ message: 'Membresía no encontrada' })
    }
    res.json({ message: 'Membresía eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar membresía', error: error.message })
  }
})

// ATTENDANCE MANAGEMENT

// Register check-in
router.post('/attendance/checkin', async (req, res) => {
  try {
    const { userId } = req.body
    
    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario requerido' })
    }
    
    // Check if user already checked in today (with or without checkout)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const existingCheckIn = await Attendance.findOne({
      user: userId,
      checkIn: { $gte: today, $lt: tomorrow }
    }).lean() // Use lean() for faster queries without mongoose document overhead
    
    if (existingCheckIn) {
      if (!existingCheckIn.checkOut) {
        return res.status(400).json({ message: 'El usuario ya tiene un registro de entrada activo hoy' })
      } else {
        return res.status(400).json({ message: 'El usuario ya registró su visita completa hoy' })
      }
    }
    
    const checkInTime = new Date()
    const attendance = new Attendance({
      user: userId,
      checkIn: checkInTime
    })
    
    await attendance.save()
    
    // Get user data for response
    const user = await User.findById(userId).select('name email avatar')
    
    // Send response immediately
    res.status(201).json({
      _id: attendance._id,
      user: user || userId,
      checkIn: checkInTime,
      checkOut: null,
      duration: null
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar entrada', error: error.message })
  }
})

// Register check-out
router.post('/attendance/checkout', async (req, res) => {
  try {
    const { userId } = req.body
    
    if (!userId) {
      return res.status(400).json({ message: 'ID de usuario requerido' })
    }
    
    // Find today's check-in without checkout
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    const attendance = await Attendance.findOne({
      user: userId,
      checkIn: { $gte: today, $lt: tomorrow },
      checkOut: { $exists: false }
    })
    
    if (!attendance) {
      return res.status(400).json({ message: 'No se encontró un registro de entrada para hoy' })
    }
    
    const checkOutTime = new Date()
    const duration = Math.round((checkOutTime - attendance.checkIn) / 1000 / 60) // in minutes
    
    attendance.checkOut = checkOutTime
    attendance.duration = duration
    
    await attendance.save()
    
    // Send response immediately
    res.json({
      _id: attendance._id,
      user: userId,
      checkIn: attendance.checkIn,
      checkOut: checkOutTime,
      duration: duration
    })
    
    // Populate user data in background
    process.nextTick(async () => {
      try {
        await attendance.populate('user', 'name email avatar')
      } catch (err) {
        console.error('Error populating attendance:', err)
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al registrar salida', error: error.message })
  }
})

// Get all attendance records
router.get('/attendance', async (req, res) => {
  try {
    const { userId, startDate, endDate, limit = 100 } = req.query
    
    let query = {}
    
    if (userId) {
      query.user = userId
    }
    
    if (startDate || endDate) {
      query.checkIn = {}
      if (startDate) {
        query.checkIn.$gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        query.checkIn.$lte = end
      }
    }
    
    const attendance = await Attendance.find(query)
      .populate('user', 'name email avatar')
      .sort({ checkIn: -1 })
      .limit(parseInt(limit))
    
    res.json(attendance)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener asistencias', error: error.message })
  }
})

// Get attendance statistics
router.get('/attendance/stats', async (req, res) => {
  try {
    const { period = 'month' } = req.query // 'week', 'month', 'year'
    
    let startDate = new Date()
    
    switch (period) {
      case 'week':
        startDate.setDate(startDate.getDate() - 7)
        break
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1)
        break
      case 'year':
        startDate.setFullYear(startDate.getFullYear() - 1)
        break
      default:
        startDate.setMonth(startDate.getMonth() - 1)
    }
    
    // Daily attendance
    const dailyStats = await Attendance.aggregate([
      { $match: { checkIn: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkIn' } },
          count: { $sum: 1 },
          totalDuration: { $sum: '$duration' }
        }
      },
      { $sort: { _id: 1 } }
    ])
    
    // User attendance ranking
    const userStats = await Attendance.aggregate([
      { $match: { checkIn: { $gte: startDate } } },
      {
        $group: {
          _id: '$user',
          visits: { $sum: 1 },
          totalDuration: { $sum: '$duration' }
        }
      },
      { $sort: { visits: -1 } },
      { $limit: 10 }
    ])
    
    // Populate user names
    const userIds = userStats.map(stat => stat._id)
    const users = await User.find({ _id: { $in: userIds } }).select('name email avatar')
    const userMap = new Map(users.map(u => [u._id.toString(), u]))
    
    const userStatsWithNames = userStats.map(stat => ({
      ...stat,
      user: userMap.get(stat._id.toString())
    }))
    
    // Overall stats
    const totalVisits = await Attendance.countDocuments({ checkIn: { $gte: startDate } })
    const totalUsers = await Attendance.distinct('user', { checkIn: { $gte: startDate } })
    const avgDuration = await Attendance.aggregate([
      { $match: { checkIn: { $gte: startDate }, duration: { $exists: true } } },
      { $group: { _id: null, avg: { $avg: '$duration' } } }
    ])
    
    res.json({
      period,
      startDate,
      dailyStats,
      userStats: userStatsWithNames,
      overall: {
        totalVisits,
        uniqueUsers: totalUsers.length,
        avgDuration: avgDuration[0]?.avg || 0
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message })
  }
})

// Attendance report (legacy - keep for compatibility)
router.get('/reports/attendance', async (req, res) => {
  try {
    const { startDate, endDate } = req.query
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    const attendance = await Attendance.aggregate([
      { $match: { checkIn: { $gte: start, $lte: end } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$checkIn' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ])
    res.json(attendance)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Membership report
router.get('/reports/memberships', async (req, res) => {
  try {
    const byPlan = await User.aggregate([{ $group: { _id: '$membership.plan', count: { $sum: 1 } } }])
    const byStatus = await User.aggregate([{ $group: { _id: '$membership.status', count: { $sum: 1 } } }])
    res.json({ byPlan, byStatus })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
