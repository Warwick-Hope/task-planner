import { test as teardown, expect } from '@playwright/test'

/**
 * Removes every task the suite created, including from runs that failed.
 *
 * Each spec deletes what it makes, but only on the happy path — a test that
 * fails before its cleanup leaves its row behind, and those accumulate in the
 * real dev workspace. This sweeps anything titled "[e2e] …" regardless.
 *
 * It talks to Supabase directly rather than through the app: there is no list
 * endpoint on /api/tasks, and this is test infrastructure rather than a thing
 * the product needs. RLS still applies — the account can only delete its own
 * rows, so a bug here cannot reach anyone else's data.
 */
teardown('remove tasks created by the suite', async () => {
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
  // PostgREST pattern matching: * is the wildcard, and the brackets need encoding.
  const filter = 'title=like.%5Be2e%5D*'

  const listed = await fetch(`${url}/rest/v1/tasks?${filter}&select=id,title`, { headers })
  const rows: Array<{ id: string; title: string }> = await listed.json()

  if (!Array.isArray(rows) || rows.length === 0) {
    console.log('teardown: nothing to clean up')
    return
  }

  const deleted = await fetch(`${url}/rest/v1/tasks?${filter}`, { method: 'DELETE', headers })
  expect(deleted.ok, `teardown delete failed: ${deleted.status}`).toBe(true)

  console.log(`teardown: removed ${rows.length} task(s) left by the suite`)
  for (const row of rows) console.log(`  - ${row.title}`)
})
