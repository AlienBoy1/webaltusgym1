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

export function encodeChatContent({ text = '', attachment = null } = {}) {
  if (!attachment) return String(text || '')
  return `${MSG_PREFIX}${JSON.stringify({ text: String(text || ''), attachment })}`
}

export function decodeChatContent(raw) {
  if (typeof raw === 'string' && raw.startsWith(MSG_PREFIX)) {
    try {
      const parsed = JSON.parse(raw.slice(MSG_PREFIX.length))
      const text = parsed.text || ''
      const attachment = parsed.attachment || null
      return {
        text,
        attachment,
        preview: previewLabel(text, attachment)
      }
    } catch {
      /* fallthrough */
    }
  }
  return { text: raw || '', attachment: null, preview: raw || '' }
}
