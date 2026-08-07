import { supabase } from '../lib/supabase'
import { decodeChatContent } from './chatMessage'

let messageChannel = null
let presenceChannel = null
const listeners = {
  newMessage: new Set(),
  messageStatus: new Set(),
  userTyping: new Set(),
  userOnline: new Set(),
  userOffline: new Set(),
  messageSent: new Set(),
  presenceSync: new Set()
}

let trackedUserId = null

function buildPresenceMap(state) {
  const map = new Map()
  Object.entries(state || {}).forEach(([id, metas]) => {
    const list = Array.isArray(metas) ? metas : []
    const latest = list[list.length - 1] || {}
    map.set(String(id), latest.status || 'online')
  })
  return map
}

function emitPresenceSync() {
  if (!presenceChannel) return
  const map = buildPresenceMap(presenceChannel.presenceState())
  emit('presenceSync', map)
}

function emit(event, payload) {
  listeners[event]?.forEach((fn) => {
    try {
      fn(payload)
    } catch (e) {
      console.error(e)
    }
  })
}

function emitMessageUpdate(row) {
  if (!row?.id) return
  const decoded = decodeChatContent(row.content)
  emit('messageStatus', {
    id: row.id,
    from: row.from_user_id,
    to: row.to_user_id,
    delivered: Boolean(row.delivered),
    read: Boolean(row.read),
    status: row.read ? 'read' : row.delivered ? 'delivered' : 'sent',
    text: decoded.text,
    attachment: decoded.attachment,
    reply: decoded.reply || null,
    reactions: decoded.reactions || null,
    contentUpdated: true
  })
}

export function onChatEvent(event, handler) {
  if (!listeners[event]) listeners[event] = new Set()
  listeners[event].add(handler)
  return () => listeners[event].delete(handler)
}

export function offChatEvent(event, handler) {
  if (!listeners[event]) return
  if (handler) listeners[event].delete(handler)
  else listeners[event].clear()
}

export function initSocket(userId) {
  cleanupSocket()
  if (!userId) return null
  trackedUserId = String(userId)

  messageChannel = supabase
    .channel(`messages:${userId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `to_user_id=eq.${userId}`
      },
      async (payload) => {
        const row = payload.new
        let fromName = 'Usuario'
        try {
          const { data } = await supabase
            .from('profiles')
            .select('name')
            .eq('id', row.from_user_id)
            .single()
          if (data?.name) fromName = data.name
        } catch {
          /* ignore */
        }
        const decoded = decodeChatContent(row.content)
        emit('newMessage', {
          from: row.from_user_id,
          fromName,
          message: decoded.preview,
          text: decoded.text,
          attachment: decoded.attachment,
          reply: decoded.reply || null,
          timestamp: row.created_at,
          id: row.id
        })
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `from_user_id=eq.${userId}`
      },
      (payload) => {
        emitMessageUpdate(payload.new)
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `to_user_id=eq.${userId}`
      },
      (payload) => {
        emitMessageUpdate(payload.new)
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        scheduleSocketReconnect()
      }
    })

  presenceChannel = supabase.channel('online-users', {
    config: { presence: { key: userId } }
  })

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      Object.keys(state).forEach((id) => emit('userOnline', id))
      emitPresenceSync()
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      emit('userOnline', key)
      emitPresenceSync()
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      emit('userOffline', key)
      emitPresenceSync()
    })
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.to === userId) emit('userTyping', { from: payload.from })
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({
          user_id: userId,
          status: 'online',
          updated_at: new Date().toISOString()
        })
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        scheduleSocketReconnect()
      }
    })

  return { messageChannel, presenceChannel }
}

let reconnectTimer = null

function scheduleSocketReconnect() {
  if (!trackedUserId) return
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    const id = trackedUserId
    if (id) initSocket(id)
  }, 1500)
}

/** Re-subscribe channels after tab wake / network restore. */
export function ensureSocketAlive(userId) {
  const id = userId ? String(userId) : trackedUserId
  if (!id) return null
  const msgState = messageChannel?.state
  const presenceState = presenceChannel?.state
  const healthy =
    messageChannel &&
    presenceChannel &&
    trackedUserId === String(id) &&
    (msgState === 'joined' || msgState === 'joining') &&
    (presenceState === 'joined' || presenceState === 'joining')
  if (healthy) {
    trackPresence({ user_id: id, status: 'online' }).catch(() => {})
    return { messageChannel, presenceChannel }
  }
  return initSocket(id)
}

export function getPresenceChannel() {
  return presenceChannel
}

/** Current presence Map(userId → status) from the live channel, if subscribed. */
export function getPresenceSnapshot() {
  if (!presenceChannel) return new Map()
  return buildPresenceMap(presenceChannel.presenceState())
}

export function trackPresence(payload = {}) {
  if (!presenceChannel) return Promise.resolve()
  const user_id = payload.user_id || trackedUserId
  if (!user_id) return Promise.resolve()
  return presenceChannel.track({
    user_id,
    status: payload.status || 'online',
    updated_at: payload.updated_at || new Date().toISOString()
  })
}

export function disconnectSocket() {
  cleanupSocket()
}

function cleanupSocket() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (messageChannel) {
    supabase.removeChannel(messageChannel)
    messageChannel = null
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel)
    presenceChannel = null
  }
  trackedUserId = null
}

export function sendTyping(to, from) {
  if (!presenceChannel) return
  presenceChannel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { to, from }
  })
}

export const requestNotificationPermission = async () => {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission === 'granted'
  }
  return false
}

export const showNotification = (title, body, options = {}) => {
  if (Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/badge-96x96.png',
      tag: options.tag || 'qyntra-notification',
      requireInteraction: false,
      ...options
    })
    notification.onclick = () => {
      window.focus()
      notification.close()
      if (options.onClick) options.onClick()
    }
    setTimeout(() => notification.close(), 5000)
    return notification
  }
  return null
}

/** @deprecated Prefer onChatEvent / offChatEvent. Typing only — never use for sendMessage. */
export function getSocket() {
  return {
    connected: false,
    on: (event, handler) => onChatEvent(event, handler),
    emit: (event, data) => {
      if (event === 'typing') sendTyping(data.to, data.from)
    },
    off: (event, handler) => offChatEvent(event, handler),
    disconnect: disconnectSocket
  }
}

export default {
  initSocket,
  ensureSocketAlive,
  disconnectSocket,
  getSocket,
  onChatEvent,
  offChatEvent,
  sendTyping,
  trackPresence,
  getPresenceChannel,
  requestNotificationPermission,
  showNotification
}
