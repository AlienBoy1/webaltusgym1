import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapProfile } from '../lib/mappers.js'
import { authenticate, isAdmin } from '../middleware/auth.js'

const router = express.Router()

const fallbackPlans = {
  basic: { name: 'Básico', price: 29, duration: 1 },
  premium: { name: 'Premium', price: 49, duration: 1 },
  elite: { name: 'Elite', price: 89, duration: 1 },
  annual: { name: 'Anual', price: 399, duration: 12 }
}

async function getPlansMap() {
  const { data } = await supabaseAdmin
    .from('membership_plans')
    .select('*')
    .eq('active', true)

  if (data?.length) {
    return Object.fromEntries(
      data.map((p) => [
        p.plan,
        {
          name: p.name,
          price: Number(p.price) || 0,
          duration: p.duration >= 28 ? Math.round(p.duration / 30) || 1 : p.duration || 1
        }
      ])
    )
  }
  return fallbackPlans
}

// Get membership info
router.get('/current', authenticate, async (req, res) => {
  try {
    const membership = req.user.membership || {}
    const plans = await getPlansMap()
    const plan = plans[membership.plan]

    res.json({
      ...membership,
      planName: plan?.name,
      planPrice: plan?.price
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresía', error: error.message })
  }
})

// Get available plans
router.get('/plans', async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('membership_plans')
      .select('*')
      .eq('active', true)
      .order('price', { ascending: true })

    if (error) throw error

    if (data?.length) {
      return res.json(
        data.map((p) => ({
          id: p.plan,
          _id: p.id,
          name: p.name,
          price: Number(p.price) || 0,
          duration: p.duration >= 28 ? Math.round(p.duration / 30) || 1 : p.duration || 1
        }))
      )
    }

    res.json(
      Object.entries(fallbackPlans).map(([key, value]) => ({
        id: key,
        ...value
      }))
    )
  } catch (error) {
    res.json(
      Object.entries(fallbackPlans).map(([key, value]) => ({
        id: key,
        ...value
      }))
    )
  }
})

// Upgrade/renew membership
router.post('/upgrade', authenticate, async (req, res) => {
  try {
    const { planId } = req.body
    const plans = await getPlansMap()
    const plan = plans[planId]

    if (!plan) {
      return res.status(400).json({ message: 'Plan no válido' })
    }

    const startDate = new Date().toISOString()
    const endDate = new Date()
    endDate.setMonth(endDate.getMonth() + plan.duration)

    const membership = {
      plan: planId,
      startDate,
      endDate: endDate.toISOString(),
      status: 'active'
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ membership, updated_at: new Date().toISOString() })
      .eq('id', req.user.id)
      .select('*')
      .single()

    if (error) throw error

    res.json({
      message: 'Membresía actualizada',
      membership: data.membership
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar membresía', error: error.message })
  }
})

// Admin: Get all memberships
router.get('/all', authenticate, isAdmin, async (req, res) => {
  try {
    const { status, plan } = req.query

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, membership, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    let users = data || []
    if (status) users = users.filter((u) => u.membership?.status === status)
    if (plan) users = users.filter((u) => u.membership?.plan === plan)

    res.json(
      users.map((u) => ({
        _id: u.id,
        id: u.id,
        name: u.name,
        email: u.email,
        membership: u.membership,
        createdAt: u.created_at
      }))
    )
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener membresías', error: error.message })
  }
})

// Admin: Update user membership
router.put('/:userId', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId } = req.params
    const { plan, endDate, status } = req.body

    const { data: current } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (!current) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    const membership = {
      ...(current.membership || {}),
      ...(plan ? { plan } : {}),
      ...(endDate ? { endDate: new Date(endDate).toISOString() } : {}),
      ...(status ? { status } : {})
    }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ membership, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .single()

    if (error) throw error

    res.json({ message: 'Membresía actualizada', user: mapProfile(data) })
  } catch (error) {
    res.status(500).json({ message: 'Error al actualizar membresía', error: error.message })
  }
})

export default router
