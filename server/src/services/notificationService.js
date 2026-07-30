import { supabaseAdmin } from '../lib/supabase.js'
import { mapNotification } from '../lib/mappers.js'
import { sendPushNotification, sendPushToMany } from './pushService.js'

function inboxUrl(notificationId) {
  return `/notifications?highlight=${notificationId}`
}

/**
 * Insert in-app notification and send native Web Push (best-effort).
 */
export async function notifyUser({
  userId,
  type,
  title,
  body,
  icon = '🔔',
  relatedUserId = null,
  relatedData = null,
  priority = 'normal',
  pushTag = null,
  pushUrl = null
}) {
  if (!userId) return null

  const { data, error } = await supabaseAdmin
    .from('notifications')
    .insert({
      user_id: userId,
      type,
      title,
      body,
      icon,
      related_user_id: relatedUserId,
      related_data: relatedData,
      priority
    })
    .select('*')
    .single()

  if (error) {
    console.error('notifyUser insert error:', error.message)
    return null
  }

  const mapped = mapNotification(data)
  const url = pushUrl || inboxUrl(data.id)

  // Non-blocking push
  sendPushNotification(userId, {
    id: data.id,
    title,
    body,
    icon: '/pwa-192x192.png',
    data: {
      url,
      notificationId: data.id,
      type,
      tag: pushTag || undefined
    },
    tag: pushTag || undefined,
    renotify: Boolean(pushTag)
  }).catch(() => {})

  return mapped
}

export async function notifyMany(userIds, payload) {
  const unique = [...new Set((userIds || []).filter(Boolean))]
  const results = []
  for (const userId of unique) {
    results.push(await notifyUser({ ...payload, userId }))
  }
  return results
}

/** Notify all profiles except optional excludeId (for public challenges / new classes). */
export async function notifyAllUsers(payload, { excludeId = null } = {}) {
  const { data: users } = await supabaseAdmin.from('profiles').select('id')
  const ids = (users || []).map((u) => u.id).filter((id) => id !== excludeId)
  // Fire in background batches
  process.nextTick(async () => {
    const batchSize = 15
    for (let i = 0; i < ids.length; i += batchSize) {
      await Promise.all(ids.slice(i, i + batchSize).map((userId) => notifyUser({ ...payload, userId })))
    }
  })
  return { queued: ids.length }
}

/**
 * Chat: keep a single unread message notification per sender + push with unread count.
 */
export async function notifyNewMessage({ toUserId, fromUserId, fromName, content }) {
  const { count } = await supabaseAdmin
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('from_user_id', fromUserId)
    .eq('to_user_id', toUserId)
    .eq('read', false)

  const unread = count || 1
  const preview = content.length > 80 ? `${content.slice(0, 77)}…` : content
  const body =
    unread > 1 ? `${preview} · ${unread} mensajes sin leer` : preview

  // Replace previous unread message notifs from this sender
  await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('user_id', toUserId)
    .eq('type', 'message')
    .eq('related_user_id', fromUserId)
    .eq('read', false)

  return notifyUser({
    userId: toUserId,
    type: 'message',
    title: fromName || 'Nuevo mensaje',
    body,
    icon: '💬',
    relatedUserId: fromUserId,
    relatedData: { unreadCount: unread },
    priority: 'high',
    pushTag: `msg-${fromUserId}`,
    pushUrl: null // inbox highlight
  })
}

export { sendPushToMany }
