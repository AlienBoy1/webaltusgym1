const MSG_PREFIX = '__QMSG__'

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

function previewLabel(text, attachment) {
  if (attachment?.type === 'story') {
    return text?.trim() || '📸 Estado de Qyntra'
  }
  return text || ''
}

export function formatChatMessage(row, myId) {
  const decoded = decodeChatContent(row.content)
  return {
    id: row.id,
    sender: row.from_user_id === myId ? 'me' : 'other',
    text: decoded.text,
    attachment: decoded.attachment,
    time: new Date(row.created_at).toLocaleTimeString('es', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}
