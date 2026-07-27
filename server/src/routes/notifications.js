import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { mapNotification } from '../lib/mappers.js'
import { authenticate, isAdmin } from '../middleware/auth.js'

const router = express.Router()

router.get('/', authenticate, async (req, res) => {
  try {
    const { data: notifications, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) throw error

    const { count } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
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

router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .select('id')
      .maybeSingle()

    if (error || !data) return res.status(404).json({ message: 'Notificación no encontrada' })
    res.json({ message: 'Notificación eliminada' })
  } catch (error) {
    res.status(500).json({ message: 'Error al eliminar', error: error.message })
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

router.post('/send', authenticate, isAdmin, async (req, res) => {
  try {
    const { userId, title, body, type = 'general' } = req.body
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .insert({ user_id: userId, title, body, type, icon: '📢' })
      .select('*')
      .single()
    if (error) throw error
    res.status(201).json(mapNotification(data))
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar notificación', error: error.message })
  }
})

router.post('/broadcast', authenticate, isAdmin, async (req, res) => {
  try {
    const { title, body, type = 'admin' } = req.body
    const { data: users } = await supabaseAdmin.from('profiles').select('id')
    const rows = (users || []).map((u) => ({
      user_id: u.id,
      title,
      body,
      type,
      icon: '📢',
      priority: 'high'
    }))
    if (rows.length) {
      const { error } = await supabaseAdmin.from('notifications').insert(rows)
      if (error) throw error
    }
    res.json({ message: `Notificación enviada a ${rows.length} usuarios` })
  } catch (error) {
    res.status(500).json({ message: 'Error al enviar broadcast', error: error.message })
  }
})

export default router
