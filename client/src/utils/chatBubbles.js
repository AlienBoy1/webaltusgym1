/**
 * Per-peer chat bubble preference (Messenger-style heads).
 * Synced to Android SharedPreferences so FCM can show the head when the app is killed.
 */
import { isNativeApp } from './appMode'

const STORAGE_KEY = 'qyntra:chatBubbles'
const API_BASE_KEY = 'qyntra:apiBase'
const PEERS_META_KEY = 'qyntra:chatPeerMeta'

function readMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
  void syncNativeChatBubbles(map)
}

function readPeerMeta() {
  try {
    const raw = localStorage.getItem(PEERS_META_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writePeerMeta(meta) {
  try {
    localStorage.setItem(PEERS_META_KEY, JSON.stringify(meta))
  } catch {
    /* ignore */
  }
  void syncNativeChatBubbles(readMap())
}

export function getCachedPeerProfile(peerId) {
  if (!peerId) return null
  const hit = readPeerMeta()[String(peerId)]
  return hit && typeof hit === 'object' ? hit : null
}

export function cachePeerProfile(peerId, { name, avatar, wallpaper } = {}) {
  if (!peerId) return
  const meta = readPeerMeta()
  const id = String(peerId)
  const prev = meta[id] || {}
  meta[id] = {
    name: name || prev.name || '',
    avatar: avatar || prev.avatar || '',
    wallpaper: wallpaper !== undefined ? wallpaper : prev.wallpaper || 'none'
  }
  writePeerMeta(meta)
}

export function isChatBubbleEnabled(peerId) {
  if (!peerId) return false
  return Boolean(readMap()[String(peerId)])
}

export function setChatBubbleEnabled(peerId, enabled) {
  if (!peerId) return
  const map = readMap()
  const id = String(peerId)
  if (enabled) map[id] = true
  else delete map[id]
  writeMap(map)
}

export function listChatBubblePeers() {
  return Object.keys(readMap()).filter((id) => readMap()[id])
}

export function cacheMessageThread(peerId, messages) {
  if (!peerId || !Array.isArray(messages)) return
  try {
    const slim = messages.slice(-80).map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      attachment: m.attachment
        ? {
            type: m.attachment.type,
            url: String(m.attachment.url || '').startsWith('data:')
              ? null
              : m.attachment.url,
            name: m.attachment.name
          }
        : null,
      reply: m.reply || null,
      status: m.status,
      delivered: m.delivered,
      read: m.read,
      time: m.time,
      createdAt: m.createdAt || m.created_at || null
    }))
    localStorage.setItem(`qyntra:chatMsgs:${peerId}`, JSON.stringify(slim))
  } catch {
    /* quota */
  }
}

export function loadCachedMessageThread(peerId) {
  if (!peerId) return null
  try {
    const raw = localStorage.getItem(`qyntra:chatMsgs:${peerId}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

export async function dismissChatNotification(peerId) {
  if (!peerId) return
  const tag = `msg-${peerId}`
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.cancelChatNotification) {
      window.QyntraNative.cancelChatNotification(String(peerId))
    }
  } catch {
    /* ignore */
  }
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      const notes = await reg?.getNotifications?.({ tag })
      if (notes?.length) notes.forEach((n) => n.close())
    }
  } catch {
    /* ignore */
  }
}

/**
 * Native Android tray notification (name + body) + optional floating head.
 */
export async function notifyNativeIncomingChat({ peerId, name, preview, avatarUrl }) {
  if (!isNativeApp() || !peerId) return false
  const cached = getCachedPeerProfile(peerId)
  const resolvedName =
    (name && name !== 'Usuario' ? name : null) || cached?.name || name || 'Nuevo mensaje'
  const resolvedAvatar = avatarUrl || cached?.avatar || ''
  if (resolvedName && resolvedName !== 'Usuario') {
    cachePeerProfile(peerId, { name: resolvedName, avatar: resolvedAvatar })
  }
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.showChatMessageAlert) {
      const raw = window.QyntraNative.showChatMessageAlert(
        String(peerId),
        String(resolvedName),
        String(preview || ''),
        String(resolvedAvatar)
      )
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return Boolean(parsed?.ok)
    }
  } catch {
    /* ignore */
  }
  return showNativeChatBubble({
    peerId,
    name: resolvedName,
    preview,
    avatarUrl: resolvedAvatar
  })
}

export async function showNativeChatBubble({ peerId, name, preview, avatarUrl }) {
  if (!isNativeApp() || !peerId || !isChatBubbleEnabled(peerId)) return false
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    return false
  }
  const cached = getCachedPeerProfile(peerId)
  const resolvedName = (name && name !== 'Usuario' ? name : null) || cached?.name || name || '?'
  const resolvedAvatar = avatarUrl || cached?.avatar || ''
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.showChatBubble) {
      const raw = window.QyntraNative.showChatBubble(
        String(peerId),
        String(resolvedName),
        String(preview || ''),
        String(resolvedAvatar)
      )
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      return Boolean(parsed?.ok) && !parsed?.deferred
    }
  } catch {
    /* ignore */
  }
  return false
}

export async function hideNativeChatBubble(peerId) {
  try {
    if (typeof window !== 'undefined' && window.QyntraNative?.hideChatBubble) {
      window.QyntraNative.hideChatBubble(peerId ? String(peerId) : '')
    }
  } catch {
    /* ignore */
  }
}

async function syncNativeChatBubbles(map) {
  if (!isNativeApp()) return
  try {
    let apiBase = ''
    try {
      apiBase = localStorage.getItem(API_BASE_KEY) || ''
    } catch {
      /* ignore */
    }
    if (!apiBase) {
      try {
        const { default: api } = await import('./api')
        apiBase = String(api?.defaults?.baseURL || '').replace(/\/$/, '')
        if (apiBase) localStorage.setItem(API_BASE_KEY, apiBase)
      } catch {
        /* ignore */
      }
    }
    let authToken = ''
    try {
      const { getStoredToken } = await import('./tokenStorage')
      authToken = getStoredToken() || ''
    } catch {
      /* ignore */
    }
    const peersMeta = readPeerMeta()
    const payload = JSON.stringify({
      peers: Object.keys(map || {}).filter((id) => map[id]),
      peersMeta,
      apiBase,
      authToken
    })
    if (typeof window !== 'undefined' && window.QyntraNative?.syncChatBubbles) {
      window.QyntraNative.syncChatBubbles(payload)
    }
  } catch {
    /* ignore */
  }
}

/** Call once after login / boot so native FCM can open bubbles when killed. */
export async function syncChatBubblesToNative() {
  writeMap(readMap())
}
