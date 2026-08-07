const keyFor = (userId) => (userId ? `qyntra_chat_shortcuts:${userId}` : null)

export function loadChatShortcuts(userId) {
  const key = keyFor(userId)
  if (!key) return []
  try {
    const raw = JSON.parse(localStorage.getItem(key) || '[]')
    return Array.isArray(raw) ? raw : []
  } catch {
    return []
  }
}

export function saveChatShortcuts(userId, list) {
  const key = keyFor(userId)
  if (!key) return
  try {
    localStorage.setItem(key, JSON.stringify(list.slice(0, 24)))
  } catch {
    /* ignore */
  }
}

export function addChatShortcut(userId, peer) {
  if (!userId || !peer?.id) return loadChatShortcuts(userId)
  const next = [
    {
      id: peer.id,
      name: peer.name || 'Usuario',
      username: peer.username || null,
      avatar: peer.avatar || null
    },
    ...loadChatShortcuts(userId).filter((s) => s.id !== peer.id)
  ]
  saveChatShortcuts(userId, next)
  try {
    window.dispatchEvent(new CustomEvent('qyntra:chat-shortcuts'))
  } catch {
    /* ignore */
  }
  return next
}

export function removeChatShortcut(userId, peerId) {
  const next = loadChatShortcuts(userId).filter((s) => s.id !== peerId)
  saveChatShortcuts(userId, next)
  try {
    window.dispatchEvent(new CustomEvent('qyntra:chat-shortcuts'))
  } catch {
    /* ignore */
  }
  return next
}
