import { anonClient } from '@/lib/api-auth'
import { clientCredentials, hashToken } from '@/lib/oauth'

/**
 * Token revocation, RFC 7009 (Phase 4.11).
 *
 * A client disconnecting should be able to say so rather than leaving a live
 * credential behind it. The spec is explicit that this endpoint answers **200 for
 * anything** — an unknown token is already revoked as far as the caller is
 * concerned, and saying otherwise turns it into an oracle for guessing tokens.
 *
 * A person revoking from the Connections page does not come through here; that is
 * a session route against their own row.
 */
export async function POST(request: Request) {
  const ok = () => new Response(null, { status: 200, headers: { 'Cache-Control': 'no-store' } })

  let form: URLSearchParams
  try {
    form = new URLSearchParams(await request.text())
  } catch {
    return ok()
  }

  const token = form.get('token')
  const { clientId } = clientCredentials(request, form)
  if (!token || !clientId) return ok()

  const hash = hashToken(token)
  const supabase = anonClient()

  // Either half of the pair identifies the grant, because a client revoking
  // "the token" may mean the access token or the refresh token, and RFC 7009
  // says to accept both and hints at the type rather than requiring it.
  await supabase.rpc('oauth_revoke_grant', {
    p_token_hash: hash,
    p_client_id: clientId,
  })

  return ok()
}
