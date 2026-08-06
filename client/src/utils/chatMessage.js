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
      preview: attachment?.type === 'story'
          ? text?.trim() || '📸 Estado de Qyntra'
          : attachment?.type === 'post'
            ? text?.trim() || `📝 ${attachment.authorName || 'Publicación'}`
            : text || ''
      }
    } catch {
      /* fallthrough */
    }
  }
  return { text: raw || '', attachment: null, preview: raw || '' }
}
