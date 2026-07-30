import api from './api'

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
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  )
}

export async function subscribeToPush() {
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

export async function unsubscribeFromPush() {
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
