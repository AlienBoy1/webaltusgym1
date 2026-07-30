const CACHE_NAME = 'qyntra-gym-runtime-v2'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/version.json',
  '/badge-96x96.png',
  '/pwa-192x192.png'
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS).catch(() => undefined))
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name)))
      await self.clients.claim()
    })()
  )
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
  if (event.data?.type === 'CLEAR_CACHES') {
    event.waitUntil(caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))))
  }
})

self.addEventListener('fetch', (event) => {
  if (!event.request.url.startsWith(self.location.origin)) return
  if (event.request.method !== 'GET') return

  if (event.request.url.includes('/api/') || event.request.url.includes('/version.json')) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)))
    return
  }

  const accept = event.request.headers.get('accept') || ''
  const isDocument =
    event.request.mode === 'navigate' ||
    accept.includes('text/html') ||
    /\.(js|css|html)(\?|$)/.test(event.request.url)

  if (isDocument) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(() => caches.match(event.request).then((r) => r || caches.match('/index.html')))
    )
    return
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request)
          .then((response) => {
            if (response.ok) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, response))
            }
          })
          .catch(() => {})
        return cachedResponse
      }
      return fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
    })
  )
})

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data?.json() || {}
  } catch {
    data = { body: event.data?.text() || '' }
  }

  const notificationId = data.data?.notificationId || data.notificationId || null
  const targetUrl =
    data.data?.url ||
    (notificationId ? `/notifications?highlight=${notificationId}` : '/notifications')

  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: data.icon || '/pwa-192x192.png',
    // Android status bar requires a monochrome alpha mask (not a full-color icon)
    badge: data.badge || '/badge-96x96.png',
    vibrate: [100, 50, 100],
    tag: data.tag || data.data?.tag || undefined,
    renotify: data.renotify === true || Boolean(data.tag || data.data?.tag),
    data: {
      url: targetUrl,
      notificationId,
      type: data.data?.type || null
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ]
  }

  event.waitUntil(self.registration.showNotification(data.title || 'QYNTRA GYM', options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  if (event.action === 'close') return

  const rawUrl = event.notification.data?.url || '/notifications'
  const absoluteUrl = new URL(rawUrl, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of allClients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.postMessage({
            type: 'NOTIFICATION_CLICK',
            url: rawUrl,
            notificationId: event.notification.data?.notificationId || null
          })
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(absoluteUrl)
      }
    })()
  )
})
