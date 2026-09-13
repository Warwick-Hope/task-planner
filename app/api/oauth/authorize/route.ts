import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { parseJson, badBody, unauthorised } from '@/lib/api'
import { ALL_SCOPES } from '@/lib/api-tokens'
import { CODE_TTL_SECONDS, hashToken, mintCode } from '@/lib/oauth'
import type { ApiTokenScope } from '@/types'

/**
 * Issues an authorization code once a person has pressed Allow (Phase 4.11).
 *
 * **Session-only, and that is the whole security property of the flow.** The
 * consent screen renders for a signed-in user; this route takes the user from
 * their session rather than from the request, so nothing a client sends can
 * decide whose tasks it is about to read. `oauth_issue_code` reads `auth.uid()`
 * inside the database for the same reason.
 *
 * The code goes back as JSON for the consent screen to redirect with, rather than
 * this route issuing a 302: the screen is a client component, and a fetch that
 * followed a redirect to another origin would land the code in a response the
 * page cannot use.
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const body = await parseJson<{
    client_id?: unknown
    redirect_uri?: unknown
    scopes?: unknown
    code_challenge?: unknown
    code_challenge_method?: unknown
    resource?: unknown
  }>(request)
  if (!body) return badBody()

  const clientId = typeof body.client_id === 'string' ? body.client_id : null
  const redirectUri = typeof body.redirect_uri === 'string' ? body.redirect_uri : null
  const challenge = typeof body.code_challenge === 'string' ? body.code_challenge : null
  const method = typeof body.code_challenge_method === 'string' ? body.code_challenge_method : null

  if (!clientId || !redirectUri || !challenge) {
    return NextResponse.json(
      { error: 'client_id, redirect_uri and code_challenge are required' },
      { status: 400 }
    )
  }

  // OAuth 2.1 removes `plain`, and a server with no legacy client has no reason
  // to accept it — a plain challenge is not a challenge.
  if (method !== 'S256') {
    return NextResponse.json(
      { error: 'code_challenge_method must be S256' },
      { status: 400 }
    )
  }

  const asked = Array.isArray(body.scopes) ? body.scopes : []
  const scopes = ALL_SCOPES.filter(scope => asked.includes(scope)) as ApiTokenScope[]
  if (scopes.length === 0) {
    return NextResponse.json({ error: 'At least one scope is required' }, { status: 400 })
  }

  const code = mintCode()

  // The function checks the client exists and that this redirect_uri is one of
  // its registered ones — a code issued to an unregistered URI is a code handed
  // to whoever asked for it.
  const { error } = await supabase.rpc('oauth_issue_code', {
    p_code_hash: hashToken(code),
    p_client_id: clientId,
    p_redirect_uri: redirectUri,
    p_scopes: scopes,
    p_code_challenge: challenge,
    p_resource: typeof body.resource === 'string' ? body.resource : null,
    p_ttl_seconds: CODE_TTL_SECONDS,
  })

  if (error) {
    // The most likely cause by far is a redirect_uri the client never registered.
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ code }, { headers: { 'Cache-Control': 'no-store' } })
}
