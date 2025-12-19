import express from 'express'
import User from '../models/User.js'
import { authenticate, isAdmin } from '../middleware/auth.js'

const router = express.Router()

const plans = {
  basic: { name: 'Básico', price: 29, duration: 1 },
  premium: { name: 'Premium', price: 49, duration: 1 },
  elite: { name: 'Elite', price: 89, duration: 1 },
  annual: { name: 'Anual', price: 399, duration: 12 }
}

// Get membership info
router.get('/current', authenticate, async (req, res) => {
  try {
    const { membership } = req.user
    const plan = plans[membership.plan]
    
    res.json({
      ...membership.toObject(),
      planName: plan?.name,
      planPrice: plan?.price
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresía', error: error.message })
  }
})

// Get available plans
router.get('/plans', (req, res) => {
  res.json(Object.entries(plans).map(([key, value]) => ({
    id: key,
    ...value
  })))
})

// Upgrade/renew membership
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const { planId } = req.body
    const plan = plans[planId]
    
    if (!plan) {
      return res.status(400).json({ message: 'Plan no válido' })
    }
    
    const startDate = new Date()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + plan.duration)
    
    req.user.membership = {
      plan: planId,
      startDate,
      endDate,
      status: 'active'
    }
    
    await req.user.save()
    
    res.json({ 
      message: 'Membresía actualizada', 
      membership: req.user.membership 
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar membresía', error: error.message })
  }
})

// Admin: Get all memberships
router.get('/all', authenticate, isAdmin, async (req, res) => {
  try {
    const { status, plan } = req.query
    const filter = {}
    
    if (status) filter['membership.status'] = status
    if (plan) filter['membership.plan'] = plan
    
    const users = await User.find(filter).select('name email membership createdAt')
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresías', error: error.message })
  }
})

// Admin: Update user membership
router.put('/:userId', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params
    const { plan, endDate, status } = req.body
    
    const user = await User.findById(userId)
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }
    
    if (plan) user.membership.plan = plan
    if (endDate) user.membership.endDate = new Date(endDate)
    if (status) user.membership.status = status
    
    await user.save()
    
    res.json({ message: 'Membresía actualizada', user })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar membresía', error: error.message })
  }
})

export default router

