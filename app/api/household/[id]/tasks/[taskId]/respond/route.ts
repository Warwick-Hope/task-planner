import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { AssignmentStatus } from '@/types'

export async function POST(
  request: Request,
  { params }: { params: { id: string; taskId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
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
