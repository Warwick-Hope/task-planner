import { NextResponse } from 'next/server'
import { requireCaller, forgetToken } from '@/lib/api-auth'

/**
 * Revoking a token (Phase 4.9). Session-only, like the rest of `/api/tokens`.
 *
 * The row is kept and stamped rather than deleted: `last_used_at` on a revoked
 * token is the only way to answer "was this thing being used when I killed it?",
 * which is the first question anyone asks after revoking one in a hurry. The
 * resolver ignores a row with `revoked_at` set, so the token stops working
 * immediately and the record of it survives.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request)
  if (!auth.ok) return auth.response

  const { supabase } = auth.caller

  const { data, error } = await supabase
    .from('api_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', params.id)
    .is('revoked_at', null)
    .select('id, token_hash')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Not required for correctness — every request re-resolves the token and a
  // revoked one no longer resolves — but it stops this instance holding a live
  // access token for a credential its owner has just withdrawn.
  forgetToken(data.token_hash)

  return new NextResponse(null, { status: 204 })
}
