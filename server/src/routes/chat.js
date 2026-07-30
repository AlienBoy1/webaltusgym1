import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { notifyUser, notifyNewMessage } from '../services/notificationService.js'

const router = express.Router()

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })

    if (error) throw error

    const conversationMap = new Map()
    for (const msg of messages || []) {
      const partnerId = msg.from_user_id === userId ? msg.to_user_id : msg.from_user_id
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          otherId: partnerId,
          lastMessage: msg.content,
          lastMessageTime: msg.created_at,
          unread: msg.to_user_id === userId && !msg.read ? 1 : 0
        })
      } else if (msg.to_user_id === userId && !msg.read) {
        conversationMap.get(partnerId).unread++
      }
    }

    const conversations = []
    for (const [otherId, conv] of conversationMap) {
      const { data: user } = await supabaseAdmin
        .from('profiles')
        .select('name, avatar')
        .eq('id', otherId)
        .single()
      if (user) {
        conversations.push({
          id: otherId,
          otherId,
          name: user.name,
          avatar: user.avatar || user.name?.charAt(0) || '👤',
          lastMessage: conv.lastMessage,
          time: conv.lastMessageTime,
          unread: conv.unread
        })
      }
    }

    res.json(conversations)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.get('/messages/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const otherId = req.params.userId

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .or(
        `and(from_user_id.eq.${myId},to_user_id.eq.${otherId}),and(from_user_id.eq.${otherId},to_user_id.eq.${myId})`
      )
      .order('created_at', { ascending: true })

    if (error) throw error

    await supabaseAdmin
      .from('messages')
      .update({ read: true })
      .eq('from_user_id', otherId)
      .eq('to_user_id', myId)
      .eq('read', false)

    const formatted = (messages || []).map((m) => ({
      id: m.id,
      sender: m.from_user_id === myId ? 'me' : 'other',
      text: m.content,
      time: new Date(m.created_at).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    }))

    res.json(formatted)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.post('/send', authenticate, async (req, res) => {
  try {
    const { to, content } = req.body
    if (!to || !content?.trim()) {
      return res.status(400).json({ message: 'Destinatario y contenido requeridos' })
    }

    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('profiles')
      .select('id, settings')
      .eq('id', to)
      .single()

    if (recipientError || !recipient) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    const allowMessages = recipient.settings?.privacy?.allowMessages
    if (allowMessages === false) {
      return res.status(403).json({ message: 'Este usuario no acepta mensajes' })
    }

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        from_user_id: req.user.id,
        to_user_id: to,
        content: content.trim()
      })
      .select('*')
      .single()

    if (error) throw error

    // Push + inbox for recipient (non-blocking)
    notifyNewMessage({
      toUserId: to,
      fromUserId: req.user.id,
      fromName: req.user.name,
      content: message.content
    }).catch((err) => console.error('Chat notify error:', err?.message || err))

    res.status(201).json({
      id: message.id,
      sender: 'me',
      text: message.content,
      time: new Date(message.created_at).toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit'
      })
    })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
