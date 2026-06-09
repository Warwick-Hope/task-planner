import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Caller must be an adult/owner in this workspace
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'restricted') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Verify task belongs to this workspace
  const { data: task } = await supabase
    .from('tasks')
    .select('id, workspace_id')
    .eq('id', params.taskId)
    .eq('workspace_id', params.id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })

  const body = await request.json()
  const { assignTo, type } = body
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
    // assignTo is a user_id
    // Verify they are a member of the workspace
    const { data: targetMember } = await supabase
      .from('workspace_members')
      .select('user_id, display_name')
      .eq('workspace_id', params.id)
      .eq('user_id', assignTo)
      .single()

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
