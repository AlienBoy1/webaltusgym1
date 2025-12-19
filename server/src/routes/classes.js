import express from 'express'
import Class from '../models/Class.js'
import Notification from '../models/Notification.js'
import { authenticate, isAdmin, isTrainerOrAdmin } from '../middleware/auth.js'

const router = express.Router()

// Get all classes
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, type, instructor } = req.query
    const filter = { cancelled: false }
    
    if (type) filter.type = type
    if (instructor) filter.instructor = instructor
    
    const classes = await Class.find(filter)
      .populate('instructor', 'name avatar')
      .populate('enrolled.user', 'name avatar')
      .sort({ 'schedule.dayOfWeek': 1, 'schedule.startTime': 1 })
    
    res.json(classes)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clases', error: error.message })
  }
})

// Get single class
router.get('/:id', authenticate, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id)
      .populate('instructor', 'name avatar email')
      .populate('enrolled.user', 'name avatar')
      .populate('waitlist.user', 'name avatar')
    
    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }
    
    res.json(classItem)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener clase', error: error.message })
  }
})

// Create class (admin/trainer only)
router.post('/', authenticate, isTrainerOrAdmin, async (req, res) => {
  try {
    const classItem = new Class({
      ...req.body,
      instructor: req.body.instructor || req.user._id
    })
    
    await classItem.save()
    await classItem.populate('instructor', 'name avatar')
    
    res.status(201).json(classItem)
  } catch (error) {
    res.status(500).json({ message: 'Error al crear clase', error: error.message })
  }
})

// Update class
router.put('/:id', authenticate, isTrainerOrAdmin, async (req, res) => {
  try {
    const classItem = await Class.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    ).populate('instructor', 'name avatar')
    
    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }
    
    res.json(classItem)
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar clase', error: error.message })
  }
})

// Enroll in class
router.post('/:id/enroll', authenticate, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id)
    
    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }
    
    // Check if already enrolled
    const isEnrolled = classItem.enrolled.some(
      e => e.user.toString() === req.user._id.toString()
    )
    
    if (isEnrolled) {
      return res.status(400).json({ message: 'Ya estás inscrito en esta clase' })
    }
    
    // Check capacity
    if (classItem.enrolled.length >= classItem.maxCapacity) {
      // Add to waitlist
      classItem.waitlist.push({ user: req.user._id })
      await classItem.save()
      
      return res.json({ 
        message: 'Clase llena. Te agregamos a la lista de espera',
        waitlistPosition: classItem.waitlist.length
      })
    }
    
    classItem.enrolled.push({ user: req.user._id })
    await classItem.save()
    await classItem.populate('enrolled.user', 'name avatar')
    
    // Create notification
    await Notification.create({
      user: req.user._id,
      type: 'class_reminder',
      title: '¡Inscripción confirmada!',
      body: `Te has inscrito en ${classItem.name}`,
      icon: '📅'
    })
    
    res.json({ message: 'Inscripción exitosa', classItem })
  } catch (error) {
    res.status(500).json({ message: 'Error al inscribirse', error: error.message })
  }
})

// Cancel enrollment
router.delete('/:id/enroll', authenticate, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id)
    
    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }
    
    // Remove from enrolled
    classItem.enrolled = classItem.enrolled.filter(
      e => e.user && e.user.toString() !== req.user._id.toString()
    )
    
    // Remove from waitlist
    classItem.waitlist = classItem.waitlist.filter(
      e => e.user && e.user.toString() !== req.user._id.toString()
    )
    
    // Move first from waitlist to enrolled if there's space
    if (classItem.waitlist.length > 0 && classItem.enrolled.length < classItem.maxCapacity) {
      const nextUser = classItem.waitlist.shift()
      if (nextUser && nextUser.user) {
        classItem.enrolled.push({ user: nextUser.user })
        
        // Notify user from waitlist
        await Notification.create({
          user: nextUser.user,
          type: 'class_reminder',
          title: '¡Tienes un lugar!',
          body: `Se liberó un espacio en ${classItem.name}. Ya estás inscrito.`,
          icon: '🎉',
          priority: 'high'
        })
      }
    }
    
    await classItem.save()
    await classItem.populate('enrolled.user', 'name avatar')
    
    res.json({ message: 'Inscripción cancelada', classItem })
  } catch (error) {
    res.status(500).json({ message: 'Error al cancelar inscripción', error: error.message })
  }
})

// Cancel class (admin/trainer)
router.post('/:id/cancel', authenticate, isTrainerOrAdmin, async (req, res) => {
  try {
    const { reason } = req.body
    
    const classItem = await Class.findById(req.params.id)
    
    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }
    
    classItem.cancelled = true
    classItem.cancelReason = reason
    await classItem.save()
    
    // Notify all enrolled users
    for (const enrollment of classItem.enrolled) {
      await Notification.create({
        user: enrollment.user,
        type: 'class_cancelled',
        title: 'Clase cancelada',
        body: `La clase ${classItem.name} ha sido cancelada. ${reason || ''}`,
        icon: '❌',
        priority: 'high'
      })
    }
    
    res.json({ message: 'Clase cancelada y usuarios notificados' })
  } catch (error) {
    res.status(500).json({ message: 'Error al cancelar clase', error: error.message })
  }
})

// Mark class as completed (for enrolled users)
router.post('/:id/complete', authenticate, async (req, res) => {
  try {
    const classItem = await Class.findById(req.params.id)
    
    if (!classItem) {
      return res.status(404).json({ message: 'Clase no encontrada' })
    }
    
    // Check if user is enrolled
    const enrollment = classItem.enrolled.find(
      e => e.user.toString() === req.user._id.toString()
    )
    
    if (!enrollment) {
      return res.status(400).json({ message: 'No estás inscrito en esta clase' })
    }
    
    // Check if already completed today
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    
    if (enrollment.completedAt && new Date(enrollment.completedAt) >= today && new Date(enrollment.completedAt) < tomorrow) {
      return res.status(400).json({ message: 'Ya completaste esta clase hoy' })
    }
    
    // Mark as completed
    enrollment.completedAt = new Date()
    await classItem.save()
    
    // Update user stats
    const user = await User.findById(req.user._id)
    user.stats = user.stats || {}
    user.stats.classesCompleted = (user.stats.classesCompleted || 0) + 1
    await user.save()
    
    // Award XP using xpService (30 XP per class)
    const { awardXP, checkBadgeUnlocks } = await import('../services/xpService.js')
    let xpResult = null
    let unlockedBadges = []
    
    try {
      xpResult = await awardXP(req.user._id, 30, `Completaste la clase: ${classItem.name}`, false)
      unlockedBadges = await checkBadgeUnlocks(req.user._id, false)
    } catch (xpError) {
      console.error('Error awarding XP:', xpError)
    }
    
    // Refresh user to get updated stats
    const updatedUser = await User.findById(req.user._id)
    
    res.json({
      message: '¡Clase completada!',
      xpAwarded: 30,
      leveledUp: xpResult?.leveledUp || false,
      unlockedBadges: unlockedBadges.map(b => ({ id: b.id, name: b.name, icon: b.icon })),
      stats: updatedUser.stats
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al completar clase', error: error.message })
  }
})

// Delete class
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await Class.findByIdAndDelete(req.params.id)
    res.json({ message: 'Clase eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar clase', error: error.message })
  }
})

export default router

