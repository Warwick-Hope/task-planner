import { test, expect } from '@playwright/test'

/**
 * The install surface: manifest, worker script, offline page, icons.
 *
 * Every assertion here is made **logged out**, because that is where the install
 * breaks. Chrome fetches the manifest and the worker outside any page context,
 * and middleware would otherwise answer a session-less request with a 307 to
 * /login — which is neither a manifest nor JavaScript, so the install fails with
 * no error anyone sees.
 *
 * What this cannot cover is the registration itself: the suite runs against the
 * dev server and the worker is registered in production builds only (see
 * components/pwa/ServiceWorkerRegistration.tsx). That is verified against a real
 * production build instead — PLAN.md §Verification.
 */
test.describe('progressive web app', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('the manifest is served to a visitor with no session', async ({ request }) => {
    const res = await request.get('/manifest.webmanifest')
    expect(res.status()).toBe(200)

    const manifest = await res.json()
    expect(manifest.name).toContain('Clarity')
    expect(manifest.start_url).toBe('/dashboard')
    expect(manifest.display).toBe('standalone')

    // Chrome will not offer to install without a PNG of at least 192px, and
    // needs a maskable icon to avoid a white box inside the launcher shape.
    const png192 = manifest.icons.find(
      (i: { sizes: string; type: string }) => i.sizes === '192x192' && i.type === 'image/png'
    )
    expect(png192, 'no 192px PNG icon — Chrome will not treat this as installable').toBeTruthy()
    expect(
      manifest.icons.some((i: { purpose?: string }) => i.purpose === 'maskable'),
      'no maskable icon'
    ).toBeTruthy()
  })

  test('the service worker script is served as JavaScript, not a redirect', async ({ request }) => {
    const res = await request.get('/sw.js')
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('javascript')
    expect(await res.text()).toContain('clarity-static-')
  })

  test('the offline page and the icons are reachable', async ({ request }) => {
    const offline = await request.get('/offline.html')
    expect(offline.status()).toBe(200)
    expect(await offline.text()).toContain("You're offline")

    for (const icon of ['/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png']) {
      const res = await request.get(icon)
      expect(res.status(), `${icon} is missing`).toBe(200)
      expect(res.headers()['content-type'], `${icon} is not a PNG`).toContain('image/png')
    }
  })

  test('every page links the manifest', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      'href',
      /manifest\.webmanifest/
    )
  })
})
