import { test as setup, expect } from '@playwright/test'
import fs from 'fs'
import path from 'path'

const AUTH_FILE = 'e2e/.auth/user.json'

/**
 * Signs in once and saves the session for every other spec to reuse.
 *
 * The account is a dedicated one — never Warwick's own — because the specs
 * create and delete real rows in the dev workspace. Email confirmation is
 * enabled on the dev project, so tests cannot register a user on the fly: this
 * account has to exist and be confirmed before the suite will run.
 */
setup('authenticate', async ({ page }) => {
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!email || !password) {
    throw new Error(
      'E2E_USER_EMAIL and E2E_USER_PASSWORD are not set.\n' +
        'Locally they live in .env.local; in CI they come from repository secrets.'
    )
  }

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // A failed sign-in renders the error inline and stays on /login, which would
  // otherwise surface as an unhelpful navigation timeout. Both branches swallow
  // their own timeout so the loser of the race cannot reject after the test ends.
  const inlineError = page.locator('p.text-red-600')
  const outcome = await Promise.race([
    page
      .waitForURL(/\/(dashboard|onboarding)/, { timeout: 20_000 })
      .then(() => 'navigated' as const)
      .catch(() => 'timeout' as const),
    inlineError
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => 'rejected' as const)
      .catch(() => 'timeout' as const),
  ])

  if (outcome === 'rejected') {
    throw new Error(`Sign-in failed: ${await inlineError.innerText()}`)
  }
  if (outcome === 'timeout') {
    throw new Error(`Sign-in neither succeeded nor reported an error. Still at ${page.url()}`)
  }

  // A freshly confirmed account has no profile and no personal workspace, so
  // every dashboard route bounces to /onboarding — which made five specs fail
  // for one reason the first time this ran.
  //
  // Do NOT decide this from page.url() straight after sign-in: the client pushes
  // /dashboard first and the server redirects to /onboarding a moment later, so
  // an instant check sees /dashboard and skips the wizard. Navigate explicitly
  // and let the redirect settle before looking.
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  if (page.url().includes('/onboarding')) {
    await page.getByPlaceholder('Your name').fill('E2E Test User')
    await page.getByRole('button', { name: 'Next' }).click()

    // At least one category is required before the wizard will advance, and the
    // name has to be committed with Add — typing it is not enough.
    await page.getByPlaceholder(/e\.g\. Work, Personal, Health/).fill('E2E')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByText('E2E', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()

    // The mission step is optional.
    await page.getByRole('button', { name: 'Skip' }).click()
    await page.waitForURL('**/dashboard', { timeout: 20_000 })
  }

  // Guard against saving a session that cannot actually reach the app: without
  // this, a half-finished onboarding produces a storageState that fails every
  // downstream spec for a reason none of them can explain.
  await page.goto('/tasks')
  await expect(page).toHaveURL(/\/tasks/)

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
  expect(fs.existsSync(AUTH_FILE)).toBe(true)
})
