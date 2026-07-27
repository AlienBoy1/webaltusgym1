import { supabase } from '../lib/supabase'
import { uid } from './ids'

let messageChannel = null
let presenceChannel = null
const listeners = {
  newMessage: new Set(),
  userTyping: new Set(),
  userOnline: new Set(),
  userOffline: new Set(),
  messageSent: new Set()
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

export function onChatEvent(event, handler) {
  if (!listeners[event]) listeners[event] = new Set()
  listeners[event].add(handler)
  return () => listeners[event].delete(handler)
}

export function initSocket(userId) {
  cleanupSocket()
  if (!userId) return null

  // Realtime messages where current user is recipient
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
        emit('newMessage', {
          from: row.from_user_id,
          fromName,
          message: row.content,
          timestamp: row.created_at,
          id: row.id
        })
      }
    )
    .subscribe()

  presenceChannel = supabase.channel('online-users', {
    config: { presence: { key: userId } }
  })

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState()
      Object.keys(state).forEach((id) => emit('userOnline', id))
    })
    .on('presence', { event: 'join' }, ({ key }) => emit('userOnline', key))
    .on('presence', { event: 'leave' }, ({ key }) => emit('userOffline', key))
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload?.to === userId) emit('userTyping', { from: payload.from })
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await presenceChannel.track({ user_id: userId, online_at: new Date().toISOString() })
      }
    })

  return { messageChannel, presenceChannel }
}

export function disconnectSocket() {
  cleanupSocket()
}

function cleanupSocket() {
  if (messageChannel) {
    supabase.removeChannel(messageChannel)
    messageChannel = null
  }
  if (presenceChannel) {
    supabase.removeChannel(presenceChannel)
    presenceChannel = null
  }
}

export async function sendRealtimeMessage({ to, message, from, fromName }) {
  // Persistence goes through API; realtime notify via DB insert trigger
  // This helper exists for typing broadcast
  return { to, message, from, fromName }
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
      icon: '/favicon.svg',
      badge: '/favicon.svg',
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

/** @deprecated use initSocket + onChatEvent — kept for import compatibility */
export function getSocket() {
  return {
    on: (event, handler) => {
      onChatEvent(event, handler)
      return undefined
    },
    emit: (event, data) => {
      if (event === 'typing') sendTyping(data.to, data.from)
      if (event === 'sendMessage') {
        emit('messageSent', { success: true })
      }
    },
    off: () => {},
    disconnect: disconnectSocket
  }
}

export default {
  initSocket,
  disconnectSocket,
  getSocket,
  onChatEvent,
  sendTyping,
  requestNotificationPermission,
  showNotification
}
