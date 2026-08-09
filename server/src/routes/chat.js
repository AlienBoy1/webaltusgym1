import express from 'express'
import { supabaseAdmin } from '../lib/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { notifyNewMessage } from '../services/notificationService.js'
import { encodeChatContent, decodeChatContent, formatChatMessage, scrubViewOnceAttachment, DELETE_FOR_EVERYONE_MS } from '../utils/chatMessage.js'
import { broadcastChatReceipt } from '../utils/broadcastReceipt.js'
import {
  isQiSiProfile,
  QISI_MESSAGING_CODE,
  QISI_MESSAGING_COPY
} from '../utils/qisi.js'

/** Mark peer→me messages as delivered/read. Falls back if `delivered` column missing. */
async function markInboundReceipts({ fromId, myId, mode }) {
  const now = new Date().toISOString()
  if (mode === 'delivered') {
    const full = await supabaseAdmin
      .from('messages')
      .update({ delivered: true, delivered_at: now })
      .eq('from_user_id', fromId)
      .eq('to_user_id', myId)
      .eq('delivered', false)
      .select('id')
    if (!full.error) {
      return { messageIds: (full.data || []).map((r) => r.id), delivered: true, read: false }
    }
    // Column missing / schema lag — cannot express "delivered" without column
    console.error('markInboundReceipts delivered:', full.error.message)
    return { messageIds: [], delivered: false, read: false, error: full.error.message }
  }

  // read (+ delivered)
  const full = await supabaseAdmin
    .from('messages')
    .update({ read: true, delivered: true, delivered_at: now })
    .eq('from_user_id', fromId)
    .eq('to_user_id', myId)
    .or('read.eq.false,delivered.eq.false')
    .select('id')
  if (!full.error) {
    return { messageIds: (full.data || []).map((r) => r.id), delivered: true, read: true }
  }

  // Fallback: only `read` column (legacy schema)
  const legacy = await supabaseAdmin
    .from('messages')
    .update({ read: true })
    .eq('from_user_id', fromId)
    .eq('to_user_id', myId)
    .eq('read', false)
    .select('id')
  if (legacy.error) {
    console.error('markInboundReceipts read:', full.error.message, legacy.error.message)
    return { messageIds: [], delivered: false, read: false, error: legacy.error.message }
  }
  return {
    messageIds: (legacy.data || []).map((r) => r.id),
    delivered: true,
    read: true,
    legacy: true
  }
}

const router = express.Router()

