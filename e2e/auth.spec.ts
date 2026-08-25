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

test('a signed-in user reaches the dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL('/dashboard')
})
