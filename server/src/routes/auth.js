import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import User from '../models/User.js'
import Notification from '../models/Notification.js'
import RegistrationRequest from '../models/RegistrationRequest.js'
import AccessCode from '../models/AccessCode.js'

const router = express.Router()

// Request access (new registration flow)
router.post('/request-access', async (req, res) => {
  try {
    const { email } = req.body
    
    if (!email) {
      return res.status(400).json({ message: 'El correo es requerido' })
    }
    
    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return res.status(400).json({ message: 'Este correo ya está registrado' })
    }
    
    // Check if request already exists
    const existingRequest = await RegistrationRequest.findOne({ 
      email: email.toLowerCase(),
      status: { $in: ['pending', 'approved'] }
    })
    
    if (existingRequest) {
      return res.status(400).json({ 
        message: 'Ya existe una solicitud pendiente para este correo',
        requestId: existingRequest._id
      })
    }
    
    // Create registration request
    const request = new RegistrationRequest({
      email: email.toLowerCase(),
      status: 'pending'
    })
    
    await request.save()
    
    res.status(201).json({
      message: 'Solicitud enviada exitosamente',
      requestId: request._id
    })
  } catch (error) {
    console.error('Request access error:', error)
    res.status(500).json({ message: 'Error al enviar solicitud', error: error.message })
  }
})

// Complete registration with access code
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
    
    // Find registration request
    const request = await RegistrationRequest.findOne({ 
      email: email.toLowerCase(),
      status: 'approved'
    })
    
    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada o no aprobada' })
    }
    
    // Check access code
    const code = await AccessCode.findOne({
      email: email.toLowerCase(),
      code: accessCode.toUpperCase(),
      used: false
    })
    
    if (!code) {
      request.accessCodeAttempts = (request.accessCodeAttempts || 0) + 1
      
      if (request.accessCodeAttempts >= request.maxAttempts) {
        request.status = 'rejected'
        await request.save()
        await AccessCode.deleteMany({ registrationRequest: request._id })
        return res.status(400).json({ 
          message: 'Máximo de intentos alcanzado. La solicitud ha sido cancelada.' 
        })
      }
      
      await request.save()
      return res.status(400).json({ 
        message: `Código inválido. Intentos restantes: ${request.maxAttempts - request.accessCodeAttempts}` 
      })
    }
    
    // Check if code is expired
    if (new Date() > code.expiresAt) {
      return res.status(400).json({ message: 'El código de acceso ha expirado' })
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() })
    if (existingUser) {
      return res.status(400).json({ message: 'Este correo ya está registrado' })
    }
    
    // Get user data from request (stored by admin)
    const userData = request.userData || {}
    
    // Create user
    const user = new User({
      name: userData.name || 'Usuario',
      email: email.toLowerCase(),
      password,
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
        startDate: new Date(),
        endDate: new Date(Date.now() + (userData.membershipDuration || 30) * 24 * 60 * 60 * 1000)
      },
      stats: {
        totalWorkouts: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        xp: 0
      },
      onboardingCompleted: false
    })
    
    await user.save()
    
    // Mark code as used
    code.used = true
    code.usedAt = new Date()
    code.usedBy = user._id
    await code.save()
    
    // Update request
    request.status = 'completed'
    request.completedAt = new Date()
    await request.save()
    
    // Create welcome notification
    await Notification.create({
      user: user._id,
      type: 'welcome',
      title: '¡Bienvenido a ALTUS GYM!',
      body: '¡Comienza tu viaje fitness hoy! Explora las funciones de la app.',
      icon: '🏋️',
      priority: 'high'
    })
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'altus_secret_key_2024',
      { expiresIn: '30d' }
    )
    
    res.status(201).json({
      message: 'Registro completado exitosamente',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membership: user.membership,
        stats: user.stats
      }
    })
  } catch (error) {
    console.error('Complete registration error:', error)
    res.status(500).json({ message: 'Error al completar registro', error: error.message })
  }
})

