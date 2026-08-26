import { test as teardown, expect } from '@playwright/test'

/**
 * Removes everything the suite created, including from runs that failed.
 *
 * Each spec deletes what it makes, but only on the happy path — a test that
 * fails before its cleanup leaves its rows behind, and those accumulate in the
 * real dev workspace. This sweeps anything named "[e2e] …" regardless.
 *
 * It talks to Supabase directly rather than through the app: a household has no
 * delete route, and sweeping by title pattern is not something any endpoint
 * offers — /api/tasks can list since Phase 4.10, but only within one workspace.
 * RLS still applies, so the account can only remove its own rows.
 */

/** PostgREST pattern matching: * is the wildcard, and the brackets need encoding. */
const LIKE_E2E = 'like.%5Be2e%5D*'

teardown('remove rows created by the suite', async () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const email = process.env.E2E_USER_EMAIL
  const password = process.env.E2E_USER_PASSWORD

  if (!url || !key || !email || !password) {
    throw new Error('Supabase URL/key and E2E credentials must be set for teardown')
  }

  const authResponse = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const auth = await authResponse.json()
  expect(auth.access_token, 'teardown could not sign in').toBeTruthy()

  const headers = { apikey: key, Authorization: `Bearer ${auth.access_token}` }

  /**
   * Deletes every row in `table` whose `column` matches the marker pattern.
   * The column differs by table — tasks are titled, workspaces are named, and a
   * push subscription is only identifiable by its endpoint, which is why the
   * pattern is overridable.
   */
  async function sweep(
    table: string,
    column: string,
    label: string,
    pattern: string = LIKE_E2E
  ): Promise<number> {
    const filter = `${column}=${pattern}`

    const listed = await fetch(`${url}/rest/v1/${table}?${filter}&select=${column}`, { headers })
    expect(listed.ok, `teardown could not list ${label}: ${listed.status}`).toBe(true)
    const rows: Array<Record<string, string>> = await listed.json()
    if (rows.length === 0) return 0

    const deleted = await fetch(`${url}/rest/v1/${table}?${filter}`, { method: 'DELETE', headers })
    expect(deleted.ok, `teardown could not delete ${label}: ${deleted.status}`).toBe(true)

    console.log(`teardown: removed ${rows.length} ${label}`)
    for (const row of rows) console.log(`  - ${row[column]}`)
    return rows.length
  }

  // Tasks in the personal workspace have nothing to cascade from, so they are
  // swept directly. Deleting a household cascades its own members, categories,
  // tasks and invitations.
  const tasks = await sweep('tasks', 'title', 'task(s)')
  const households = await sweep('workspaces', 'name', 'household(s)')

  // Push subscriptions carry no name to mark, so the marker is in the synthetic
  // endpoint the push spec builds: https://fcm.googleapis.com/e2e/...
  // Only the owner's own rows are visible here; the invitee's are cleaned up by
  // the spec itself, and a stray one is inert — it points at nothing.
  const subscriptions = await sweep(
    'push_subscriptions',
    'endpoint',
    'push subscription(s)',
    'like.*googleapis.com/e2e/*'
  )

  // API tokens are named by their owner, so the marker goes in the name. A stray
  // one is not inert like a dead push endpoint is — it is a live credential —
  // which is the reason this sweep exists rather than being left to each spec.
  const tokens = await sweep('api_tokens', 'name', 'api token(s)')

  if (tasks + households + subscriptions + tokens === 0)
    console.log('teardown: nothing to clean up')
})
