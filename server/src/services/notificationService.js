import { supabaseAdmin } from '../lib/supabase.js'
import { mapNotification } from '../lib/mappers.js'
import { sendPushNotification, sendPushToMany } from './pushService.js'
import {
  FREE_ERA_END_ISO,
  freeEraDaysRemaining,
  freeEraEndLabel,
  isPastFreeEra,
  mexicoCityDayKey
} from '../utils/membershipLifecycle.js'

function inboxUrl(notificationId) {
  return `/notifications?highlight=${notificationId}`
}

/**
 * Insert in-app notification and send native Web Push (best-effort).
 * Pass skipInbox:true for device-only alerts (chat messages).
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
  pushUrl = null,
  skipInbox = false
}) {
  if (!userId) return null

  let mapped = null
  let notificationId = null

  if (!skipInbox) {
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

    mapped = mapNotification(data)
    notificationId = data.id
  }

  const url = pushUrl || (notificationId ? inboxUrl(notificationId) : '/notifications')

  // Non-blocking push
  sendPushNotification(userId, {
    id: notificationId,
    title,
    body,
    icon: '/pwa-192x192.png',
    data: {
      url,
      notificationId,
      type,
      tag: pushTag || undefined,
      fromUserId: relatedUserId || relatedData?.fromUserId || null,
      fromName: title
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
 * Chat: device push only (no in-app notification inbox rows).
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

  // Collapse any legacy unread message inbox rows from this sender
  await supabaseAdmin
    .from('notifications')
    .delete()
    .eq('user_id', toUserId)
    .eq('type', 'message')
    .eq('related_user_id', fromUserId)

  return notifyUser({
    userId: toUserId,
    type: 'message',
    title: fromName || 'Nuevo mensaje',
    body,
    icon: '💬',
    relatedUserId: fromUserId,
    relatedData: { unreadCount: unread, fromUserId },
    priority: 'high',
    pushTag: `msg-${fromUserId}`,
    pushUrl: `/chat?peer=${fromUserId}`,
    skipInbox: true
  })
}

export async function notifyFreeMembershipCountdown(userId, membership = {}) {
  if (!userId) return null
  if (membership?.__paidEra === true || membership?.era === 'paid') return null

  // Always replace ANY prior membership countdown rows (read or unread)
  // so each login shows a fresh card with updated days remaining.
  try {
    const { data: existing } = await supabaseAdmin
      .from('notifications')
      .select('id, related_data, type')
      .eq('user_id', userId)
      .eq('type', 'membership')

    const staleIds = (existing || [])
      .filter((row) => {
        const kind = row.related_data?.kind
        return !kind || kind === 'free_era_days'
      })
      .map((row) => row.id)

    if (staleIds.length) {
      await supabaseAdmin.from('notifications').delete().in('id', staleIds)
    }
  } catch (err) {
    console.warn('notifyFreeMembershipCountdown cleanup:', err?.message || err)
  }

  if (isPastFreeEra()) {
    return notifyUser({
      userId,
      type: 'membership',
      title: 'Periodo gratuito finalizado',
      body: `Tu membresía gratuita venció el ${freeEraEndLabel()}. Pronto se habilitarán los planes de pago.`,
      icon: '💳',
      priority: 'high',
      relatedData: {
        kind: 'free_era_days',
        daysLeft: 0,
        freeEndsAt: FREE_ERA_END_ISO,
        dayKey: mexicoCityDayKey(),
        expired: true
      },
      pushTag: 'membership-free-era',
      pushUrl: '/profile'
    })
  }

  const daysLeft = freeEraDaysRemaining()
  const dayWord = daysLeft === 1 ? 'día' : 'días'
  const title =
    daysLeft <= 0
      ? 'Periodo gratuito por vencer'
      : `Membresía gratuita: ${daysLeft} ${dayWord} restantes`
  const body =
    daysLeft <= 0
      ? `Tu acceso gratuito vence hoy (${freeEraEndLabel()}).`
      : `Te quedan ${daysLeft} ${dayWord} de membresía gratuita. Vence el ${freeEraEndLabel()}.`

  return notifyUser({
    userId,
    type: 'membership',
    title,
    body,
    icon: '💳',
    priority: daysLeft <= 30 ? 'high' : 'normal',
    relatedData: {
      kind: 'free_era_days',
      daysLeft,
      freeEndsAt: FREE_ERA_END_ISO,
      dayKey: mexicoCityDayKey(),
      expired: false
    },
    pushTag: 'membership-free-era',
    pushUrl: '/profile'
  })
}

export { sendPushToMany }
