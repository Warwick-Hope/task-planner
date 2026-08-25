/**
 * Production verification for the PWA: does the worker actually register and
 * activate, does Chrome parse the manifest without errors, does a failed
 * navigation land on the offline page, and is anything user-specific ending up
 * in the cache?
 *
 * This cannot live in the Playwright suite, which runs against `npm run dev`
 * where the worker is deliberately not registered. Run it by hand against a
 * production build:
 *
 *   npm run build
 *   npx next start -p 3100      # in another shell
 *   npm run verify:pwa
 *
 * BASE overrides the URL, so it can also be pointed at the deployed site.
 */
import { chromium } from '@playwright/test'

const BASE = process.env.BASE ?? 'http://localhost:3100'
const results = []
const ok = (name, detail = '') => results.push(['PASS', name, detail])
const bad = (name, detail = '') => results.push(['FAIL', name, detail])

const browser = await chromium.launch()
const context = await browser.newContext()
const page = await context.newPage()

await page.goto(`${BASE}/login`, { waitUntil: 'load' })

// 1. Chrome's own parse of the manifest — this is what the install prompt reads.
const client = await context.newCDPSession(page)
const appManifest = await client.send('Page.getAppManifest')
if (appManifest.errors?.length) {
  bad('manifest parses cleanly', JSON.stringify(appManifest.errors))
} else {
  ok('manifest parses cleanly', appManifest.url ?? '')
}

// 2. Registration and activation.
const state = await page.evaluate(async () => {
  const reg = await navigator.serviceWorker.ready
  // `ready` resolves as soon as there is an active worker, which can still be
  // mid-activation while clients.claim() runs — wait it out rather than reading
  // a transient state.
  const sw = reg.active
  if (sw && sw.state !== 'activated') {
    await new Promise(resolve => {
      sw.addEventListener('statechange', () => {
        if (sw.state === 'activated') resolve()
      })
      setTimeout(resolve, 5000)
    })
  }
  return { scope: reg.scope, state: reg.active?.state ?? 'none' }
})
state.state === 'activated'
  ? ok('service worker activated', `scope ${state.scope}`)
  : bad('service worker activated', JSON.stringify(state))

// 3. The offline page, via a genuinely failed navigation.
await context.setOffline(true)
await page.goto(`${BASE}/dashboard`, { waitUntil: 'load' }).catch(() => {})
const offlineHeading = await page.locator('h1').first().textContent().catch(() => null)
offlineHeading?.includes('offline')
  ? ok('offline navigation falls back to the offline page', offlineHeading)
  : bad('offline navigation falls back to the offline page', String(offlineHeading))
await context.setOffline(false)

// 4. Build assets are being served from the cache, and nothing else is cached.
await page.goto(`${BASE}/login`, { waitUntil: 'load' })
const cached = await page.evaluate(async () => {
  const names = await caches.keys()
  const keys = []
  for (const n of names) {
    const c = await caches.open(n)
    for (const req of await c.keys()) keys.push(req.url)
  }
  return { names, keys }
})
const stray = cached.keys.filter(
  u => !u.includes('/_next/static/') && !u.endsWith('/offline.html') && !u.endsWith('/icon-192.png')
)
stray.length === 0
  ? ok('cache holds only hashed build assets and the offline page', `${cached.keys.length} entries`)
  : bad('cache holds only hashed build assets and the offline page', stray.join(', '))

// 5. The manifest and worker still answer with no session (production headers).
for (const path of ['/manifest.webmanifest', '/sw.js']) {
  const res = await context.request.get(`${BASE}${path}`)
  res.status() === 200
    ? ok(`${path} served logged out`, `${res.status()} ${res.headers()['content-type']}`)
    : bad(`${path} served logged out`, String(res.status()))
}

await browser.close()

for (const [status, name, detail] of results) {
  console.log(`${status}  ${name}${detail ? ` — ${detail}` : ''}`)
}
process.exit(results.some(r => r[0] === 'FAIL') ? 1 : 0)
