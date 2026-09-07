import webpush from 'web-push'
import admin from 'firebase-admin'
import { supabaseAdmin } from '../lib/supabase.js'

const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BKqhxXi3gF4rBWR0H75ooRvgJoaJ0826CKVCAMMXEIACI3hINjXBxnYM8421YGiMjT9RlwiKOdNhU0uC5mOQTbE'
const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY || 'KuPVSKnlqggpS3kmd-Gfnwmdez6c6JJ-DBZaPl-IqcY'
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@qyntragym.com'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

let firebaseReady = false

function initFirebaseAdmin() {
  if (firebaseReady) return true
  if (admin.apps.length) {
    firebaseReady = true
    return true
  }

  try {
    const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    if (json) {
      const cred = JSON.parse(json)
      admin.initializeApp({ credential: admin.credential.cert(cred) })
      firebaseReady = true
      return true
    }
    if (path) {
      admin.initializeApp({ credential: admin.credential.cert(path) })
      firebaseReady = true
      return true
    }
  } catch (err) {
    console.error('Firebase Admin init failed:', err.message)
  }
  return false
}

function isFcmSubscription(sub) {
  return Boolean(sub?.type === 'fcm' && sub?.token)
}

function isWebPushSubscription(sub) {
  return Boolean(sub?.endpoint && sub?.keys)
}

async function sendFcm(token, notification) {
  if (!initFirebaseAdmin()) {
    console.error('FCM: FIREBASE_SERVICE_ACCOUNT_JSON/PATH no configurado')
    return false
  }

  const url = notification.data?.url || '/notifications'
  const message = {
    token,
    notification: {
      title: notification.title,
      body: notification.body
    },
    data: {
      url: String(url),
      notificationId: String(notification.data?.notificationId || notification.id || ''),
      type: String(notification.data?.type || ''),
      fromUserId: String(notification.data?.fromUserId || ''),
      tag: String(notification.tag || notification.data?.tag || '')
    },
    android: {
      priority: 'high',
      notification: {
        channelId: 'qyntra_default',
        sound: 'default'
      }
    }
  }

  await admin.messaging().send(message)
  return true
}

async function sendWebPush(subscription, notification) {
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
      type: notification.data?.type || null,
      fromUserId: notification.data?.fromUserId || null,
      tag: notification.tag || notification.data?.tag || undefined
    }
  })

  await webpush.sendNotification(subscription, payload)
  return true
}

export async function sendPushNotification(userId, notification) {
  try {
    const { data: user } = await supabaseAdmin
      .from('profiles')
      .select('push_subscription, settings')
      .eq('id', userId)
      .single()

    if (!user?.push_subscription) return false
    if (user.settings?.notifications?.push === false) return false

    const sub = user.push_subscription
    let ok = false

    if (isFcmSubscription(sub)) {
      ok = await sendFcm(sub.token, notification)
    } else if (isWebPushSubscription(sub)) {
      ok = await sendWebPush(sub, notification)
    } else {
      return false
    }

    if (ok && notification.id) {
      await supabaseAdmin.from('notifications').update({ pushed: true }).eq('id', notification.id)
    }

    return ok
  } catch (error) {
    console.error('Error enviando push notification:', error.message)
    const code = error.statusCode || error.code
    if (code === 410 || code === 404 || code === 'messaging/registration-token-not-registered') {
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