const SHARED_ATTACHMENT_TYPES = new Set(['image', 'file', 'post'])
const URL_IN_TEXT_RE = /https?:\/\/[^\s<>"'{}|\\^`[\]]+/i

function extractFirstUrl(text) {
  if (!text || typeof text !== 'string') return null
  const m = text.match(URL_IN_TEXT_RE)
  return m ? m[0] : null
}

async function getChatClearsMap(userId) {
  const { data } = await supabaseAdmin
    .from('chat_clears')
    .select('peer_id, cleared_at')
    .eq('user_id', userId)
  return Object.fromEntries((data || []).map((row) => [row.peer_id, row.cleared_at]))
}

async function getChatClear(userId, peerId) {
  const { data } = await supabaseAdmin
    .from('chat_clears')
    .select('cleared_at')
    .eq('user_id', userId)
    .eq('peer_id', peerId)
    .maybeSingle()
  return data?.cleared_at || null
}

function isAfterClear(message, clearedAt) {
  if (!clearedAt) return true
  return new Date(message.created_at) > new Date(clearedAt)
}

function normalizeRoutineDays(days) {
  if (!Array.isArray(days)) return []
  return [...new Set(days.map((d) => Number(d)).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
}

router.get('/conversations', authenticate, async (req, res) => {
  try {
    const userId = req.user.id
    const clearsMap = await getChatClearsMap(userId)
    // Cap scan — enough for inbox preview without loading full history
    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('id, from_user_id, to_user_id, content, created_at, read, delivered')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error

    const conversationMap = new Map()
    for (const msg of messages || []) {
      const partnerId = msg.from_user_id === userId ? msg.to_user_id : msg.from_user_id
      const clearedAt = clearsMap[partnerId]
      if (!isAfterClear(msg, clearedAt)) continue

      const preview = decodeChatContent(msg.content).preview
      const isInboundUnread =
        msg.to_user_id === userId && msg.from_user_id !== userId && msg.read !== true
      const lastFromMe = String(msg.from_user_id) === String(userId)
      const lastReceipt = lastFromMe
        ? msg.read
          ? { status: 'read', delivered: true, read: true }
          : msg.delivered
            ? { status: 'delivered', delivered: true, read: false }
            : { status: 'sent', delivered: false, read: false }
        : { status: null, delivered: false, read: false }

      if (!conversationMap.has(partnerId)) {
        conversationMap.set(partnerId, {
          otherId: partnerId,
          lastMessage: preview,
          lastMessageTime: msg.created_at,
          lastFromMe,
          unread: isInboundUnread ? 1 : 0,
          ...lastReceipt
        })
      } else if (isInboundUnread) {
        conversationMap.get(partnerId).unread++
      }
    }

    const partnerIds = [...conversationMap.keys()]
    if (!partnerIds.length) return res.json([])

    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, name, username, avatar')
      .in('id', partnerIds)

    const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p]))
    const conversations = partnerIds
      .map((otherId) => {
        const user = profileMap[otherId]
        const conv = conversationMap.get(otherId)
        if (!user || !conv) return null
        return {
          id: otherId,
          otherId,
          name: user.name,
          username: user.username || null,
          avatar: user.avatar || null,
          lastMessage: conv.lastMessage,
          time: conv.lastMessageTime,
          lastFromMe: Boolean(conv.lastFromMe),
          unread: Number(conv.unread) || 0,
          status: conv.status || null,
          delivered: Boolean(conv.delivered),
          read: Boolean(conv.read)
        }
      })
      .filter(Boolean)

    res.setHeader('Cache-Control', 'private, max-age=10')
    res.json(conversations)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.get('/messages/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const otherId = req.params.userId

    const { data: peer } = await supabaseAdmin
      .from('profiles')
      .select('id, username, settings, profile')
      .eq('id', otherId)
      .maybeSingle()

    if (peer && isQiSiProfile(peer)) {
      return res.status(403).json({
        message: QISI_MESSAGING_COPY,
        code: QISI_MESSAGING_CODE
      })
    }

    const shouldMarkRead = !['0', 'false', 'no'].includes(
      String(req.query.markRead || '1').toLowerCase()
    )

    let clearedAt = null
    try {
      clearedAt = await getChatClear(myId, otherId)
    } catch (clearErr) {
      console.warn('getChatClear:', clearErr?.message || clearErr)
    }

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .or(
        `and(from_user_id.eq.${myId},to_user_id.eq.${otherId}),and(from_user_id.eq.${otherId},to_user_id.eq.${myId})`
      )
      .order('created_at', { ascending: true })
      .limit(300)

    if (error) throw error

    const visible = (messages || []).filter((m) => {
      if (!isAfterClear(m, clearedAt)) return false
      const hidden = Array.isArray(m.hidden_for) ? m.hidden_for.map(String) : []
      return !hidden.includes(String(myId))
    })

    if (shouldMarkRead) {
      try {
        const marked = await markInboundReceipts({ fromId: otherId, myId, mode: 'read' })
        broadcastChatReceipt(otherId, {
          from: myId,
          delivered: true,
          read: true,
          messageIds: marked.messageIds || []
        }).catch(() => {})
      } catch (markErr) {
        console.warn('GET /messages markRead:', markErr?.message || markErr)
      }
    }

    const payload = visible.map((m) => {
      try {
        if (
          shouldMarkRead &&
          String(m.from_user_id) === String(otherId) &&
          String(m.to_user_id) === String(myId)
        ) {
          return formatChatMessage({ ...m, read: true, delivered: true }, myId)
        }
        return formatChatMessage(m, myId)
      } catch (fmtErr) {
        console.warn('formatChatMessage:', fmtErr?.message || fmtErr)
        return {
          id: m.id,
          sender: String(m.from_user_id) === String(myId) ? 'me' : 'other',
          text: typeof m.content === 'string' ? m.content : '',
          attachment: null,
          reply: null,
          status: 'sent',
          read: Boolean(m.read),
          delivered: Boolean(m.delivered),
          time: ''
        }
      }
    })

    res.json(payload)
  } catch (error) {
    console.error('GET /messages error:', error?.message || error)
    res.status(500).json({ message: 'Error', error: error?.message || String(error) })
  }
})

router.post('/delivered/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const fromId = req.params.userId
    const marked = await markInboundReceipts({ fromId, myId, mode: 'delivered' })
    broadcastChatReceipt(fromId, {
      from: myId,
      delivered: true,
      read: false,
      messageIds: marked.messageIds
    }).catch(() => {})
    res.json({ ok: !marked.error, messageIds: marked.messageIds, error: marked.error || undefined })
  } catch (error) {
    console.error('delivered error:', error?.message || error)
    res.json({ ok: false, messageIds: [] })
  }
})

