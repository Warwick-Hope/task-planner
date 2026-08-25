import { test as teardown, expect } from '@playwright/test'

/**
 * Removes everything the suite created, including from runs that failed.
 *
 * Each spec deletes what it makes, but only on the happy path — a test that
 * fails before its cleanup leaves its rows behind, and those accumulate in the
 * real dev workspace. This sweeps anything named "[e2e] …" regardless.
 *
 * It talks to Supabase directly rather than through the app: there is no list
 * endpoint on /api/tasks and no delete route for a household. RLS still applies,
 * so the account can only remove its own rows.
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
   * Deletes every row in `table` whose `column` starts with "[e2e]".
   * The column differs by table — tasks are titled, workspaces are named.
   */
  async function sweep(table: string, column: string, label: string): Promise<number> {
    const filter = `${column}=${LIKE_E2E}`

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

  if (tasks + households === 0) console.log('teardown: nothing to clean up')
})
