/*
 * Clarity's service worker.
 *
 * Its job is to make the app installable and to fail politely when the phone has
 * no signal. It is deliberately NOT an offline-first cache: every page is server
 * rendered per user and every API response is that user's live data, so caching
 * either would mean showing planning data that is quietly out of date — worse
 * than an error, because it looks right.
 *
 * What it therefore caches is only the offline page and Next's build assets,
 * whose URLs contain a content hash and so can never go stale.
 *
 * It also receives web push (Phase 4.3) and opens the right screen when a
 * notification is clicked. Push has nothing to do with the cache: the payload
 * carries its own title, body and destination, and the page it opens is fetched
 * from the network like any other.
 *
 * Registered from components/pwa/ServiceWorkerRegistration.tsx, in production
 * only — a worker holding /_next/static in front of the dev server would serve
 * yesterday's chunks over a hot reload. That also means push cannot be exercised
 * against the dev server.
 */

// Bump when this file's caching or messaging behaviour changes; activate()
// deletes every older cache.
const VERSION = 'v2'
const STATIC_CACHE = `clarity-static-${VERSION}`
const OFFLINE_URL = '/offline.html'

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll([OFFLINE_URL, '/icon-192.png']))
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter(name => name.startsWith('clarity-static-') && name !== STATIC_CACHE)
          .map(name => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

/** Cache-first, for content-hashed assets only. A hit cannot be the wrong version. */
async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE)
    cache.put(request, response.clone())
  }
  return response
}

/** The network, or the offline page — never a cached copy of someone's data. */
async function navigateOrExplain(request) {
  try {
    return await fetch(request)
  } catch {
    const offline = await caches.match(OFFLINE_URL)
    return offline ?? new Response('Offline', { status: 503, statusText: 'Offline' })
  }
}

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(navigateOrExplain(request))
    return
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(cacheFirst(request))
  }

  // Everything else — API routes, RSC payloads, images — goes straight to the
  // network by not being handled here at all.
})

// ── Web push ────────────────────────────────────────────────────────────────

self.addEventListener('push', event => {
  // A push with no data is a keepalive from some services — nothing to show.
  if (!event.data) return

  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    // Anything that is not our JSON still deserves to be seen rather than
    // dropped, since a push that shows nothing looks like a broken app.
    payload = { title: 'Clarity', body: event.data.text() }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Clarity', {
      body: payload.body || '',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // Same tag replaces rather than stacks — two updates about one task are
      // one notification.
      tag: payload.tag || undefined,
      data: { url: payload.url || '/dashboard' },
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/dashboard'

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })

      // Already looking at it — just bring it forward.
      for (const client of windows) {
        if (new URL(client.url).pathname === target) return client.focus()
      }
      // Open somewhere else — reuse the window rather than piling up tabs.
      if (windows.length > 0) {
        await windows[0].focus()
        return windows[0].navigate(target)
      }
      return self.clients.openWindow(target)
    })()
  )
})
