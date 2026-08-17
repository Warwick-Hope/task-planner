import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody } from '@/lib/api'
import type { AssignmentStatus } from '@/types'

export async function POST(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  // Restricted members may still respond to their own assignments
  const membership = await requireMember(supabase, params.id, user.id)
  if (!membership) return forbidden()

  const body = await parseJson<{ decision?: unknown }>(request)
  if (!body) return badBody()
  const decision: AssignmentStatus = body.decision === 'declined' ? 'declined' : 'accepted'

  // Only the assignee can respond
  const { data: task } = await supabase
    .from('tasks')
    .select('id, assigned_to_user_id, assignment_status, workspace_id')
    .eq('id', params.taskId)
    .eq('workspace_id', params.id)
    .single()

  if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  if (task.assigned_to_user_id !== user.id) {
    return NextResponse.json({ error: 'Only the assignee can respond' }, { status: 403 })
  }
  if (task.assignment_status !== 'pending') {
    return NextResponse.json({ error: 'Assignment is not pending' }, { status: 400 })
  }

  const { error } = await supabase
    .from('tasks')
    .update({ assignment_status: decision })
    .eq('id', params.taskId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, decision })
}
