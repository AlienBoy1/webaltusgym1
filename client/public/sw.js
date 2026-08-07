const CACHE_NAME = 'qyntra-gym-runtime-v3'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
  '/badge-96x96.png',
  '/pwa-192x192.png'
]

function networkFirst(request, { fallbackUrl = null, jsonFallback = null } = {}) {
  return fetch(request)
    .then((response) => {
      if (response && response.ok) {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          try {
            cache.put(request, clone)
          } catch {
            /* ignore */
          }
        })
      }
      return response
    })
    .catch(async () => {
      const cached = await caches.match(request)
      if (cached) return cached
      if (fallbackUrl) {
        const byPath = await caches.match(fallbackUrl)
        if (byPath) return byPath
      }
      if (jsonFallback != null) {
        return new Response(JSON.stringify(jsonFallback), {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
        })
      }
      return new Response('', { status: 503, statusText: 'Service Unavailable' })
    })
}

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

  const url = new URL(event.request.url)

  // Always network version.json — never invent a fake version that triggers UpdateCenter
  if (url.pathname === '/version.json' || url.pathname.endsWith('/version.json')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(async () => {
          const cached = (await caches.match('/version.json')) || (await caches.match(event.request))
          if (cached) return cached
          // Soft fail — do NOT return version:"offline" (causes false update prompts)
          return new Response(JSON.stringify({ error: 'offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
          })
        })
    )
    return
  }

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(
        () =>
          new Response(JSON.stringify({ message: 'Offline' }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          })
      )
    )
    return
  }

  const accept = event.request.headers.get('accept') || ''
  const isDocument =
    event.request.mode === 'navigate' ||
    accept.includes('text/html') ||
    /\.(js|css|html)(\?|$)/.test(url.pathname)

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
        .catch(async () => {
          const cached = await caches.match(event.request)
          if (cached) return cached
          const index = await caches.match('/index.html')
          if (index) return index
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' })
        })
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
      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        .catch(
          () =>
            new Response('Service unavailable', {
              status: 503,
              statusText: 'Service Unavailable'
            })
        )
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
  const fromUserId = data.data?.fromUserId || data.fromUserId || null
  const type = data.data?.type || data.type || null
  const targetUrl =
    data.data?.url ||
    (type === 'message' ? '/chat' : null) ||
    (notificationId ? `/notifications?highlight=${notificationId}` : '/notifications')

  const options = {
    body: data.body || 'Tienes una nueva notificación',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/badge-96x96.png',
    vibrate: [100, 50, 100],
    tag: data.tag || data.data?.tag || undefined,
    renotify: data.renotify === true || Boolean(data.tag || data.data?.tag),
    data: {
      url: targetUrl,
      notificationId,
      type,
      fromUserId
    },
    actions: [
      { action: 'open', title: 'Abrir' },
      { action: 'close', title: 'Cerrar' }
    ]
  }

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true
      })
      let hasVisibleClient = false
      for (const client of clientsList) {
        if (client.visibilityState === 'visible') hasVisibleClient = true
        try {
          client.postMessage({
            type: 'PUSH_INBOX',
            title: data.title || 'QYNTRA GYM',
            body: options.body,
            url: targetUrl,
            notificationId,
            pushType: type,
            fromUserId,
            tag: options.tag || null
          })
          if (type === 'message' && fromUserId) {
            client.postMessage({ type: 'CHAT_DELIVERED_ACK', fromUserId })
          }
        } catch {
          /* ignore */
        }
      }
      // OS banner when no visible tab (background / killed). Avoid double alert when app is open.
      if (!hasVisibleClient) {
        await self.registration.showNotification(data.title || 'QYNTRA GYM', options)
      }
    })()
  )
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
