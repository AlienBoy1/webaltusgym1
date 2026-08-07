import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapNotification } from '../lib/mappers.js'
import { authenticate, isAdmin } from '../middleware/auth.js'
import { VAPID_PUBLIC_KEY } from '../services/pushService.js'
import { notifyUser, notifyMany } from '../services/notificationService.js'

const router = express.Router()

router.get('/vapid-public-key', authenticate, (_req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY })
})

router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { subscription } = req.body
    if (!subscription?.endpoint || !subscription?.keys) {
      return res.status(400).json({ message: 'Suscripción inválida' })
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('settings')
      .eq('id', req.user.id)
      .single()

    const settings = profile?.settings || {}
    const notifications = { ...(settings.notifications || {}), push: true }

    const { error } = await supabaseAdmin
      .from('profiles')
      .update({
        push_subscription: subscription,
        settings: { ...settings, notifications }
      })
      .eq('id', req.user.id)

    if (error) throw error
    res.json({ message: 'Suscripción guardada', pushEnabled: true })
  } catch (error) {
    res.status(500).json({ message: 'Error al guardar suscripción', error: error.message })
  }
})

router.delete('/subscribe', authenticate, async (req, res) => {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('settings')
      .eq('id', req.user.id)
      .single()

    const settings = profile?.settings || {}
    const notifications = { ...(settings.notifications || {}), push: false }

    await supabaseAdmin
      .from('profiles')
      .update({
        push_subscription: null,
        settings: { ...settings, notifications }
      })
      .eq('id', req.user.id)

    res.json({ message: 'Suscripción eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar suscripción', error: error.message })
  }
})

router.get('/', authenticate, async (req, res) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('id, user_id, type, title, body, icon, priority, related_user_id, related_id, read, created_at')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const { count } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('read', false)

    res.json({
      notifications: (notifications || []).map(mapNotification),
      unreadCount: count || 0
    })
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener notificaciones', error: error.message })
  }
})

/** Lightweight badge for MainLayout — no full list. */
router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', req.user.id)
      .eq('read', false)
    if (error) throw error
    res.setHeader('Cache-Control', 'private, max-age=15')
    res.json({ unreadCount: count || 0 })
  } catch (error) {
    res.status(500).json({ message: 'Error al contar notificaciones', error: error.message })
  }
})

router.put('/read-all', authenticate, async (req, res) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('user_id', req.user.id)
      .eq('read', false)
    res.json({ message: 'Todas las notificaciones marcadas como leídas' })
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar como leídas', error: error.message })
  }
})

router.delete('/clear/read', authenticate, async (req, res) => {
  try {
    await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('user_id', req.user.id)
      .eq('read', true)
    res.json({ message: 'Notificaciones leídas eliminadas' })
  } catch (error) {
    res.status(500).json({ message: 'Error al limpiar', error: error.message })
  }
})

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({ read: true })
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('*')
      .single()

    if (error || !data) return res.status(404).json({ message: 'Notificación no encontrada' })
    res.json(mapNotification(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al marcar como leída', error: error.message })
  }
})

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { data: existing, error: fetchError } = await supabaseAdmin
      .from('notifications')
      .select('id, read')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .maybeSingle()

    if (fetchError || !existing) return res.status(404).json({ message: 'Notificación no encontrada' })
    if (!existing.read) {
      return res.status(403).json({ message: 'Solo puedes eliminar notificaciones leídas. Márcala como leída primero.' })
    }

    const { data, error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .eq('read', true)
      .select('id')
      .maybeSingle()

    if (error || !data) return res.status(404).json({ message: 'Notificación no encontrada' })
    res.json({ message: 'Notificación eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar', error: error.message })
  }
})

router.post('/send', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId, title, body, type = 'general' } = req.body
    const mapped = await notifyUser({
      userId,
      type,
      title,
      body,
      icon: '📢',
      priority: 'high'
    })
    res.status(201).json(mapped)
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar notificación', error: error.message })
  }
})

router.post('/broadcast', authenticate, isAdmin, async (req, res) => {
  try {
    const { title, body, type = 'admin' } = req.body
    const { data: users } = await supabaseAdmin.from('profiles').select('id')
    const ids = (users || []).map((u) => u.id)
    await notifyMany(ids, { type, title, body, icon: '📢', priority: 'high' })
    res.json({ message: `Notificación enviada a ${ids.length} usuarios` })
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar broadcast', error: error.message })
  }
})

export default router
