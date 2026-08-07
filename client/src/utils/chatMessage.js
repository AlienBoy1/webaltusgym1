const MSG_PREFIX = '__QMSG__'

function previewLabel(text, attachment) {
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

export function encodeChatContent({ text = '', attachment = null, reply = null } = {}) {
  const hasAttachment = Boolean(attachment)
  const hasReply = Boolean(reply?.id)
  if (!hasAttachment && !hasReply) return String(text || '')
  return `${MSG_PREFIX}${JSON.stringify({
    text: String(text || ''),
    attachment: attachment || null,
    reply: hasReply ? reply : null
  })}`
}

export function decodeChatContent(raw) {
  if (typeof raw === 'string' && raw.startsWith(MSG_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(MSG_PREFIX.length))
      const text = parsed.text || ''
      const attachment = parsed.attachment || null
      const reply = parsed.reply || null
      return {
        text,
        attachment,
        reply,
        preview: previewLabel(text, attachment)
      }
    } catch {
      /* fallthrough */
    }
  }
  return { text: raw || '', attachment: null, reply: null, preview: raw || '' }
}

export function replySnippetFromMessage(msg) {
  if (!msg) return ''
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
  if (!msg?.id || String(msg.id).startsWith('temp-')) return null
  const isMe = msg.sender === 'me'
  return {
    id: msg.id,
    sender: isMe ? 'me' : 'other',
    senderName: isMe ? myName : otherName,
    text: replySnippetFromMessage(msg),
    attachmentType: msg.attachment?.type || null
  }
}
