import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden } from '@/lib/api'

/**
 * Revokes an invitation that has not been accepted yet.
 *
 * An *accepted* invitation is deliberately not deletable: the row is the only
 * record that this person was invited and by whom, and removing it would not
 * remove their membership — that is `workspace_members`, and a different job.
 * So the delete is filtered on `accepted_at is null`, and an attempt on an
 * accepted one answers 404 rather than silently doing nothing.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; invitationId: string } }
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { ownerOnly: true })
  if (!membership) return forbidden()

  const { data, error } = await supabase
    .from('household_invitations')
    .delete()
    .eq('id', params.invitationId)
    .eq('workspace_id', params.id)
    .is('accepted_at', null)
    .select('id')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(null, { status: 204 })
}
