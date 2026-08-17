import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody } from '@/lib/api'

export async function POST(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  // Caller must be an adult/owner in this workspace
  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  // Verify task belongs to this workspace
  const { data: task } = await supabase
    .from('tasks')
    .select('id, workspace_id')
    .eq('id', params.taskId)
    .eq('workspace_id', params.id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const body = await parseJson<{ assignTo?: unknown; type?: unknown }>(request)
  if (!body) return badBody()

  const { type } = body
  const assignTo = typeof body.assignTo === 'string' ? body.assignTo : null
  // type: 'member' | 'profile' | 'unassign'

  if (type === 'unassign') {
    const { error } = await supabase
      .from('tasks')
      .update({
        assigned_to_user_id: null,
        assigned_to_profile_id: null,
        assignment_status: 'none',
      })
      .eq('id', params.taskId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (type === 'member') {
    // assignTo is a user_id — verify they are a member of the workspace
    if (!assignTo) return NextResponse.json({ error: 'assignTo is required' }, { status: 400 })

    const targetMember = await requireMember(supabase, params.id, assignTo)
    if (!targetMember) return NextResponse.json({ error: 'Member not found' }, { status: 404 })

    // Assigning to self: auto-accept
    const isSelf = assignTo === user.id
    const assignmentStatus = isSelf ? 'accepted' : 'pending'

    const { error } = await supabase
      .from('tasks')
      .update({
        assigned_to_user_id: assignTo,
        assigned_to_profile_id: null,
        assignment_status: assignmentStatus,
      })
      .eq('id', params.taskId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, assignmentStatus })
  }

  if (type === 'profile') {
    // assignTo is a household_profile id — no approval required
    if (!assignTo) return NextResponse.json({ error: 'assignTo is required' }, { status: 400 })

    const { data: profile } = await supabase
      .from('household_profiles')
      .select('id')
      .eq('id', assignTo)
      .eq('workspace_id', params.id)
      .single()

    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const { error } = await supabase
      .from('tasks')
      .update({
        assigned_to_user_id: null,
        assigned_to_profile_id: assignTo,
        assignment_status: 'accepted',
      })
      .eq('id', params.taskId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, assignmentStatus: 'accepted' })
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
}
