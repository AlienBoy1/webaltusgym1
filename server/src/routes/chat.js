import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { notifyNewMessage } from '../services/notificationService.js'
import { encodeChatContent, decodeChatContent, formatChatMessage } from '../utils/chatMessage.js'

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
      const preview = decodeChatContent(msg.content).preview
      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          otherId: partnerId,
          lastMessage: preview,
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

    // Mark inbound as delivered + read (WhatsApp style when opening chat)
    const now = new Date().toISOString()
    await supabaseAdmin
      .from('messages')
      .update({ read: true, delivered: true, delivered_at: now })
      .eq('from_user_id', otherId)
      .eq('to_user_id', myId)
      .or('read.eq.false,delivered.eq.false')

    // Also mark any of my outbound as delivered if peer previously opened? already handled when they open.

    res.json((messages || []).map((m) => {
      // Reflect read/delivered for messages we just marked
      if (m.from_user_id === otherId && m.to_user_id === myId) {
        return formatChatMessage({ ...m, read: true, delivered: true }, myId)
      }
      return formatChatMessage(m, myId)
    }))
  } catch (error) {
    // Fallback if delivered columns missing
    try {
      const myId = req.user.id
      const otherId = req.params.userId
      const { data: messages } = await supabaseAdmin
        .from('messages')
        .select('*')
        .or(
          `and(from_user_id.eq.${myId},to_user_id.eq.${otherId}),and(from_user_id.eq.${otherId},to_user_id.eq.${myId})`
        )
        .order('created_at', { ascending: true })
      await supabaseAdmin
        .from('messages')
        .update({ read: true })
        .eq('from_user_id', otherId)
        .eq('to_user_id', myId)
        .eq('read', false)
      res.json((messages || []).map((m) => formatChatMessage(m, myId)))
    } catch (err2) {
      res.status(500).json({ message: 'Error', error: error.message })
    }
  }
})

// Mark messages as delivered (recipient device ack)
router.post('/delivered/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const fromId = req.params.userId
    const now = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('messages')
      .update({ delivered: true, delivered_at: now })
      .eq('from_user_id', fromId)
      .eq('to_user_id', myId)
      .eq('delivered', false)
    if (error) throw error
    res.json({ ok: true })
  } catch (error) {
    res.json({ ok: false })
  }
})

router.post('/send', authenticate, async (req, res) => {
  try {
    const { to, content, attachment } = req.body
    const text = typeof content === 'string' ? content.trim() : ''
    if (!to || (!text && !attachment)) {
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

    const stored = encodeChatContent({ text, attachment: attachment || null })

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .insert({
        from_user_id: req.user.id,
        to_user_id: to,
        content: stored
      })
      .select('*')
      .single()

    if (error) throw error

    const decoded = decodeChatContent(message.content)

    notifyNewMessage({
      toUserId: to,
      fromUserId: req.user.id,
      fromName: req.user.name,
      content: decoded.preview
    }).catch((err) => console.error('Chat notify error:', err?.message || err))

    res.status(201).json(formatChatMessage(message, req.user.id))
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
