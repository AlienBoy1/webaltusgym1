import webpush from 'web-push'
import { supabaseAdmin } from '../lib/supabase.js'

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BKqhxXi3gF4rBWR0H75ooRvgJoaJ0826CKVCAMMXEIACI3hINjXBxnYM8421YGiMjT9RlwiKOdNhU0uC5mOQTbE'
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'KuPVSKnlqggpS3kmd-Gfnwmdez6c6JJ-DBZaPl-IqcY'
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@qyntragym.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

export async function sendPushNotification(userId, notification) {
  try {
    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('push_subscription, settings')
      .eq('id', userId)
      .single()

    if (!user?.push_subscription) return false
    if (user.settings?.notifications?.push === false) return false

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: notification.icon || '/pwa-192x192.png',
      badge: notification.badge || '/badge-96x96.png',
      tag: notification.tag || notification.data?.tag || undefined,
      renotify: notification.renotify === true,
      data: {
        url: notification.data?.url || '/notifications',
        notificationId: notification.data?.notificationId || notification.id || null,
        type: notification.data?.type || null
      }
    })

    await webpush.sendNotification(user.push_subscription, payload)

    if (notification.id) {
      await supabaseAdmin.from('notifications').update({ pushed: true }).eq('id', notification.id)
    }

    return true
  } catch (error) {
    console.error('Error enviando push notification:', error.message)
    if (error.statusCode === 410 || error.statusCode === 404) {
      await supabaseAdmin.from('profiles').update({ push_subscription: null }).eq('id', userId)
    }
    return false
  }
}

export async function sendPushToMany(userIds, notification) {
  const results = { sent: 0, failed: 0 }
  for (const userId of userIds) {
    const success = await sendPushNotification(userId, notification)
    if (success) results.sent++
    else results.failed++
  }
  return results
}

export async function sendPushToAll(notification) {
  const { data: users } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .not('push_subscription', 'is', null)

  return sendPushToMany(
    (users || []).map((u) => u.id),
    notification
  )
}

export { VAPID_PUBLIC_KEY }
