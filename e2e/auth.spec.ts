import { test, expect } from '@playwright/test'

test.describe('authentication', () => {
  // These assertions are about being logged OUT, so they must not inherit the
  // shared signed-in session.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('an unauthenticated visitor is redirected to login, keeping their destination', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL('/login?next=%2Fdashboard')
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible()
  })

  test('the invite page renders for a logged-out visitor rather than redirecting', async ({ page }) => {
    // Regression test for the middleware bug that made every emailed invite link
    // bounce to /login. An unknown token is fine — what matters is that the page
    // renders at all, which also proves the get_invitation_by_token RPC is
    // reachable anonymously.
    await page.goto('/invite/not-a-real-token')
    await expect(page).toHaveURL(/\/invite\//)
    await expect(page.getByRole('heading', { name: 'Invalid invite link' })).toBeVisible()
  })

  test('a wrong password is reported, not swallowed', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('Email').fill(process.env.E2E_USER_EMAIL ?? 'nobody@example.com')
    await page.getByLabel('Password').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()

    await expect(page.locator('p.text-red-600')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('sign in with Google (Phase 4.4)', () => {
  /**
   * The provider itself cannot be exercised here — that would mean driving
   * Google's own sign-in from a test account, which is somebody else's UI and a
   * second set of credentials to keep. What is testable is the wiring: the
   * button exists on both pages, and pressing it leaves for **Supabase's**
   * authorize endpoint with the callback this app will actually be returned to.
   *
   * Everything after that redirect is Supabase's and Google's, and the return
   * leg — `/api/auth/callback` exchanging a code for a session — is the same
   * route an email confirmation already uses and is already covered by the
   * invitee sign-in in the setup project.
   */
  for (const path of ['/login', '/signup']) {
    test(`${path} offers Google alongside the password form`, async ({ browser }) => {
      const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
      const page = await anon.newPage()
      await page.goto(path)

      await expect(page.getByRole('button', { name: 'Continue with Google' })).toBeVisible()
      // Additive, not a replacement: the password path must still be there.
      await expect(page.getByLabel('Email')).toBeVisible()
      await expect(page.getByLabel('Password')).toBeVisible()

      await anon.close()
    })
  }

  test('the button leaves for Supabase with a callback on this origin', async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const page = await anon.newPage()

    // Stop at Supabase rather than following it to Google: the assertion is
    // about what this app asked for, and hitting a real identity provider from
    // a test suite is a flake waiting to happen.
    let authorizeUrl: string | null = null
    await page.route('**/auth/v1/authorize*', async route => {
      authorizeUrl = route.request().url()
      await route.abort()
    })

    await page.goto('/login?next=%2Fplan')
    await page.getByRole('button', { name: 'Continue with Google' }).click()
    await expect.poll(() => authorizeUrl, { timeout: 15_000 }).not.toBeNull()

    const asked = new URL(authorizeUrl!)
    expect(asked.searchParams.get('provider')).toBe('google')

    const redirectTo = new URL(asked.searchParams.get('redirect_to')!)
    expect(redirectTo.pathname).toBe('/api/auth/callback')
    // `next` survives the round trip, which is what lets a link that sent
    // someone to sign in still land where it meant to.
    expect(redirectTo.searchParams.get('next')).toBe('/plan')

    await anon.close()
  })
})

test('a signed-in user reaches the dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/dashboard')
})
