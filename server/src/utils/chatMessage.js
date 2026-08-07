const MSG_PREFIX = '__QMSG__'

function previewLabel(text, attachment, deleted = false) {
  if (deleted) return '🚫 Se eliminó este mensaje'
  if (attachment?.viewOnce) {
    if (attachment.opened || !attachment.url) {
      return attachment.type === 'audio' ? '🎤 Audio abierto' : '📷 Foto abierta'
    }
    return attachment.type === 'audio' ? '🎤 Audio · 1 vista' : '📷 Foto · 1 vista'
  }
  if (attachment?.type === 'story') {
    return text?.trim() || '📸 Estado de Qyntra'
  }
  if (attachment?.type === 'post') {
    return text?.trim() || `📝 ${attachment.authorName || 'Publicación'} · ${attachment.snippet || 'Qyntra Gym'}`
  }
  if (attachment?.type === 'image') {
    return text?.trim() || '📷 Foto'
  }
  if (attachment?.type === 'file') {
    const fileName = attachment.name || attachment.fileName || 'Archivo'
    return text?.trim() || `📎 ${fileName}`
  }
  if (attachment?.type === 'audio') {
    return text?.trim() || '🎤 Mensaje de voz'
  }
  return text || ''
}

function normalizeReactions(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const out = {}
  for (const [uid, emoji] of Object.entries(raw)) {
    if (!uid || typeof emoji !== 'string' || !emoji.trim()) continue
    // Allow ZWJ / skin-tone sequences
    out[String(uid)] = emoji.trim().slice(0, 64)
  }
  return Object.keys(out).length ? out : null
}

export function encodeChatContent({
  text = '',
  attachment = null,
  reply = null,
  reactions = null,
  deleted = false
} = {}) {
  if (deleted) {
    return `${MSG_PREFIX}${JSON.stringify({
      deleted: true,
      text: '',
      attachment: null,
      reply: null,
      reactions: null
    })}`
  }
  const hasAttachment = Boolean(attachment)
  const hasReply = Boolean(reply?.id)
  const cleanReactions = normalizeReactions(reactions)
  const hasReactions = Boolean(cleanReactions)
  if (!hasAttachment && !hasReply && !hasReactions) return String(text || '')
  const payload = {
    text: String(text || ''),
    attachment: attachment || null,
    reply: hasReply ? reply : null
  }
  if (hasReactions) payload.reactions = cleanReactions
  return `${MSG_PREFIX}${JSON.stringify(payload)}`
}

export function decodeChatContent(raw) {
  if (typeof raw === 'string' && raw.startsWith(MSG_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(MSG_PREFIX.length))
      const deleted = Boolean(parsed.deleted)
      if (deleted) {
        return {
          text: '',
          attachment: null,
          reply: null,
          reactions: null,
          deleted: true,
          preview: previewLabel('', null, true)
        }
      }
      const text = parsed.text || ''
      const attachment = parsed.attachment || null
      const reply = parsed.reply || null
      const reactions = normalizeReactions(parsed.reactions)
      return {
        text,
        attachment,
        reply,
        reactions,
        deleted: false,
        preview: previewLabel(text, attachment, false)
      }
    } catch {
      /* fallthrough */
    }
  }
  return {
    text: raw || '',
    attachment: null,
    reply: null,
    reactions: null,
    deleted: false,
    preview: raw || ''
  }
}

export function scrubViewOnceAttachment(attachment) {
  if (!attachment || !attachment.viewOnce) return attachment
  return {
    type: attachment.type,
    viewOnce: true,
    opened: true,
    openedAt: new Date().toISOString(),
    durationSec: attachment.durationSec || undefined,
    mime: attachment.mime || undefined
  }
}

function summarizeReactions(reactions, myId) {
  const map = reactions || {}
  const counts = {}
  Object.values(map).forEach((emoji) => {
    if (!emoji) return
    counts[emoji] = (counts[emoji] || 0) + 1
  })
  return {
    myReaction: myId && map[myId] ? map[myId] : null,
    reactionSummary: Object.entries(counts)
      .map(([emoji, count]) => ({ emoji, count }))
      .sort((a, b) => b.count - a.count)
  }
}

export function formatChatMessage(row, myId) {
  const decoded = decodeChatContent(row.content)
  const isMine = String(row.from_user_id) === String(myId)
  let status = 'sent'
  if (isMine) {
    if (row.read) status = 'read'
    else if (row.delivered) status = 'delivered'
    else status = 'sent'
  }

  if (decoded.deleted) {
    return {
      id: row.id,
      sender: isMine ? 'me' : 'other',
      text: '',
      attachment: null,
      reply: null,
      reactions: null,
      myReaction: null,
      reactionSummary: [],
      deleted: true,
      status,
      read: Boolean(row.read),
      delivered: Boolean(row.delivered),
      createdAt: row.created_at,
      time: new Date(row.created_at).toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit'
      })
    }
  }

  const { myReaction, reactionSummary } = summarizeReactions(decoded.reactions, myId)
  return {
    id: row.id,
    sender: isMine ? 'me' : 'other',
    text: decoded.text,
    attachment: decoded.attachment,
    reply: decoded.reply || null,
    reactions: decoded.reactions || null,
    myReaction,
    reactionSummary,
    deleted: false,
    status,
    read: Boolean(row.read),
    delivered: Boolean(row.delivered),
    createdAt: row.created_at,
    time: new Date(row.created_at).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}

/** Compact snippet for reply quotes */
export function replySnippetFromMessage(msg) {
  if (!msg || msg.deleted) return 'Mensaje eliminado'
  if (msg.text?.trim()) {
    const t = msg.text.trim()
    return t.length > 120 ? `${t.slice(0, 117)}…` : t
  }
  const a = msg.attachment
  if (!a) return 'Mensaje'
  if (a.viewOnce) return a.type === 'audio' ? 'Audio · 1 vista' : 'Foto · 1 vista'
  if (a.type === 'image') return 'Foto'
  if (a.type === 'audio') return 'Mensaje de voz'
  if (a.type === 'file') return a.name || 'Archivo'
  if (a.type === 'post') return 'Publicación'
  if (a.type === 'story') return 'Estado'
  return 'Mensaje'
}

export function buildReplyPayload(msg, { myName = 'Tú', otherName = 'Usuario' } = {}) {
  if (!msg?.id || String(msg.id).startsWith('temp-') || msg.deleted) return null
  const isMe = msg.sender === 'me'
  return {
    id: msg.id,
    sender: isMe ? 'me' : 'other',
    senderName: isMe ? myName : otherName,
    text: replySnippetFromMessage(msg),
    attachmentType: msg.attachment?.type || null
  }
}

/** Quick bar + gym set (any emoji allowed via +) */
export const CHAT_REACTIONS = ['❤️', '💪', '🧴', '🔥', '⚡', '🏆']
export const CHAT_QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🥺']
export const DELETE_FOR_EVERYONE_MS = 60 * 60 * 1000
