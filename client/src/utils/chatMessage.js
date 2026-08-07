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
    return text?.trim() || `📝 ${attachment.authorName || 'Publicación'}`
  }
  if (attachment?.type === 'image') {
    return text?.trim() || '📷 Foto'
  }
  if (attachment?.type === 'file') {
    return text?.trim() || `📎 ${attachment.name || attachment.fileName || 'Archivo'}`
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
    out[String(uid)] = emoji.trim().slice(0, 64)
  }
  return Object.keys(out).length ? out : null
}

export function encodeChatContent({ text = '', attachment = null, reply = null, reactions = null } = {}) {
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
      if (parsed.deleted) {
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