router.post('/ack-delivered', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const now = new Date().toISOString()
    const { data, error } = await supabaseAdmin
      .from('messages')
      .update({ delivered: true, delivered_at: now })
      .eq('to_user_id', myId)
      .eq('delivered', false)
      .select('id, from_user_id')

    if (error) {
      // Legacy DB without delivered column — treat "unread inbound" as needing peer notify only via read path
      console.error('ack-delivered schema:', error.message)
      return res.json({ ok: false, count: 0, peers: [], error: error.message })
    }

    const byFrom = new Map()
    for (const row of data || []) {
      const fid = row.from_user_id
      if (!byFrom.has(fid)) byFrom.set(fid, [])
      byFrom.get(fid).push(row.id)
    }

    await Promise.all(
      [...byFrom.entries()].map(([fromId, messageIds]) =>
        broadcastChatReceipt(fromId, {
          from: myId,
          delivered: true,
          read: false,
          messageIds
        }).catch(() => {})
      )
    )

    res.json({
      ok: true,
      count: (data || []).length,
      peers: [...byFrom.keys()]
    })
  } catch (error) {
    console.error('ack-delivered error:', error?.message || error)
    res.json({ ok: false, count: 0, peers: [] })
  }
})

router.post('/read/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const fromId = req.params.userId
    const marked = await markInboundReceipts({ fromId, myId, mode: 'read' })
    broadcastChatReceipt(fromId, {
      from: myId,
      delivered: true,
      read: true,
      messageIds: marked.messageIds
    }).catch(() => {})
    res.json({ ok: !marked.error, messageIds: marked.messageIds })
  } catch (error) {
    console.error('read error:', error?.message || error)
    res.json({ ok: false, messageIds: [] })
  }
})

