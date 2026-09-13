import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test'
import { createHash, randomBytes } from 'crypto'
import { uniqueTitle } from './helpers'

/**
 * The connector's OAuth flow, end to end (Phase 4.11).
 *
 * This is the phase's only real proof. Every step of the flow is a redirect or a
 * form post between three parties, and the failure mode is not an exception — it
 * is a client that quietly cannot install, on a device with no console to look
 * at. So the test drives the whole thing the way claude.ai does: discover,
 * register, send a person to the consent screen, exchange the code, then call
 * `/api/mcp` with what came back.
 *
 * **The client rows it creates stay on dev.** A client is deleted by nobody: it
 * has no owner, and its RLS policy only reveals it to somebody holding a grant on
 * it. A registered client with no live grant can do nothing at all, so they are
 * inert litter rather than a risk. The grants are swept in teardown.
 */

/** PKCE, as a client generates it: a verifier, and the S256 of it. */
function pkce() {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

async function register(
  api: APIRequestContext,
  redirectUri: string,
  extra: Record<string, unknown> = {}
) {
  const res = await api.post('/api/oauth/register', {
    data: {
      client_name: uniqueTitle('connector'),
      redirect_uris: [redirectUri],
      token_endpoint_auth_method: 'none',
      ...extra,
    },
  })
  return { status: res.status(), body: await res.json() }
}

/** Walks the consent screen and returns the code it sent back. */
async function approve(
  page: Page,
  params: {
    clientId: string
    redirectUri: string
    challenge: string
    scope: string
    state: string
  }
): Promise<string> {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    scope: params.scope,
    state: params.state,
    code_challenge: params.challenge,
    code_challenge_method: 'S256',
  })

  await page.goto(`/oauth/authorize?${query}`)
  await page.getByRole('button', { name: /^Allow / }).click()
  await page.waitForURL(url => url.searchParams.has('code') || url.searchParams.has('error'), {
    timeout: 20_000,
  })

  const returned = new URL(page.url())
  expect(returned.searchParams.get('error'), 'consent should not have failed').toBeNull()
  expect(returned.searchParams.get('state'), 'state must come back untouched').toBe(params.state)

  return returned.searchParams.get('code')!
}

async function exchange(
  api: APIRequestContext,
  form: Record<string, string>
): Promise<{ status: number; body: Record<string, string> }> {
  const res = await api.post('/api/oauth/token', { form })
  return { status: res.status(), body: await res.json().catch(() => ({})) }
}

/** A context carrying only the OAuth access token — no cookies at all. */
async function asOAuth(browser: Browser, accessToken: string): Promise<APIRequestContext> {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
    extraHTTPHeaders: { Authorization: `Bearer ${accessToken}` },
  })
  return context.request
}

async function toolsList(api: APIRequestContext) {
  const res = await api.post('/api/mcp', {
    data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
  })
  return { status: res.status(), body: await res.json().catch(() => ({})) }
}

test.describe('discovery', () => {
  test('both documents are served to a caller with no session', async ({ browser }) => {
    // The whole point: a client reads these *because* it has no credential. A
    // redirect to /login here means the connector cannot be installed at all.
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })

    const resource = await anon.request.get('/.well-known/oauth-protected-resource')
    expect(resource.status(), 'protected-resource metadata').toBe(200)
    const resourceDoc = await resource.json()
    expect(resourceDoc.resource).toMatch(/\/api\/mcp$/)
    expect(resourceDoc.authorization_servers.length).toBeGreaterThan(0)

    // RFC 9728 has a client insert .well-known before the resource's own path.
    const suffixed = await anon.request.get('/.well-known/oauth-protected-resource/api/mcp')
    expect(suffixed.status(), 'the path-suffixed form clients actually build').toBe(200)

    const server = await anon.request.get('/.well-known/oauth-authorization-server')
    expect(server.status()).toBe(200)
    const serverDoc = await server.json()
    expect(serverDoc.authorization_endpoint).toMatch(/\/oauth\/authorize$/)
    expect(serverDoc.token_endpoint).toMatch(/\/api\/oauth\/token$/)
    expect(serverDoc.registration_endpoint).toMatch(/\/api\/oauth\/register$/)
    // OAuth 2.1 removes `plain`, and advertising it would invite it.
    expect(serverDoc.code_challenge_methods_supported).toEqual(['S256'])

    await anon.close()
  })

  test('an unauthenticated MCP call says where to sign in', async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })

    const res = await anon.request.post('/api/mcp', {
      data: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    })
    expect(res.status()).toBe(401)
    // Without this header a client has a failure and no way to recover from it.
    expect(res.headers()['www-authenticate']).toContain('resource_metadata=')
    expect(res.headers()['www-authenticate']).toContain('/.well-known/oauth-protected-resource')

    await anon.close()
  })
})

