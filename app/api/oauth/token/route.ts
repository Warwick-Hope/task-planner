import { anonClient } from '@/lib/api-auth'
import { requestOrigin } from '@/lib/api'
import type { ApiTokenScope } from '@/types'
import {
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_DAYS,
  clientCredentials,
  hashToken,
  mintAccessToken,
  mintRefreshToken,
  oauthError,
  verifyPkce,
  type OAuthClient,
} from '@/lib/oauth'

/**
 * The token endpoint (Phase 4.11) — `authorization_code` and `refresh_token`.
 *
 * It runs with no session by definition: the caller is a client, not a person.
 * Everything it touches goes through a security definer function, and each of
 * those consumes its input in the statement that reads it, so a code raced by two
 * requests is spent once and a rotated refresh token is dead the moment its
 * replacement exists.
 */

interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

function issued(body: TokenResponse): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      // A response carrying a credential must not be cached, by anything.
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
  })
}

/**
 * The client row, if the presented credentials are good for it.
 *
 * The check runs inside `oauth_authenticate_client`, which is security definer:
 * this endpoint has no session, so RLS would show it nothing, and the obvious
 * workaround — an anon function that returns the stored hash — would hand a hash
 * to anyone who asked for it. No rows means unknown client *or* wrong secret, and
 * the caller is not told which.
 */
async function authenticateClient(
  supabase: ReturnType<typeof anonClient>,
  clientId: string | null,
  clientSecret: string | null
): Promise<{ ok: true; client: OAuthClient } | { ok: false; response: Response }> {
  if (!clientId) {
    return { ok: false, response: oauthError('invalid_client', 'client_id is required', 401) }
  }

  const { data } = await supabase.rpc('oauth_authenticate_client', {
    p_client_id: clientId,
    p_secret_hash: clientSecret ? hashToken(clientSecret) : null,
  })

  const client = (data as OAuthClient[] | null)?.[0]
  if (!client) {
    return { ok: false, response: oauthError('invalid_client', 'Bad client credentials', 401) }
  }

  return { ok: true, client }
}

export async function POST(request: Request) {
  let form: URLSearchParams
  try {
    // RFC 6749 says form encoding. Some clients send JSON anyway, and refusing
    // them would be correct and useless.
    const contentType = request.headers.get('content-type') ?? ''
    form = contentType.includes('application/json')
      ? new URLSearchParams(Object.entries((await request.json()) as Record<string, string>))
      : new URLSearchParams(await request.text())
  } catch {
    return oauthError('invalid_request', 'Body could not be read')
  }

  const supabase = anonClient()
  const { clientId, clientSecret } = clientCredentials(request, form)

  const authenticated = await authenticateClient(supabase, clientId, clientSecret)
  if (!authenticated.ok) return authenticated.response
  const client = authenticated.client

  const grantType = form.get('grant_type')

  if (grantType === 'authorization_code') {
    const code = form.get('code')
    const redirectUri = form.get('redirect_uri')
    const verifier = form.get('code_verifier')

    if (!code || !redirectUri || !verifier) {
      return oauthError(
        'invalid_request',
        'code, redirect_uri and code_verifier are all required'
      )
    }

    const { data, error } = await supabase.rpc('oauth_redeem_code', {
      p_code_hash: hashToken(code),
      p_client_id: client.id,
      p_redirect_uri: redirectUri,
    })

    const redeemed = (
      data as
        | { user_id: string; scopes: string[]; code_challenge: string; resource: string | null }[]
        | null
    )?.[0]

    if (error || !redeemed) {
      // Unknown, expired, already spent, or issued to a different client — the
      // caller learns which of those it was only by not getting a token.
      return oauthError('invalid_grant', 'That code is not usable')
    }

    if (!verifyPkce(verifier, redeemed.code_challenge)) {
      // The code has already been consumed by the statement that read it, so a
      // wrong verifier costs the attempt entirely. That is the intended
      // behaviour rather than an accident of the ordering: whoever presents the
      // wrong verifier either stole the code or is broken, and giving either of
      // them a second go is how a code becomes brute-forceable.
      return oauthError('invalid_grant', 'PKCE verification failed')
    }

    const accessToken = mintAccessToken()
    const refreshToken = mintRefreshToken()

    const { error: storeError } = await supabase.rpc('oauth_store_grant', {
      p_client_id: client.id,
      p_user_id: redeemed.user_id,
      p_scopes: redeemed.scopes,
      p_access_hash: hashToken(accessToken),
      p_refresh_hash: hashToken(refreshToken),
      p_access_ttl_seconds: ACCESS_TTL_SECONDS,
      p_refresh_ttl_days: REFRESH_TTL_DAYS,
    })

    if (storeError) {
      console.error('Storing an OAuth grant failed:', storeError.message)
      return oauthError('server_error', 'Could not issue a token', 500)
    }

    // Spent codes are litter with a secret in them, and there is no cron here.
    void supabase.rpc('oauth_sweep_codes')

    return issued({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: (redeemed.scopes as ApiTokenScope[]).join(' '),
    })
  }

  if (grantType === 'refresh_token') {
    const presented = form.get('refresh_token')
    if (!presented) return oauthError('invalid_request', 'refresh_token is required')

    const accessToken = mintAccessToken()
    const refreshToken = mintRefreshToken()

    const { data, error } = await supabase.rpc('oauth_rotate_grant', {
      p_refresh_hash: hashToken(presented),
      p_client_id: client.id,
      p_new_access_hash: hashToken(accessToken),
      p_new_refresh_hash: hashToken(refreshToken),
      p_access_ttl_seconds: ACCESS_TTL_SECONDS,
      p_refresh_ttl_days: REFRESH_TTL_DAYS,
    })

    const rotated = (data as { grant_id: string; user_id: string; scopes: string[] }[] | null)?.[0]

    if (error || !rotated) {
      return oauthError('invalid_grant', 'That refresh token is not usable')
    }

    return issued({
      access_token: accessToken,
      token_type: 'Bearer',
      expires_in: ACCESS_TTL_SECONDS,
      refresh_token: refreshToken,
      scope: (rotated.scopes as ApiTokenScope[]).join(' '),
    })
  }

  return oauthError(
    'unsupported_grant_type',
    `Supported: authorization_code, refresh_token. Metadata: ${requestOrigin(request)}/.well-known/oauth-authorization-server`
  )
}
