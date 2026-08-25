import { test as setup, expect, type Page } from '@playwright/test'
import fs from 'fs'
import path from 'path'
import { OWNER_STATE, INVITEE_STATE } from './helpers'


/**
 * Signs each test account in once and saves its session for the specs to reuse.
 *
 * Two accounts, both dedicated — never Warwick's own login, because the specs
 * create and delete real rows in the dev workspace:
 *
 *   owner   — does almost everything
 *   invitee — exists only so the household invitation flow has someone to accept
 *
 * Email confirmation is OFF on dev (deliberately; prod keeps it on), so these
 * accounts can be created without a mailbox. They are fixed rather than
 * per-run: without a service_role key the suite cannot delete auth users, so
 * disposable accounts would accumulate forever. Fresh state per run comes from
 * creating a new household each time and deleting it in teardown instead.
 */
// Sign-in and onboarding run against a cold dev server that compiles routes on
// first hit, and every step is a round trip to Supabase. Measured at 7s on a
// warm local run and 29s on a cold one over a slower connection, which makes the
// default 30s test timeout a coin toss. This is setup, not an assertion about
// speed — give it room.
setup.setTimeout(120_000)

async function signInAndOnboard(page: Page, email: string, password: string, displayName: string) {
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

  if (outcome === 'rejected') throw new Error(`Sign-in failed for ${email}: ${await inlineError.innerText()}`)
  if (outcome === 'timeout') throw new Error(`Sign-in for ${email} neither succeeded nor errored. At ${page.url()}`)

  // A new account has no profile and no personal workspace, so every dashboard
  // route bounces to /onboarding — which made five specs fail for one reason the
  // first time this ran. Accepting an invitation also requires a profile.
  //
  // Do NOT decide this from page.url() straight after sign-in: the client pushes
  // /dashboard and the server redirects to /onboarding a moment later, so an
  // instant check sees /dashboard and skips the wizard. Navigate and let it settle.
  await page.goto('/dashboard')
  await page.waitForLoadState('networkidle')

  if (page.url().includes('/onboarding')) {
    await page.getByPlaceholder('Your name').fill(displayName)
    await page.getByRole('button', { name: 'Next' }).click()

    // At least one category is required, and it has to be committed with Add —
    // typing the name is not enough.
    await page.getByPlaceholder(/e\.g\. Work, Personal, Health/).fill('E2E')
    await page.getByRole('button', { name: 'Add' }).click()
    await expect(page.getByText('E2E', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Next' }).click()

    await page.getByRole('button', { name: 'Skip' }).click()
    await page.waitForURL('**/dashboard', { timeout: 20_000 })
  }

  // Guard against saving a session that cannot reach the app: a half-finished
  // onboarding otherwise produces a storageState that fails every downstream
  // spec for a reason none of them can explain.
  await page.goto('/tasks')
  await expect(page).toHaveURL(/\/tasks/)
}

function credentials(prefix: 'E2E_USER' | 'E2E_USER2') {
  const email = process.env[`${prefix}_EMAIL`]
  const password = process.env[`${prefix}_PASSWORD`]
  if (!email || !password) {
    throw new Error(
      `${prefix}_EMAIL and ${prefix}_PASSWORD are not set.\n` +
        'Locally they live in .env.local; in CI they come from repository secrets.'
    )
  }
  return { email, password }
}

async function save(page: Page, file: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  await page.context().storageState({ path: file })
  expect(fs.existsSync(file)).toBe(true)
}

setup('authenticate owner', async ({ page }) => {
  const { email, password } = credentials('E2E_USER')
  await signInAndOnboard(page, email, password, 'E2E Test User')
  await save(page, OWNER_STATE)
})

setup('authenticate invitee', async ({ page }) => {
  const { email, password } = credentials('E2E_USER2')
  await signInAndOnboard(page, email, password, 'E2E Invitee')
  await save(page, INVITEE_STATE)
})
