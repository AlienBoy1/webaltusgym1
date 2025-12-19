import express from 'express'
import Workout from '../models/Workout.js'
import User from '../models/User.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

// Default workout templates
const defaultTemplates = [
  {
    id: 1,
    name: 'Pecho y Tríceps',
    exercises: [
      { name: 'Press Banca', sets: 4, reps: 10 },
      { name: 'Press Inclinado', sets: 3, reps: 12 },
      { name: 'Aperturas', sets: 3, reps: 15 },
      { name: 'Fondos', sets: 3, reps: 12 },
      { name: 'Extensiones Tríceps', sets: 3, reps: 15 },
    ]
  },
  {
    id: 2,
    name: 'Espalda y Bíceps',
    exercises: [
      { name: 'Dominadas', sets: 4, reps: 8 },
      { name: 'Remo con Barra', sets: 4, reps: 10 },
      { name: 'Jalón al Pecho', sets: 3, reps: 12 },
      { name: 'Curl con Barra', sets: 3, reps: 12 },
      { name: 'Curl Martillo', sets: 3, reps: 12 },
    ]
  },
  {
    id: 3,
    name: 'Piernas',
    exercises: [
      { name: 'Sentadillas', sets: 4, reps: 10 },
      { name: 'Prensa', sets: 4, reps: 12 },
      { name: 'Peso Muerto Rumano', sets: 3, reps: 10 },
      { name: 'Extensiones', sets: 3, reps: 15 },
      { name: 'Curl Femoral', sets: 3, reps: 12 },
    ]
  },
  {
    id: 4,
    name: 'Hombros y Core',
    exercises: [
      { name: 'Press Militar', sets: 4, reps: 10 },
      { name: 'Elevaciones Laterales', sets: 3, reps: 15 },
      { name: 'Pájaros', sets: 3, reps: 15 },
      { name: 'Plancha', sets: 3, reps: '60s' },
      { name: 'Crunch', sets: 3, reps: 20 },
    ]
  }
]

// Get templates
router.get('/templates/all', authenticate, async (req, res) => {
  try {
    // Return default templates for now
    res.json(defaultTemplates)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener rutinas', error: error.message })
  }
})

// Get user workouts history
router.get('/history', authenticate, async (req, res) => {
  try {
    const workouts = await Workout.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
    
    res.json(workouts)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener historial', error: error.message })
  }
})

// Log workout
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, exercises, duration, notes } = req.body
    
    const workout = new Workout({
      user: req.user._id,
      name,
      exercises,
      duration,
      notes,
      completedAt: new Date()
    })
    
    await workout.save()
    
    // Update user stats using xpService
    const user = await User.findById(req.user._id)
    
    // Update total workouts
    user.stats = user.stats || {}
    user.stats.totalWorkouts = (user.stats.totalWorkouts || 0) + 1
    
    // Update streak
    const lastWorkout = await Workout.findOne({ 
      user: req.user._id,
      _id: { $ne: workout._id }
    }).sort({ createdAt: -1 })
    
    const now = new Date()
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    
    if (!lastWorkout || new Date(lastWorkout.createdAt) >= yesterday) {
      user.stats.currentStreak = (user.stats.currentStreak || 0) + 1
      if (user.stats.currentStreak > (user.stats.longestStreak || 0)) {
        user.stats.longestStreak = user.stats.currentStreak
      }
    } else {
      user.stats.currentStreak = 1
    }
    
    await user.save()
    
    // Award XP using xpService (50 XP per workout)
    const { awardXP, checkBadgeUnlocks } = await import('../services/xpService.js')
    let xpResult = null
    let unlockedBadges = []
    
    try {
      xpResult = await awardXP(req.user._id, 50, `Completaste el entrenamiento: ${name}`, false)
      
      // Check for badge unlocks after XP is awarded
      unlockedBadges = await checkBadgeUnlocks(req.user._id, false)
    } catch (xpError) {
      console.error('Error awarding XP:', xpError)
    }
    
    // Refresh user to get updated stats
    const updatedUser = await User.findById(req.user._id)
    
    res.status(201).json({ 
      workout, 
      stats: updatedUser.stats,
      xpAwarded: 50,
      leveledUp: xpResult?.leveledUp || false,
      unlockedBadges: unlockedBadges.map(b => ({ id: b.id, name: b.name, icon: b.icon })),
      message: '¡Entrenamiento registrado!' 
    })
  } catch (error) {
    console.error('Workout error:', error)
    res.status(500).json({ message: 'Error al registrar entrenamiento', error: error.message })
  }
})

// Get single workout
router.get('/:id', authenticate, async (req, res) => {
  try {
    const workout = await Workout.findOne({ _id: req.params.id, user: req.user._id })
    
    if (!workout) {
      return res.status(404).json({ message: 'Entrenamiento no encontrado' })
    }
    
    res.json(workout)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

// Delete workout
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const workout = await Workout.findOneAndDelete({ _id: req.params.id, user: req.user._id })
    
    if (!workout) {
      return res.status(404).json({ message: 'Entrenamiento no encontrado' })
    }
    
    res.json({ message: 'Entrenamiento eliminado' })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
