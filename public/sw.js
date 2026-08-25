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
 * Registered from components/pwa/ServiceWorkerRegistration.tsx, in production
 * only — a worker holding /_next/static in front of the dev server would serve
 * yesterday's chunks over a hot reload.
 */

// Bump when this file's caching behaviour changes; activate() deletes the rest.
const VERSION = 'v1'
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
