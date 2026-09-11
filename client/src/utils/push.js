import api from './api'
import { isNativeApp } from './appMode'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i)
  return outputArray
}

async function getRegistration() {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration()
  if (reg) return reg
  return navigator.serviceWorker.register('/sw.js')
}

export async function isPushSupported() {
  if (typeof window === 'undefined') return false
  if (isNativeApp()) return true
  return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window
}

async function subscribeNativeFcm() {
  const { Capacitor } = await import('@capacitor/core')
  if (!Capacitor.isPluginAvailable('PushNotifications')) {
    const { recoverNativeLocalOrigin, isNativeOnRemoteOrigin } = await import('./nativeOrigin')
    if (isNativeOnRemoteOrigin()) {
      await recoverNativeLocalOrigin({ next: '/settings?section=notifications' })
      throw new Error('Reabriendo la app nativa para activar notificaciones…')
    }
    throw new Error('Notificaciones nativas no disponibles. Cierra la app por completo y ábrela de nuevo.')
  }

  const { PushNotifications } = await import('@capacitor/push-notifications')

  let perm = await PushNotifications.checkPermissions()
  if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
    perm = await PushNotifications.requestPermissions()
  }
  if (perm.receive !== 'granted') {
    throw new Error('Permiso de notificaciones denegado')
  }

  const tokenPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout esperando token FCM'))
    }, 20000)

    PushNotifications.addListener('registration', (ev) => {
      clearTimeout(timeout)
      resolve(ev?.value || '')
    }).catch(reject)

    PushNotifications.addListener('registrationError', (err) => {
      clearTimeout(timeout)
      reject(new Error(err?.error || 'Error registrando FCM'))
    }).catch(() => {})
  })

  await PushNotifications.register()
  const token = await tokenPromise

  if (!token) throw new Error('No se obtuvo token FCM')

  await PushNotifications.addListener('pushNotificationReceived', (notification) => {
    try {
      const data = notification?.data || {}
      const type = data.type || data.pushType
      const fromUserId = data.fromUserId || data.from_user_id
      if (type === 'message' && fromUserId) {
        window.dispatchEvent(
          new CustomEvent('qyntra:native-chat-push', {
            detail: {
              fromUserId,
              title: notification?.title || data.title || data.fromName,
              body: notification?.body || data.body,
              tag: data.tag || `msg-${fromUserId}`
            }
          })
        )
      }
    } catch {
      /* ignore */
    }
  })
  await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    const data = action?.notification?.data || {}
    const actionId = action?.actionId
    const fromUserId = data.fromUserId || data.from_user_id
    if (actionId === 'mark-read' && fromUserId) {
      window.dispatchEvent(
        new CustomEvent('qyntra:chat-mark-read', { detail: { fromUserId } })
      )
      return
    }
    const url =
      data.url ||
      (fromUserId ? `/chat?peer=${fromUserId}` : null) ||
      action?.notification?.data?.url
    if (url && typeof window !== 'undefined') {
      window.location.assign(url.startsWith('/') ? url : `/${url}`)
    }
  })

  await api.post('/notifications/subscribe', {
    subscription: { type: 'fcm', token, platform: 'android' }
  })
  return { type: 'fcm', token }
}

async function subscribeWebPush() {
  if (!(await isPushSupported())) {
    throw new Error('Push no soportado en este dispositivo')
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    throw new Error('Permiso de notificaciones denegado')
  }

  const { data } = await api.get('/notifications/vapid-public-key')
  const publicKey = data.publicKey
  if (!publicKey) throw new Error('Clave VAPID no disponible')

  const reg = await getRegistration()
  let subscription = await reg.pushManager.getSubscription()
  if (!subscription) {
    subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    })
  }

  await api.post('/notifications/subscribe', { subscription: subscription.toJSON() })
  return subscription
}

export async function subscribeToPush() {
  if (isNativeApp()) return subscribeNativeFcm()
  return subscribeWebPush()
}

export async function unsubscribeFromPush() {
  if (isNativeApp()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications')
      await PushNotifications.removeAllListeners()
    } catch {
      /* ignore */
    }
    try {
      await api.delete('/notifications/subscribe')
    } catch {
      /* ignore */
    }
    return
  }

  if (!(await isPushSupported())) return
  const reg = await navigator.serviceWorker.getRegistration()
  const subscription = await reg?.pushManager?.getSubscription()
  if (subscription) await subscription.unsubscribe()
  try {
    await api.delete('/notifications/subscribe')
  } catch {
    /* ignore */
  }
}