test.describe('registration', () => {
  test('a client registers itself and gets no secret unless it asks', async ({ browser }) => {
    // Registration is open by necessity — nobody is watching when a client first
    // meets this server — so it must work with no credential.
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })

    const { status, body } = await register(anon.request, 'https://claude.ai/api/mcp/auth_callback')
    expect(status).toBe(201)
    expect(body.client_id).toBeTruthy()
    expect(body.client_secret, 'a public client gets none').toBeUndefined()

    const confidential = await register(anon.request, 'https://claude.ai/api/mcp/auth_callback', {
      token_endpoint_auth_method: 'client_secret_post',
    })
    expect(confidential.body.client_secret, 'and a confidential one gets it once').toBeTruthy()

    await anon.close()
  })

  test('a redirect_uri that is not https or loopback is refused', async ({ browser }) => {
    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })

    for (const uri of [
      'http://evil.example/callback',
      'https://claude.ai/callback#fragment',
      'not-a-url',
    ]) {
      const { status } = await register(anon.request, uri)
      expect(status, `${uri} must be refused`).toBe(400)
    }

    await anon.close()
  })
})

test.describe('the flow', () => {
  test('approve, exchange, call, refresh, disconnect', async ({ page, request, browser }) => {
    const baseURL = test.info().project.use.baseURL as string
    // The app's own origin, so the browser lands somewhere real and the code is
    // readable from the URL. Loopback over http is the one exception OAuth 2.1
    // keeps, and it is what a desktop client uses.
    const redirectUri = `${baseURL}/connections`

    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const { body: client } = await register(anon.request, redirectUri)
    await anon.close()

    const { verifier, challenge } = pkce()
    const state = `state-${Date.now()}`

    const code = await approve(page, {
      clientId: client.client_id,
      redirectUri,
      challenge,
      scope: 'tasks:read tasks:write',
      state,
    })
    expect(code.startsWith('clrc_'), 'codes are recognisable').toBe(true)

    const exchanged = await exchange(request, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: client.client_id,
      code_verifier: verifier,
    })
    expect(exchanged.status, `exchange failed: ${JSON.stringify(exchanged.body)}`).toBe(200)
    expect(exchanged.body.token_type).toBe('Bearer')
    expect(exchanged.body.access_token.startsWith('clro_')).toBe(true)
    expect(exchanged.body.scope).toContain('tasks:write')

    // A code is single-use. A replayed one is the classic attack, and the
    // database consumes it in the statement that reads it.
    const replayed = await exchange(request, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: client.client_id,
      code_verifier: verifier,
    })
    expect(replayed.status, 'a spent code must not work twice').toBe(400)

    // The token is a Caller like any other: the tools do not know how it arrived.
    const api = await asOAuth(browser, exchanged.body.access_token)
    const listed = await toolsList(api)
    expect(listed.status).toBe(200)
    expect(listed.body.result.tools.length).toBe(7)

    const created = await api.post('/api/mcp', {
      data: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'create_tasks',
          arguments: {
            workspace_id: (
              JSON.parse(
                (
                  await (
                    await api.post('/api/mcp', {
                      data: {
                        jsonrpc: '2.0',
                        id: 3,
                        method: 'tools/call',
                        params: { name: 'list_workspaces', arguments: {} },
                      },
                    })
                  ).json()
                ).result.content[0].text
              ) as { workspaces: { id: string; type: string }[] }
            ).workspaces.find(w => w.type === 'personal')!.id,
            tasks: [{ title: uniqueTitle('via oauth') }],
          },
        },
      },
    })
    const createdBody = await created.json()
    expect(createdBody.result.isError, 'an OAuth token with tasks:write can write').toBeFalsy()

    // Rotation: the new pair works and the old refresh token is dead.
    const refreshed = await exchange(request, {
      grant_type: 'refresh_token',
      refresh_token: exchanged.body.refresh_token,
      client_id: client.client_id,
    })
    expect(refreshed.status, `refresh failed: ${JSON.stringify(refreshed.body)}`).toBe(200)
    expect(refreshed.body.access_token).not.toBe(exchanged.body.access_token)

    const reused = await exchange(request, {
      grant_type: 'refresh_token',
      refresh_token: exchanged.body.refresh_token,
      client_id: client.client_id,
    })
    expect(reused.status, 'a rotated refresh token must be dead').toBe(400)

    const rotatedApi = await asOAuth(browser, refreshed.body.access_token)
    expect((await toolsList(rotatedApi)).status, 'the rotated token works').toBe(200)

    // Disconnecting from the Connections page stops it at once, not at expiry.
    const grants = await request.get('/api/workspaces')
    expect(grants.status(), 'session still works throughout').toBe(200)

    await page.goto('/connections')
    const row = page.locator('li').filter({ hasText: client.client_name })
    await expect(row).toBeVisible()
    await row.getByRole('button', { name: /^Disconnect/ }).first().click()
    await row.getByRole('button', { name: 'Disconnect' }).click()
    await expect(row).toHaveCount(0)

    const afterRevoke = await toolsList(rotatedApi)
    expect(afterRevoke.status, 'a disconnected app is unauthorised immediately').toBe(401)
  })

  test('a wrong verifier spends the code rather than allowing another go', async ({
    page,
    request,
    browser,
  }) => {
    const baseURL = test.info().project.use.baseURL as string
    const redirectUri = `${baseURL}/connections`

    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const { body: client } = await register(anon.request, redirectUri)
    await anon.close()

    const { verifier, challenge } = pkce()
    const code = await approve(page, {
      clientId: client.client_id,
      redirectUri,
      challenge,
      scope: 'tasks:read',
      state: 'pkce',
    })

    const wrong = await exchange(request, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: client.client_id,
      code_verifier: randomBytes(32).toString('base64url'),
    })
    expect(wrong.status, 'PKCE is checked').toBe(400)
    expect(wrong.body.error).toBe('invalid_grant')

    // And the code is gone, even though nothing was issued. The database
    // consumes it in the statement that reads it, which is what makes a code
    // single-use at all — so a wrong verifier costs the attempt. Anyone
    // presenting the wrong verifier either stole the code or is broken, and
    // neither deserves a second try.
    const retried = await exchange(request, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: client.client_id,
      code_verifier: verifier,
    })
    expect(retried.status, 'the right verifier is too late').toBe(400)
  })

  test('a read-only grant cannot write', async ({ page, request, browser }) => {
    const baseURL = test.info().project.use.baseURL as string
    const redirectUri = `${baseURL}/connections`

    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const { body: client } = await register(anon.request, redirectUri)
    await anon.close()

    const { verifier, challenge } = pkce()
    const code = await approve(page, {
      clientId: client.client_id,
      redirectUri,
      challenge,
      scope: 'tasks:read',
      state: 'read-only',
    })

    const { body } = await exchange(request, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: client.client_id,
      code_verifier: verifier,
    })
    expect(body.scope, 'only what was approved').toBe('tasks:read')

    const api = await asOAuth(browser, body.access_token)
    const attempt = await api.post('/api/mcp', {
      data: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'capture',
          arguments: { text: 'this must never be extracted', save: false },
        },
      },
    })
    const result = (await attempt.json()).result
    expect(result.isError).toBe(true)
    expect(result.content[0].text, 'refused before Anthropic is ever called').toContain(
      'tasks:write'
    )
  })

  test('cancel sends the client away empty-handed', async ({ page, browser }) => {
    const baseURL = test.info().project.use.baseURL as string
    const redirectUri = `${baseURL}/connections`

    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const { body: client } = await register(anon.request, redirectUri)
    await anon.close()

    const { challenge } = pkce()
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      redirect_uri: redirectUri,
      scope: 'tasks:read',
      state: 'cancelled',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })

    await page.goto(`/oauth/authorize?${query}`)
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.waitForURL(url => url.searchParams.has('error'), { timeout: 20_000 })

    const returned = new URL(page.url())
    expect(returned.searchParams.get('error')).toBe('access_denied')
    expect(returned.searchParams.get('state')).toBe('cancelled')
  })

  test('a redirect_uri the client never registered is refused, not bounced to', async ({
    page,
    browser,
  }) => {
    const baseURL = test.info().project.use.baseURL as string

    const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const { body: client } = await register(anon.request, `${baseURL}/connections`)
    await anon.close()

    const { challenge } = pkce()
    const query = new URLSearchParams({
      response_type: 'code',
      client_id: client.client_id,
      // Registered for /connections, asking for somewhere else entirely.
      redirect_uri: 'https://evil.example/callback',
      scope: 'tasks:read',
      state: 'x',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    })

    await page.goto(`/oauth/authorize?${query}`)

    // Bouncing the error to an unregistered address would hand it, and anything
    // in it, to whoever supplied the address. So it stops here.
    await expect(page.getByText(/has not registered/)).toBeVisible()
    expect(page.url()).toContain('/oauth/authorize')
  })
})

test('signing in on the way to consent keeps the request intact', async ({ browser }) => {
  const baseURL = test.info().project.use.baseURL as string
  const redirectUri = `${baseURL}/connections`

  const anon = await browser.newContext({ storageState: { cookies: [], origins: [] } })
  const { body: client } = await register(anon.request, redirectUri)

  const { challenge } = pkce()
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: client.client_id,
    redirect_uri: redirectUri,
    scope: 'tasks:read',
    state: 'through-login',
    code_challenge: challenge,
    code_challenge_method: 'S256',
  })

  // The consent screen *is* its query string. The login redirect used to carry
  // only the path, so a signed-out visitor arrived at a page with nothing to
  // approve — after a sign-in that looked like it had worked (KB.md #55).
  const page = await anon.newPage()
  await page.goto(`/oauth/authorize?${query}`)
  await page.waitForURL(/\/login/, { timeout: 20_000 })

  const next = new URL(page.url()).searchParams.get('next')
  expect(next, 'the whole request survives the redirect').toContain('client_id=')
  expect(next).toContain('code_challenge=')

  await anon.close()
})
