'use client'

import { useEffect } from 'react'

/**
 * Registers public/sw.js. Rendered once, from the root layout.
 *
 * **Production only.** The worker serves `/_next/static/` cache-first, which is
 * safe because those URLs are content-hashed — but the dev server's chunks are
 * not, so a worker in development would hold stale JavaScript in front of a hot
 * reload. That also means the Playwright suite, which runs against `npm run dev`,
 * never registers it; the registration is verified against a production build
 * instead (PLAN.md §Verification).
 *
 * Registration waits for `load` so it never competes with the first render for
 * bandwidth on a phone.
 */
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    function register() {
      // A failure here is not worth surfacing: the app works without it, and the
      // usual cause is a private window where the API exists but is inert.
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }

    if (document.readyState === 'complete') {
      register()
      return
    }
    window.addEventListener('load', register)
    return () => window.removeEventListener('load', register)
  }, [])

  return null
}