/** Lightweight outbound receipt snapshot for the open thread (sender-side poll). */
router.get('/receipts/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const otherId = req.params.userId
    const { data, error } = await supabaseAdmin
      .from('messages')
      .select('id, delivered, read')
      .eq('from_user_id', myId)
      .eq('to_user_id', otherId)
      .order('created_at', { ascending: false })
      .limit(80)
    if (error) throw error
    res.json(
      (data || []).map((row) => ({
        id: row.id,
        delivered: Boolean(row.delivered || row.read),
        read: Boolean(row.read),
        status: row.read ? 'read' : row.delivered ? 'delivered' : 'sent'
      }))
    )
  } catch (error) {
    console.error('receipts error:', error?.message || error)
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.post('/clear/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const peerId = req.params.userId
    const clearedAt = new Date().toISOString()
    const { error } = await supabaseAdmin
      .from('chat_clears')
      .upsert(
        { user_id: myId, peer_id: peerId, cleared_at: clearedAt },
        { onConflict: 'user_id,peer_id' }
      )
    if (error) throw error
    res.json({ ok: true, clearedAt })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.get('/shared/:userId', authenticate, async (req, res) => {
  try {
    const myId = req.user.id
    const otherId = req.params.userId
    const clearedAt = await getChatClear(myId, otherId)

    const { data: messages, error } = await supabaseAdmin
      .from('messages')
      .select('id, from_user_id, to_user_id, content, created_at')
      .or(
        `and(from_user_id.eq.${myId},to_user_id.eq.${otherId}),and(from_user_id.eq.${otherId},to_user_id.eq.${myId})`
      )
      .order('created_at', { ascending: false })
      .limit(300)

    if (error) throw error

    const shared = (messages || [])
      .filter((m) => isAfterClear(m, clearedAt))
      .map((m) => {
        const decoded = decodeChatContent(m.content)
        return { m, decoded }
      })
      .flatMap(({ m, decoded }) => {
        const items = []
        const base = {
          id: m.id,
          from: m.from_user_id === myId ? 'me' : 'other',
          createdAt: m.created_at,
          text: decoded.text || ''
        }
        const att = decoded.attachment

        // Never surface view-once or audio in shared media
        if (att?.viewOnce) return items
        if (att?.type === 'audio') return items

        if (att && SHARED_ATTACHMENT_TYPES.has(att.type) && (att.url || att.type === 'post')) {
          items.push({
            ...base,
            category: att.type === 'post' ? 'posts' : 'files',
            attachment: att
          })
        }

        const link = extractFirstUrl(decoded.text)
        if (link && !att?.viewOnce) {
          items.push({
            ...base,
            id: `${m.id}:link`,
            category: 'links',
            attachment: {
              type: 'link',
              url: link,
              name: link.replace(/^https?:\/\//i, '').slice(0, 64)
            }
          })
        }

        return items
      })

    res.json(shared)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.get('/partner/:userId/public-routines', authenticate, async (req, res) => {
  try {
    const partnerId = req.params.userId
    const { data, error } = await supabaseAdmin
      .from('workout_routines')
      .select('id, name, color, exercises, days, updated_at')
      .eq('user_id', partnerId)
      .eq('is_public', true)
      .order('updated_at', { ascending: false })

    if (error) throw error

    const routines = (data || []).map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color || 'primary',
      exerciseCount: Array.isArray(row.exercises) ? row.exercises.length : 0,
      days: normalizeRoutineDays(row.days),
      updatedAt: row.updated_at
    }))

    res.json(routines)
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

router.post('/send', authenticate, async (req, res) => {
  try {
    const { to, content, attachment, reply } = req.body
    const text = typeof content === 'string' ? content.trim() : ''
    if (!to || (!text && !attachment)) {
      return res.status(400).json({ message: 'Destinatario y contenido requeridos' })
    }

    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, settings, profile')
      .eq('id', to)
      .single()

    if (recipientError || !recipient) {
      return res.status(404).json({ message: 'Usuario no encontrado' })
    }

    if (isQiSiProfile(recipient)) {
      return res.status(403).json({
        message: QISI_MESSAGING_COPY,
        code: QISI_MESSAGING_CODE
      })
    }

    const allowMessages = recipient.settings?.privacy?.allowMessages
    if (allowMessages === false) {
      return res.status(403).json({ message: 'Este usuario no acepta mensajes' })
    }

    let safeReply = null
    if (reply && typeof reply === 'object' && reply.id) {
      safeReply = {
        id: String(reply.id),
        sender: reply.sender === 'me' ? 'me' : 'other',
        senderName: String(reply.senderName || '').slice(0, 80) || 'Usuario',
        text: String(reply.text || '').slice(0, 160),
        attachmentType: reply.attachmentType ? String(reply.attachmentType).slice(0, 24) : null
      }
    }

    const stored = encodeChatContent({
      text,
      attachment: attachment || null,
      reply: safeReply
    })

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

/** Recipient opens a view-once photo/audio — returns media once, then scrubs it from storage. */
router.post('/view-once/:messageId', authenticate, async (req, res) => {
  try {
    const messageId = req.params.messageId
    const userId = req.user.id

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (error || !message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' })
    }

    if (message.to_user_id !== userId) {
      return res.status(403).json({ message: 'Solo el destinatario puede abrir este contenido' })
    }

    const decoded = decodeChatContent(message.content)
    const attachment = decoded.attachment
    if (!attachment?.viewOnce) {
      return res.status(400).json({ message: 'Este mensaje no es de una sola vista' })
    }
    if (attachment.opened || !attachment.url) {
      return res.status(410).json({ message: 'Este contenido ya fue abierto' })
    }
    if (attachment.type !== 'image' && attachment.type !== 'audio') {
      return res.status(400).json({ message: 'Tipo de adjunto no válido' })
    }

    const payload = {
      url: attachment.url,
      type: attachment.type,
      mime: attachment.mime || null,
      durationSec: attachment.durationSec || null
    }

    const scrubbed = encodeChatContent({
      text: decoded.text,
      attachment: scrubViewOnceAttachment(attachment),
      reply: decoded.reply || null,
      reactions: decoded.reactions || null
    })

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('messages')
      .update({ content: scrubbed })
      .eq('id', messageId)
      .select('*')
      .single()

    if (updateError) throw updateError

    res.json({
      media: payload,
      message: formatChatMessage(updated, userId)
    })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

/** Toggle/set message reaction — any emoji (quick bar or + picker). */
router.post('/react/:messageId', authenticate, async (req, res) => {
  try {
    const messageId = req.params.messageId
    const userId = req.user.id
    const rawEmoji = req.body?.emoji
    const emoji =
      rawEmoji === null || rawEmoji === undefined || rawEmoji === ''
        ? null
        : String(rawEmoji).trim().slice(0, 64)

    if (emoji && emoji.length > 64) {
      return res.status(400).json({ message: 'Reacción no válida' })
    }

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (error || !message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' })
    }

    if (message.from_user_id !== userId && message.to_user_id !== userId) {
      return res.status(403).json({ message: 'No eres participante de este chat' })
    }

    const decoded = decodeChatContent(message.content)
    if (decoded.deleted) {
      return res.status(410).json({ message: 'Este mensaje fue eliminado' })
    }

    const nextReactions = { ...(decoded.reactions || {}) }
    if (!emoji || nextReactions[userId] === emoji) {
      delete nextReactions[userId]
    } else {
      nextReactions[userId] = emoji
    }

    const stored = encodeChatContent({
      text: decoded.text,
      attachment: decoded.attachment,
      reply: decoded.reply || null,
      reactions: Object.keys(nextReactions).length ? nextReactions : null
    })

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('messages')
      .update({ content: stored })
      .eq('id', messageId)
      .select('*')
      .single()

    if (updateError) throw updateError

    res.json(formatChatMessage(updated, userId))
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

/** Hide message only for the current user. */
router.post('/delete-for-me/:messageId', authenticate, async (req, res) => {
  try {
    const messageId = req.params.messageId
    const userId = req.user.id

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .select('id, from_user_id, to_user_id, hidden_for')
      .eq('id', messageId)
      .single()

    if (error || !message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' })
    }
    if (message.from_user_id !== userId && message.to_user_id !== userId) {
      return res.status(403).json({ message: 'No eres participante de este chat' })
    }

    const prev = Array.isArray(message.hidden_for) ? message.hidden_for.map(String) : []
    const next = [...new Set([...prev, String(userId)])]

    const { error: updErr } = await supabaseAdmin
      .from('messages')
      .update({ hidden_for: next })
      .eq('id', messageId)

    if (updErr) {
      // Column may not exist yet — soft-fail with clear message
      console.error('delete-for-me:', updErr.message)
      return res.status(503).json({
        message: 'Aplica la migración messages.hidden_for en Supabase',
        error: updErr.message
      })
    }

    res.json({ ok: true, messageId })
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

/** Soft-delete for everyone (sender only, within 1 hour). */
router.post('/delete-for-everyone/:messageId', authenticate, async (req, res) => {
  try {
    const messageId = req.params.messageId
    const userId = req.user.id

    const { data: message, error } = await supabaseAdmin
      .from('messages')
      .select('*')
      .eq('id', messageId)
      .single()

    if (error || !message) {
      return res.status(404).json({ message: 'Mensaje no encontrado' })
    }
    if (String(message.from_user_id) !== String(userId)) {
      return res.status(403).json({ message: 'Solo puedes eliminar tus mensajes para todos' })
    }

    const age = Date.now() - new Date(message.created_at).getTime()
    if (age > DELETE_FOR_EVERYONE_MS) {
      return res.status(400).json({
        message: 'Solo puedes eliminar para todos durante la primera hora'
      })
    }

    const stored = encodeChatContent({ deleted: true })
    const { data: updated, error: updateError } = await supabaseAdmin
      .from('messages')
      .update({ content: stored })
      .eq('id', messageId)
      .select('*')
      .single()

    if (updateError) throw updateError

    const peerId =
      String(message.to_user_id) === String(userId) ? message.from_user_id : message.to_user_id
    broadcastChatReceipt(peerId, {
      from: userId,
      delivered: true,
      read: true,
      messageIds: [messageId],
      deleted: true
    }).catch(() => {})

    res.json(formatChatMessage(updated, userId))
  } catch (error) {
    res.status(500).json({ message: 'Error', error: error.message })
  }
})

export default router
