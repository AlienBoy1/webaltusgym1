import express from 'express'
import Notification from '../models/Notification.js'
import { authenticate, isAdmin } from '../middleware/auth.js'

const router = express.Router()

// Get user notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
    
    const unreadCount = await Notification.countDocuments({ user: req.user._id, read: false })
    
    res.json({ notifications, unreadCount })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener notificaciones', error: error.message })
  }
})

// Mark as read
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { read: true },
      { new: true }
    )
    
    if (!notification) {
      return res.status(404).json({ message: 'Notificación no encontrada' })
    }
    
    res.json(notification)
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar como leída', error: error.message })
  }
})

// Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.updateMany(
      { user: req.user._id, read: false },
      { read: true }
    )
    
    res.json({ message: 'Todas las notificaciones marcadas como leídas' })
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar como leídas', error: error.message })
  }
})

// Delete notification
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    })
    
    if (!notification) {
      return res.status(404).json({ message: 'Notificación no encontrada' })
    }
    
    res.json({ message: 'Notificación eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar', error: error.message })
  }
})

// Clear read notifications
router.delete('/clear/read', authenticate, async (req, res) => {
  try {
    await Notification.deleteMany({ user: req.user._id, read: true })
    res.json({ message: 'Notificaciones leídas eliminadas' })
  } catch (error) {
    res.status(500).json({ message: 'Error al limpiar', error: error.message })
  }
})

// Send notification to user (admin)
router.post('/send', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId, title, body, type = 'general' } = req.body
    
    const notification = new Notification({
      user: userId,
      title,
      body,
      type,
      icon: '📢'
    })
    
    await notification.save()
    res.status(201).json(notification)
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar notificación', error: error.message })
  }
})

// Broadcast to all users (admin)
router.post('/broadcast', authenticate, isAdmin, async (req, res) => {
  try {
    const { title, body, type = 'admin' } = req.body
    const User = (await import('../models/User.js')).default
    
    const users = await User.find({}, '_id')
    
    const notifications = users.map(user => ({
      user: user._id,
      title,
      body,
      type,
      icon: '📢',
      priority: 'high'
    }))
    
    await Notification.insertMany(notifications)
    
    res.json({ message: `Notificación enviada a ${users.length} usuarios` })
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar broadcast', error: error.message })
  }
})

export default router
