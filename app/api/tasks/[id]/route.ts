import { NextResponse } from 'next/server'
import type { TaskStatus } from '@/types'
import { parseJson, badBody, refusal } from '@/lib/api'
import { requireCaller } from '@/lib/api-auth'
import { requireMember } from '@/lib/workspace-server'
import { advanceRecurrence, resolveTask } from '@/lib/tasks-server'

const HORIZON_FIELDS = [
  'horizon_year',
  'horizon_half',
  'horizon_quarter',
  'horizon_month',
  'horizon_week',
  'horizon_day',
  'horizon_time_slot',
] as const

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request, { scope: 'tasks:read' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  const found = await resolveTask(supabase, userId, params.id)
  if (!found.ok) return refusal(found)

  return NextResponse.json({ task: found.task })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request, { scope: 'tasks:write' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  const body = await parseJson<Record<string, unknown>>(request)
  if (!body) return badBody()

  const allowed: Record<string, unknown> = {}

  if (body.status    !== undefined) allowed.status      = body.status as TaskStatus
  if (body.title     !== undefined) allowed.title       = body.title
  if (body.notes     !== undefined) allowed.notes       = body.notes
  if ('category_id'  in body)       allowed.category_id = body.category_id ?? null
  if ('due_date'          in body) allowed.due_date           = body.due_date ?? null
  if ('is_recurring'      in body) allowed.is_recurring       = body.is_recurring ?? false
  if ('recurrence_rule'   in body) allowed.recurrence_rule    = body.recurrence_rule ?? null
  if ('recurrence_end_date' in body) allowed.recurrence_end_date = body.recurrence_end_date ?? null
  if ('source_id'              in body) allowed.source_id              = body.source_id ?? null
  if ('assigned_to_user_id'    in body) allowed.assigned_to_user_id    = body.assigned_to_user_id ?? null
  if ('assigned_to_profile_id' in body) allowed.assigned_to_profile_id = body.assigned_to_profile_id ?? null

  // Allow all horizon fields to be set/cleared explicitly
  for (const field of HORIZON_FIELDS) {
    if (field in body) allowed[field] = body[field] ?? null
  }

  // Owner or any workspace member may edit; RLS hides everything else.
  const found = await resolveTask(supabase, userId, params.id)
  if (!found.ok) return refusal(found)
  const existing = found.task

  // A new assignee must be a member of the task's workspace (mirrors the assign route)
  if (allowed.assigned_to_user_id) {
    const assignee = await requireMember(
      supabase,
      existing.workspace_id,
      allowed.assigned_to_user_id as string
    )
    if (!assignee) {
      return NextResponse.json({ error: 'Assignee is not a member of this workspace' }, { status: 400 })
    }
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(allowed)
    .eq('id', params.id)
    .select('id, status, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Completing a recurring task also creates its next occurrence. That lives in
  // lib/tasks-server.ts because `complete_task` does exactly the same thing from
  // the connector, and two copies of it would eventually disagree (KB.md #24).
  if (existing.status !== 'done' && allowed.status === 'done') {
    const { error: recurrenceError } = await advanceRecurrence(supabase, existing)
    // The completion itself succeeded — report the failed follow-up rather than
    // silently dropping the next occurrence.
    if (recurrenceError) return NextResponse.json({ ...data, recurrenceError })
  }

  return NextResponse.json(data)
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request, { scope: 'tasks:write' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  // Allow deletion by creator or any workspace member
  const { data: taskToDelete } = await supabase
    .from('tasks')
    .select('created_by, workspace_id')
    .eq('id', params.id)
    .single()

  if (!taskToDelete) return new NextResponse(null, { status: 204 })

  if (taskToDelete.created_by !== userId) {
    const membership = await requireMember(supabase, taskToDelete.workspace_id, userId)
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
