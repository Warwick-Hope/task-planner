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
  // otherwise surface as an unhelpful navigation timeout.
  const error = page.locator('p.text-red-600')
  await Promise.race([
    page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 15_000 }),
    error.waitFor({ state: 'visible', timeout: 15_000 }).then(async () => {
      throw new Error(`Sign-in failed: ${await error.innerText()}`)
    }),
  ])

  fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
  await page.context().storageState({ path: AUTH_FILE })
  expect(fs.existsSync(AUTH_FILE)).toBe(true)
})
