import { NextResponse } from 'next/server'
import { requireCaller } from '@/lib/api-auth'
import { mintToken, parseScopes } from '@/lib/api-tokens'
import { parseJson, badBody, trimmedString } from '@/lib/api'

/**
 * Personal access tokens (Phase 4.9).
 *
 * Session-only, deliberately: `requireCaller` is called without a scope, so a
 * token cannot mint or list tokens. A leaked token that could issue more tokens
 * would be impossible to revoke — you would be chasing children of children.
 */

/** The columns that may be read back. `token_hash` is never one of them. */
const SAFE_COLUMNS = 'id, name, token_prefix, scopes, expires_at, revoked_at, last_used_at, created_at'

export async function GET(request: Request) {
  const auth = await requireCaller(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.caller.supabase
    .from('api_tokens')
    .select(SAFE_COLUMNS)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ tokens: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireCaller(request)
  if (!auth.ok) return auth.response

  const body = await parseJson<{ name?: unknown; scopes?: unknown; expiresInDays?: unknown }>(
    request
  )
  if (!body) return badBody()

  const name = trimmedString(body.name)
  if (!name) return NextResponse.json({ error: 'A name is required' }, { status: 400 })
  if (name.length > 60) {
    return NextResponse.json({ error: 'That name is too long' }, { status: 400 })
  }

  const scopes = parseScopes(body.scopes)
  if (scopes.length === 0) {
    return NextResponse.json({ error: 'At least one scope is required' }, { status: 400 })
  }

  const days = typeof body.expiresInDays === 'number' ? body.expiresInDays : null
  if (days !== null && (!Number.isInteger(days) || days < 1 || days > 730)) {
    return NextResponse.json({ error: 'Expiry must be between 1 and 730 days' }, { status: 400 })
  }
  const expiresAt = days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString()

  const { token, tokenHash, tokenPrefix } = mintToken()

  const { data, error } = await auth.caller.supabase
    .from('api_tokens')
    .insert({
      user_id: auth.caller.userId,
      name,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      scopes,
      expires_at: expiresAt,
    })
    .select(SAFE_COLUMNS)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // The one and only time the plaintext leaves this process.
  return NextResponse.json({ token, apiToken: data }, { status: 201 })
}