// Verify access code
router.post('/verify-code', async (req, res) => {
  try {
    const { email, accessCode } = req.body
    
    if (!email || !accessCode) {
      return res.status(400).json({ message: 'Correo y código son requeridos' })
    }
    
    const request = await RegistrationRequest.findOne({ 
      email: email.toLowerCase(),
      status: 'approved'
    })
    
    if (!request) {
      return res.status(404).json({ message: 'Solicitud no encontrada o no aprobada' })
    }
    
    const code = await AccessCode.findOne({
      email: email.toLowerCase(),
      code: accessCode.toUpperCase(),
      used: false
    })
    
    if (!code) {
      request.accessCodeAttempts = (request.accessCodeAttempts || 0) + 1
      
      if (request.accessCodeAttempts >= request.maxAttempts) {
        request.status = 'rejected'
        await request.save()
        await AccessCode.deleteMany({ registrationRequest: request._id })
        return res.status(400).json({ 
          message: 'Máximo de intentos alcanzado. La solicitud ha sido cancelada.',
          attemptsExceeded: true
        })
      }
      
      await request.save()
      return res.status(400).json({ 
        message: `Código inválido. Intentos restantes: ${request.maxAttempts - request.accessCodeAttempts}`,
        attemptsRemaining: request.maxAttempts - request.accessCodeAttempts
      })
    }
    
    if (new Date() > code.expiresAt) {
      return res.status(400).json({ message: 'El código de acceso ha expirado' })
    }
    
    res.json({ 
      message: 'Código válido',
      valid: true
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al verificar código', error: error.message })
  }
})

// Register (legacy - keep for backwards compatibility)
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body
    
    // Check if user exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(400).json({ message: 'El email ya está registrado' })
    }
    
    // Check if it's the first user (becomes admin)
    const userCount = await User.countDocuments()
    const isFirstUser = userCount === 0
    
    // Create user (password will be hashed by the model's pre-save middleware)
    const user = new User({
      name,
      email,
      password,
      role: isFirstUser ? 'admin' : 'user',
      membership: {
        plan: isFirstUser ? 'elite' : 'basic',
        status: 'active',
        startDate: new Date(),
        endDate: new Date(Date.now() + (isFirstUser ? 365 : 30) * 24 * 60 * 60 * 1000)
      },
      stats: {
        totalWorkouts: 0,
        currentStreak: 0,
        longestStreak: 0,
        level: 1,
        xp: 0
      }
    })
    
    await user.save()
    
    // Create welcome notification
    const notification = new Notification({
      user: user._id,
      type: 'welcome',
      title: isFirstUser ? '¡Bienvenido Administrador!' : '¡Bienvenido a ALTUS GYM!',
      body: isFirstUser 
        ? 'Eres el primer usuario y administrador. Tienes acceso completo al panel de administración.'
        : '¡Comienza tu viaje fitness hoy! Explora las funciones de la app.',
      icon: '🏋️',
      priority: 'high'
    })
    await notification.save()
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'altus_secret_key_2024',
      { expiresIn: '30d' }
    )
    
    res.status(201).json({
      message: 'Usuario registrado exitosamente',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membership: user.membership,
        stats: user.stats
      },
      isFirstUser
    })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ message: 'Error al registrar usuario', error: error.message })
  }
})

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body
    
    console.log('Login attempt:', email)
    
    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      console.log('User not found:', email)
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }
    
    console.log('User found:', user.email, 'Has password:', !!user.password)
    
    // Check password
    const isMatch = await bcrypt.compare(password, user.password)
    console.log('Password match:', isMatch)
    
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' })
    }
    
    // Update last login
    user.lastLogin = new Date()
    await user.save()
    
    // Generate token
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET || 'altus_secret_key_2024',
      { expiresIn: '30d' }
    )
    
    res.json({
      message: 'Login exitoso',
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        membership: user.membership,
        stats: user.stats
      }
    })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ message: 'Error al iniciar sesión', error: error.message })
  }
})

// Get current user
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '')
    
    if (!token) {
      return res.status(401).json({ message: 'No autorizado' })
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'altus_secret_key_2024')
    const user = await User.findById(decoded.userId).select('-password')
    
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    
    res.json({ user })
  } catch (error) {
    res.status(401).json({ message: 'Token inválido' })
  }
})

export default router
