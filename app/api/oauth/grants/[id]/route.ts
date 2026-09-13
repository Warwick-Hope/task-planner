import { NextResponse } from 'next/server'
import { requireCaller } from '@/lib/api-auth'

/**
 * Disconnecting an app you approved (Phase 4.11).
 *
 * **Session-only**, deliberately, for the reason `/api/tokens` is (KB.md #45): a
 * credential that could revoke credentials is one an attacker uses to lock you
 * out of your own account. Revoking requires a browser.
 *
 * It revokes rather than deletes, and it does not bother checking ownership —
 * RLS does that. The update simply matches no row for somebody else's grant,
 * which is why a stranger's id answers 404 rather than 403.
 */
export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request)
  if (!auth.ok) return auth.response

  const { data, error } = await auth.caller.supabase
    .from('oauth_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', params.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(null, { status: 204 })
}
