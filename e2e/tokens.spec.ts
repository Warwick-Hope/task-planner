import { test, expect, type APIRequestContext, type Browser } from '@playwright/test'
import { INVITEE_STATE, uniqueTitle } from './helpers'

/**
 * Personal access tokens and bearer auth (Phase 4.9).
 *
 * The assertion that matters most is the last one: a token is a *user session*,
 * not a service-role client, so RLS applies to it exactly as it does to a
 * browser. If that ever stops being true, one token becomes a way into every
 * workspace in the database, and nothing else in this suite would notice.
 *
 * These tests need `SUPABASE_SECRET_KEY` in the environment, because that is
 * what exchanges a token for a session. They are deliberately not skipped when
 * it is missing: a deployment without it answers 503 to every token call, and a
 * silent skip would make that look like a pass.
 */

/** A request context with no cookies, carrying only the bearer token. */
async function asToken(browser: Browser, token: string): Promise<APIRequestContext> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  return context.request
}

async function createToken(
  request: APIRequestContext,
  scopes: string[]
): Promise<{ token: string; id: string; prefix: string }> {
  const res = await request.post('/api/tokens', {
    data: { name: uniqueTitle('token'), scopes, expiresInDays: 30 },
  })
  expect(res.status(), 'creating a token').toBe(201)
  const { token, apiToken } = await res.json()
  return { token, id: apiToken.id, prefix: apiToken.token_prefix }
}

test('the API answers JSON to a caller with no session, not a login page', async ({ browser }) => {
  // Middleware used to redirect this to /login, so the caller got a 200 and an
  // HTML form where it expected JSON (KB.md #37). A bearer client has no cookie
  // by definition, so this had to change before tokens could work at all.
  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })

  const res = await anon.request.get('/api/tokens')
  expect(res.status(), 'an unauthenticated API call must be a 401').toBe(401)
  expect(res.headers()['content-type'], 'and must be JSON').toContain('application/json')
  expect((await res.json()).error).toBe('Unauthorised')

  await anon.close()
})

test('a token is shown once, listed by prefix, and revoked for good', async ({ request }) => {
  const { token, id, prefix } = await createToken(request, ['tasks:read', 'tasks:write'])

  expect(token.startsWith('clr_'), 'tokens carry a recognisable prefix').toBe(true)
  expect(prefix, 'the stored prefix is the start of the real token').toBe(token.slice(0, 10))

  const listed = await request.get('/api/tokens')
  expect(listed.status()).toBe(200)
  const { tokens } = await listed.json()
  const mine = tokens.find((t: { id: string }) => t.id === id)
  expect(mine, 'the new token appears in the list').toBeTruthy()
  expect(JSON.stringify(mine), 'no hash and no plaintext ever reach the client').not.toContain(
    token.slice(4)
  )

  expect((await request.delete(`/api/tokens/${id}`)).status(), 'revoking').toBe(204)
  expect((await request.delete(`/api/tokens/${id}`)).status(), 'revoking twice').toBe(404)
})

test('a bearer token can read and write tasks, and its use is recorded', async ({
  request,
  browser,
}) => {
  const { token, id } = await createToken(request, ['tasks:read', 'tasks:write'])
  const api = await asToken(browser, token)

  const title = uniqueTitle('via token')
  const created = await api.post('/api/tasks', { data: { title } })
  expect(created.status(), `creating a task with a token: ${await created.text()}`).toBe(201)
  const { id: taskId } = await created.json()

  const read = await api.get(`/api/tasks/${taskId}`)
  expect(read.status(), 'reading it back with the same token').toBe(200)
  expect((await read.json()).task.title).toBe(title)

  // Categories, because nothing can sensibly create a task without them.
  expect((await api.get('/api/roles')).status(), 'listing categories').toBe(200)

  // last_used_at is stamped by the resolver, in the same statement that
  // resolves the token — so by now it must be set.
  const { tokens } = await (await request.get('/api/tokens')).json()
  const mine = tokens.find((t: { id: string }) => t.id === id)
  expect(mine.last_used_at, 'using a token records that it was used').toBeTruthy()

  await request.delete(`/api/tokens/${id}`)
})

test('scopes are enforced, and tokens cannot manage tokens', async ({ request, browser }) => {
  const { token, id } = await createToken(request, ['tasks:read'])
  const api = await asToken(browser, token)

  const refused = await api.post('/api/tasks', { data: { title: uniqueTitle('should not exist') } })
  expect(refused.status(), 'a read-only token must not create a task').toBe(403)
  expect((await refused.json()).error).toContain('tasks:write')

  // Session-only routes: /api/tokens takes no scope at all, so a token is
  // refused there whatever it holds. A token that could mint tokens could not
  // be revoked.
  expect((await api.get('/api/tokens')).status(), 'a token must not list tokens').toBe(403)
  expect(
    (await api.delete(`/api/tokens/${id}`)).status(),
    'a token must not revoke tokens'
  ).toBe(403)

  await request.delete(`/api/tokens/${id}`)
})

test('a revoked token stops working immediately', async ({ request, browser }) => {
  const { token, id } = await createToken(request, ['tasks:read', 'tasks:write'])
  const api = await asToken(browser, token)

  const created = await api.post('/api/tasks', { data: { title: uniqueTitle('before revoke') } })
  expect(created.status()).toBe(201)

  expect((await request.delete(`/api/tokens/${id}`)).status()).toBe(204)

  // The resolver runs on every request, so revocation does not wait for a
  // cached session to expire.
  const after = await api.get('/api/tasks/00000000-0000-0000-0000-000000000000')
  expect(after.status(), 'a revoked token is unauthorised, not merely stale').toBe(401)
})

test('a token is a user session, so RLS still hides other people', async ({ request, browser }) => {
  // The second account creates a task in its own personal workspace.
  const invitee = await browser.newContext({ storageState: INVITEE_STATE })
  const theirTask = await invitee.request.post('/api/tasks', {
    data: { title: uniqueTitle('private to user2') },
  })
  expect(theirTask.status()).toBe(201)
  const { id: theirTaskId } = await theirTask.json()

  const { token, id } = await createToken(request, ['tasks:read', 'tasks:write'])
  const api = await asToken(browser, token)

  // Not 403 but 404: RLS does not hide behind a permission error, it returns no
  // row at all, which is what the route turns into "Not found". A service-role
  // client would have read it happily — that is the whole point of this test.
  const attempt = await api.get(`/api/tasks/${theirTaskId}`)
  expect(attempt.status(), 'a token must not reach another user’s task').toBe(404)

  await invitee.request.delete(`/api/tasks/${theirTaskId}`)
  await request.delete(`/api/tokens/${id}`)
  await invitee.close()
})
