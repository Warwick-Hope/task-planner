import { test, expect } from '@playwright/test'

/**
 * Push subscriptions: the API surface, and the boundary that matters.
 *
 * What this cannot cover is delivery. The worker is registered in production
 * builds only, so the dev server never has one, and a real push needs a live
 * push service and a browser registration — see PLAN.md §Verification for how
 * that half is checked.
 *
 * What it can cover is everything that decides whether storing a subscription is
 * safe: that it needs a session, that a malformed endpoint is refused, that
 * re-registering a device does not duplicate it, and — the ones worth the effort
 * — that one account can neither delete another account's devices nor read them
 * through the function the assignment route uses.
 */

/** A synthetic endpoint. Marked so teardown can find it if a test dies early. */
function e2eEndpoint(label: string): string {
  return `https://fcm.googleapis.com/e2e/${label}-${Date.now()}`
}

const KEYS = {
  // Not real crypto material — nothing here ever encrypts a payload, because no
  // test asks the server to push. Shaped like the real thing so validation is
  // exercised honestly.
  p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM',
  auth: 'tBHItJI5svbpez7KI4CCXg',
}

/**
 * Signs in to Supabase directly, the way global.teardown.ts does.
 *
 * Needed because the app has no endpoint that lists your devices — and the
 * questions here are about what a row looks like in the database after a request,
 * which the API cannot answer without one.
 */
async function supabaseSession(which: 'owner' | 'invitee') {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = which === 'owner' ? process.env.E2E_USER_EMAIL : process.env.E2E_USER2_EMAIL
  const password =
    which === 'owner' ? process.env.E2E_USER_PASSWORD : process.env.E2E_USER2_PASSWORD

  expect(url && key && email && password, 'Supabase and E2E credentials must be set').toBeTruthy()

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key as string, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const auth = await res.json()
  expect(auth.access_token, `could not sign ${which} in to Supabase`).toBeTruthy()

  const headers = {
    apikey: key as string,
    Authorization: `Bearer ${auth.access_token}`,
    'Content-Type': 'application/json',
  }

  return {
    userId: auth.user.id as string,
    /** How many subscription rows this account can see for one endpoint. */
    async countSubscriptions(endpoint: string): Promise<number> {
      const query = `${url}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}&select=id`
      const listed = await fetch(query, { headers })
      expect(listed.ok, `listing subscriptions failed: ${listed.status}`).toBe(true)
      return ((await listed.json()) as unknown[]).length
    },
    /** The personal workspace this account belongs to. */
    async firstWorkspaceId(): Promise<string> {
      const listed = await fetch(`${url}/rest/v1/workspace_members?select=workspace_id`, { headers })
      expect(listed.ok).toBe(true)
      const rows = (await listed.json()) as { workspace_id: string }[]
      expect(rows.length, 'account has no workspace').toBeGreaterThan(0)
      return rows[0].workspace_id
    },
    async callGetSubscriptionsFor(userId: string, workspaceId: string) {
      const res = await fetch(`${url}/rest/v1/rpc/get_push_subscriptions_for_member`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ p_user_id: userId, p_workspace_id: workspaceId }),
      })
      return { status: res.status, rows: (await res.json()) as unknown[] }
    },
  }
}

