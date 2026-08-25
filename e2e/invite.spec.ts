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
  const { token, inviteUrl } = await invited.json()
  expect(token).toBeTruthy()

  // The link is pasted into a message and opened on someone else's device, so a
  // path is not enough. It shipped as a bare `/invite/<token>` in production:
  // this spec only ever used the token, and locally NEXT_PUBLIC_APP_URL is set,
  // so the old code looked correct here and was broken there. The route now
  // derives the origin from the request headers instead — which is what this
  // assertion exercises, since the environment variable is no longer consulted
  // first.
  const baseURL = test.info().project.use.baseURL as string
  expect(inviteUrl, 'invite link must be absolute').toBe(`${baseURL}/invite/${token}`)

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

/**
 * The restricted-member rules, which are enforced in the route layer rather than
 * by RLS — RLS checks membership, not role. The security spec flagged this as
 * untested because it needs a second account in a second role; it does now.
 *
 * Includes the one deliberately nuanced rule: a restricted member may tick a
 * shopping item off, but may not rename it. That distinction exists only in
 * app/api/household/[id]/shopping/[itemId], so nothing else would catch it
 * regressing.
 */
test('a restricted member can read but not write', async ({ request, browser }) => {
  const householdName = `[e2e] restricted household ${Date.now()}`
  const inviteeEmail = process.env.E2E_USER2_EMAIL

  const created = await request.post('/api/household', { data: { name: householdName } })
  expect(created.ok()).toBe(true)
  const { workspaceId } = await created.json()

  const invited = await request.post(`/api/household/${workspaceId}/invite`, {
    data: { email: inviteeEmail, role: 'restricted' },
  })
  expect(invited.ok(), `invite failed: ${invited.status()}`).toBe(true)
  const { token } = await invited.json()

  const context = await browser.newContext({ storageState: INVITEE_STATE })
  const memberPage = await context.newPage()
  await memberPage.goto(`/invite/${token}`)
  await memberPage.getByRole('button', { name: 'Accept invitation' }).click()
  await memberPage.waitForURL(`**/household/${workspaceId}`, { timeout: 20_000 })

  const asRestricted = context.request
  const base = `/api/household/${workspaceId}`

  // Reads are allowed.
  expect((await asRestricted.get(`${base}/rooms`)).status(), 'reading rooms').toBe(200)

  // Writes are not.
  for (const [label, call] of [
    ['create a room', () => asRestricted.post(`${base}/rooms`, { data: { name: 'Kitchen' } })],
    ['create a meal', () => asRestricted.post(`${base}/meals`, { data: { name: 'Pasta' } })],
    ['add a child profile', () => asRestricted.post(`${base}/profiles`, { data: { name: 'Child' } })],
    ['clear the shopping list', () => asRestricted.delete(`${base}/shopping?purchased=true`)],
  ] as const) {
    expect((await call()).status(), `restricted member should not ${label}`).toBe(403)
  }

  // The nuanced rule: ticking off is allowed, renaming is not.
  const item = await request.post(`${base}/shopping`, { data: { name: '[e2e] milk' } })
  expect(item.ok(), `owner could not add a shopping item: ${item.status()}`).toBe(true)
  const { item: created_item } = await item.json()

  expect(
    (await asRestricted.patch(`${base}/shopping/${created_item.id}`, { data: { is_purchased: true } })).status(),
    'restricted member should be able to tick an item off'
  ).toBe(200)

  expect(
    (await asRestricted.patch(`${base}/shopping/${created_item.id}`, { data: { name: 'renamed' } })).status(),
    'restricted member should not be able to rename an item'
  ).toBe(403)

  await context.close()
})
