import { test, expect } from '@playwright/test'
import { INVITEE_STATE } from './helpers'

/**
 * The household invitation flow, end to end and across two accounts.
 *
 * This is the flow the security work rebuilt: the invitations table is no longer
 * readable with the anon key, the landing page resolves its token through the
 * get_invitation_by_token RPC, and middleware has to let a logged-out visitor
 * reach that page at all. Those are three separate things that can each break
 * silently, and only this test exercises them together.
 *
 * A fresh household is created per run and deleted in teardown, so the invitee
 * never stays a member — accept_household_invitation rejects a second attempt
 * with "Already a member of this household", which would make the test pass
 * once and fail forever after.
 */
test('an invited user can accept and reach the household', async ({ page, request, browser }) => {
  const householdName = `[e2e] household ${Date.now()}`
  const inviteeEmail = process.env.E2E_USER2_EMAIL
  expect(inviteeEmail, 'E2E_USER2_EMAIL must be set').toBeTruthy()

  // ── owner creates a household and invites the second account ────────────────
  const created = await request.post('/api/household', { data: { name: householdName } })
  expect(created.ok(), `household create failed: ${created.status()}`).toBe(true)
  const { workspaceId } = await created.json()
  expect(workspaceId).toBeTruthy()

  const invited = await request.post(`/api/household/${workspaceId}/invite`, {
    data: { email: inviteeEmail, role: 'adult' },
  })
  expect(invited.ok(), `invite failed: ${invited.status()}`).toBe(true)
  const { token } = await invited.json()
  expect(token).toBeTruthy()

  // ── the invite page renders for someone who is not signed in ───────────────
  const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const anonPage = await anonymous.newPage()
  await anonPage.goto(`/invite/${token}`)
  await expect(anonPage.getByRole('heading', { name: `Join ${householdName}` })).toBeVisible()
  // Logged out, the page offers sign-in rather than an accept button.
  await expect(anonPage.getByRole('link', { name: 'Sign in' })).toBeVisible()
  await anonymous.close()

  // ── the invitee accepts ────────────────────────────────────────────────────
  const inviteeContext = await browser.newContext({ storageState: INVITEE_STATE })
  const inviteePage = await inviteeContext.newPage()
  await inviteePage.goto(`/invite/${token}`)
  await inviteePage.getByRole('button', { name: 'Accept invitation' }).click()
  await inviteePage.waitForURL(`**/household/${workspaceId}`, { timeout: 20_000 })

  // Membership is the real assertion — a household route the invitee could not
  // reach before now answers for them.
  const asMember = await inviteePage.request.get(`/api/household/${workspaceId}/tasks`)
  expect(asMember.status(), 'invitee should now be a member').toBe(200)
  await inviteeContext.close()

  // ── the token cannot be reused ─────────────────────────────────────────────
  await page.goto(`/invite/${token}`)
  await expect(page.getByRole('heading', { name: 'Already accepted' })).toBeVisible()
})

test('a household route refuses a non-member', async ({ browser, request }) => {
  const householdName = `[e2e] private household ${Date.now()}`

  const created = await request.post('/api/household', { data: { name: householdName } })
  expect(created.ok()).toBe(true)
  const { workspaceId } = await created.json()

  // The invitee is not a member of this one — no invitation was ever sent.
  const outsider = await browser.newContext({ storageState: INVITEE_STATE })
  const response = await outsider.request.get(`/api/household/${workspaceId}/tasks`)
  expect(response.status(), 'a non-member must not read household tasks').toBe(403)
  await outsider.close()
})