test.describe('push subscriptions', () => {
  test('an anonymous registration never reaches the route', async ({ browser }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const res = await anonymous.request.post('/api/push/subscribe', {
      data: { endpoint: e2eEndpoint('anon'), keys: KEYS },
    })

    // Note what this asserts and what it does not. The route returns 401 when it
    // is reached without a session — but it never is, because the middleware
    // matcher covers /api and redirects every unauthenticated request to /login.
    // So the honest assertion is the redirect, not the status code. (That the
    // whole API answers HTML to a session-less caller is app-wide behaviour, not
    // something this route chose — see KB.md #37.)
    expect(res.url(), 'expected the login redirect').toContain('/login')
    await anonymous.close()
  })

  test('malformed subscriptions are refused', async ({ request }) => {
    const cases: Array<[string, Record<string, unknown>]> = [
      ['no endpoint', { keys: KEYS }],
      ['no keys', { endpoint: e2eEndpoint('nokeys') }],
      ['half the keys', { endpoint: e2eEndpoint('halfkeys'), keys: { p256dh: KEYS.p256dh } }],
      ['not a URL', { endpoint: 'not-a-url', keys: KEYS }],
      ['not https', { endpoint: 'http://fcm.googleapis.com/e2e/insecure', keys: KEYS }],
    ]

    for (const [label, data] of cases) {
      const res = await request.post('/api/push/subscribe', { data })
      expect(res.status(), `${label} should be rejected`).toBe(400)
    }
  })

  test('re-registering the same device updates it rather than duplicating it', async ({
    request,
  }) => {
    const endpoint = e2eEndpoint('upsert')
    const owner = await supabaseSession('owner')

    const first = await request.post('/api/push/subscribe', { data: { endpoint, keys: KEYS } })
    expect(first.ok(), `subscribe failed: ${first.status()}`).toBe(true)
    expect(await owner.countSubscriptions(endpoint)).toBe(1)

    // The browser hands back the same subscription on a second subscribe(), so
    // this is the normal path on every visit rather than an edge case.
    const second = await request.post('/api/push/subscribe', { data: { endpoint, keys: KEYS } })
    expect(second.ok(), `re-subscribe failed: ${second.status()}`).toBe(true)
    expect(await owner.countSubscriptions(endpoint), 'a second subscribe duplicated it').toBe(1)

    const removed = await request.delete('/api/push/subscribe', { data: { endpoint } })
    expect(removed.ok()).toBe(true)
    expect(await owner.countSubscriptions(endpoint)).toBe(0)

    // Deleting again is how a device that was already gone behaves. It must not 500.
    const again = await request.delete('/api/push/subscribe', { data: { endpoint } })
    expect(again.ok()).toBe(true)
  })

  test('the test notification only ever reaches your own devices', async ({ request }) => {
    // The route exists because push is otherwise untestable by one person: an
    // assignment to yourself notifies nobody. What matters is that it cannot be
    // aimed anywhere else — it takes no arguments, and reads the caller's own
    // rows under RLS.
    const endpoint = e2eEndpoint('self-test')
    const owner = await supabaseSession('owner')

    const withNoDevices = await request.post('/api/push/test')
    expect(withNoDevices.ok(), `test send failed: ${withNoDevices.status()}`).toBe(true)
    expect((await withNoDevices.json()).delivered, 'reported a delivery with no devices').toBe(0)

    // With a dead endpoint registered, the send is attempted for real and the
    // push service answers 404 — so nothing is delivered and the row is retired.
    const registered = await request.post('/api/push/subscribe', { data: { endpoint, keys: KEYS } })
    expect(registered.ok()).toBe(true)

    const withDeadDevice = await request.post('/api/push/test')
    expect(withDeadDevice.ok()).toBe(true)
    expect((await withDeadDevice.json()).delivered).toBe(0)
    expect(
      await owner.countSubscriptions(endpoint),
      'a 404 from the push service should have retired the endpoint'
    ).toBe(0)
  })

  test('a dead subscription cannot break the assignment that triggered it', async ({
    request,
    browser,
  }) => {
    // The one test that exercises the send path for real. The endpoint is
    // syntactically valid and belongs to nobody, so the push service answers 404
    // — which is exactly the case that matters: a device that has been wiped or
    // uninstalled must not stop a task being assigned.
    const householdName = `[e2e] push household ${Date.now()}`
    const inviteeEmail = process.env.E2E_USER2_EMAIL
    expect(inviteeEmail, 'E2E_USER2_EMAIL must be set').toBeTruthy()

    const created = await request.post('/api/household', { data: { name: householdName } })
    expect(created.ok(), `household create failed: ${created.status()}`).toBe(true)
    const { workspaceId } = await created.json()

    const invited = await request.post(`/api/household/${workspaceId}/invite`, {
      data: { email: inviteeEmail, role: 'adult' },
    })
    expect(invited.ok(), `invite failed: ${invited.status()}`).toBe(true)
    const { token } = await invited.json()

    // A new household every run, because accept_household_invitation refuses a
    // second acceptance — see KB.md #14.
    const inviteeContext = await browser.newContext({ storageState: 'e2e/.auth/user2.json' })
    const inviteePage = await inviteeContext.newPage()
    await inviteePage.goto(`/invite/${token}`)
    await inviteePage.getByRole('button', { name: 'Accept invitation' }).click()
    await inviteePage.waitForURL(`**/household/${workspaceId}`, { timeout: 20_000 })

    // The invitee registers a device that will never accept a push.
    const endpoint = e2eEndpoint('dead')
    const registered = await inviteeContext.request.post('/api/push/subscribe', {
      data: { endpoint, keys: KEYS },
    })
    expect(registered.ok(), `invitee subscribe failed: ${registered.status()}`).toBe(true)

    const invitee = await supabaseSession('invitee')
    expect(await invitee.countSubscriptions(endpoint)).toBe(1)

    // Owner creates a household task and assigns it to the invitee.
    const task = await request.post(`/api/household/${workspaceId}/tasks`, {
      data: { title: `[e2e] push assignment ${Date.now()}` },
    })
    expect(task.ok(), `task create failed: ${task.status()} ${await task.text()}`).toBe(true)
    const { id: taskId } = await task.json()

    const assigned = await request.post(
      `/api/household/${workspaceId}/tasks/${taskId}/assign`,
      { data: { type: 'member', assignTo: invitee.userId } }
    )
    expect(
      assigned.ok(),
      `assignment failed because of the push: ${assigned.status()} ${await assigned.text()}`
    ).toBe(true)

    // And the dead endpoint has been cleared out, which is the other half of the
    // behaviour: a 404 from the push service retires the subscription.
    expect(
      await invitee.countSubscriptions(endpoint),
      'a 404 from the push service should have removed the subscription'
    ).toBe(0)

    await inviteeContext.close()
  })

  test('another account can neither delete nor read your devices', async ({ request, browser }) => {
    const endpoint = e2eEndpoint('cross-account')
    const owner = await supabaseSession('owner')
    const invitee = await supabaseSession('invitee')

    const created = await request.post('/api/push/subscribe', { data: { endpoint, keys: KEYS } })
    expect(created.ok()).toBe(true)

    // ── delete ────────────────────────────────────────────────────────────────
    // The route scopes by user_id and RLS scopes it again, so this reports
    // success while changing nothing. The row is what proves it.
    const inviteeContext = await browser.newContext({ storageState: 'e2e/.auth/user2.json' })
    const attempt = await inviteeContext.request.delete('/api/push/subscribe', {
      data: { endpoint },
    })
    expect(attempt.ok(), 'the request itself is well-formed').toBe(true)
    await inviteeContext.close()

    expect(
      await owner.countSubscriptions(endpoint),
      'another account deleted the owner’s subscription'
    ).toBe(1)

    // ── read, directly ────────────────────────────────────────────────────────
    expect(
      await invitee.countSubscriptions(endpoint),
      'another account can read the owner’s subscription rows'
    ).toBe(0)

    // ── read, through the function the assignment route uses ──────────────────
    // get_push_subscriptions_for_member is security definer, so RLS does not
    // apply inside it: the membership checks in its body are the only thing
    // standing between one account and another's devices.
    const ownersWorkspace = await owner.firstWorkspaceId()
    const leaked = await invitee.callGetSubscriptionsFor(owner.userId, ownersWorkspace)
    expect(leaked.status, 'the RPC should answer, not error').toBe(200)
    expect(
      leaked.rows,
      'the RPC returned another account’s endpoints to a non-member'
    ).toEqual([])

    const ownerDelete = await request.delete('/api/push/subscribe', { data: { endpoint } })
    expect(ownerDelete.ok()).toBe(true)
    expect(await owner.countSubscriptions(endpoint)).toBe(0)
  })
})
