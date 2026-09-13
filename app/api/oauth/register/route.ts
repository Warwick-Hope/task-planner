import { anonClient } from '@/lib/api-auth'
import { requestOrigin } from '@/lib/api'
import {
  hashToken,
  isAllowedRedirectUri,
  mintClientSecret,
  oauthError,
} from '@/lib/oauth'

/**
 * Dynamic client registration, RFC 7591 (Phase 4.11).
 *
 * **Open, and it has to be.** This is how an MCP client installs itself: nobody
 * is watching when claude.ai first meets this server, so there is no one to
 * approve a client. What stops that mattering is that a client row grants
 * nothing — it cannot read a task, and it cannot obtain a token without a person
 * completing the authorize step in a browser and pressing Allow.
 *
 * A `client_secret` is issued only when the client asks to be confidential.
 * MCP clients are public and use PKCE, which is the safer default: a secret in a
 * desktop app is a secret published.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return oauthError('invalid_request', 'Body must be JSON')
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
  if (redirectUris.length === 0) {
    return oauthError('invalid_request', 'redirect_uris is required')
  }
  if (redirectUris.length > 10) {
    return oauthError('invalid_request', 'Too many redirect_uris')
  }

  for (const uri of redirectUris) {
    if (!isAllowedRedirectUri(uri)) {
      return oauthError(
        'invalid_request',
        `redirect_uri must be https, or http on localhost, and carry no fragment: ${String(uri)}`
      )
    }
  }

  const name =
    typeof body.client_name === 'string' && body.client_name.trim()
      ? body.client_name.trim()
      : 'Unnamed client'

  // `none` is the MCP norm — a public client with PKCE. Anything else gets a
  // secret, which is returned exactly once, here.
  const wantsSecret = body.token_endpoint_auth_method !== 'none'
  const secret = wantsSecret ? mintClientSecret() : null

  const { data, error } = await anonClient().rpc('oauth_register_client', {
    p_name: name,
    p_redirect_uris: redirectUris,
    p_secret_hash: secret ? hashToken(secret) : null,
  })

  if (error || !data) {
    console.error('Client registration failed:', error?.message)
    return oauthError('server_error', 'Could not register the client', 500)
  }

  const origin = requestOrigin(request)

  return new Response(
    JSON.stringify({
      client_id: data as string,
      ...(secret ? { client_secret: secret } : {}),
      client_name: name,
      redirect_uris: redirectUris,
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: wantsSecret ? 'client_secret_post' : 'none',
      // No expiry: a client that has to re-register every fortnight is a
      // connector that stops working on a phone with nobody to notice.
      client_id_issued_at: Math.floor(Date.now() / 1000),
      registration_client_uri: `${origin}/api/oauth/register`,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
  )
}
