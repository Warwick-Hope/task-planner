import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { nextOccurrence } from '@/lib/recurrence'
import type { TaskStatus, Task } from '@/types'
import { buildHorizonFields, getMondayOfWeek, monthFromDate, yearFromDate, monthToQuarter, quarterToHalf } from '@/lib/horizon'
import { parseJson, badBody } from '@/lib/api'
import { requireMember } from '@/lib/workspace-server'

const HORIZON_FIELDS = [
  'horizon_year',
  'horizon_half',
  'horizon_quarter',
  'horizon_month',
  'horizon_week',
  'horizon_day',
  'horizon_time_slot',
] as const

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (task.created_by !== user.id) {
    const membership = await requireMember(supabase, task.workspace_id, user.id)
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ task })
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

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

  // Fetch the current task — owner or any workspace member may edit
  const { data: existing } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Verify user has access: either they created it, or they're a member of its workspace
  if (existing.created_by !== user.id) {
    const membership = await requireMember(supabase, existing.workspace_id, user.id)
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

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

  // Auto-generate next occurrence when a recurring task is marked done
  if (
    existing &&
    (existing as Task).is_recurring &&
    (existing as Task).recurrence_rule &&
    (existing as Task).status !== 'done' &&
    allowed.status === 'done'
  ) {
    const task = existing as Task
    const afterDate = task.due_date ?? new Date().toISOString().split('T')[0]
    const nextDate  = nextOccurrence(task.recurrence_rule!, afterDate)

    if (nextDate) {
      const m = monthFromDate(nextDate)
      const q = monthToQuarter(m)
      const nextHorizon = buildHorizonFields('day', {
        year: yearFromDate(nextDate),
        half: quarterToHalf(q),
        quarter: q,
        month: m,
        weekStr: getMondayOfWeek(nextDate),
        dayStr: nextDate,
      })
      const { error: nextError } = await supabase.from('tasks').insert({
        workspace_id:         task.workspace_id,
        created_by:           task.created_by,
        title:                task.title,
        notes:                task.notes,
        status:               'not_started',
        category_id:          task.category_id,
        due_date:             nextDate,
        is_recurring:         true,
        recurrence_rule:      task.recurrence_rule,
        recurrence_end_date:  task.recurrence_end_date,
        source:               task.source,
        ...nextHorizon,
      })

      // The completion itself succeeded — report the failed follow-up rather
      // than silently dropping the next occurrence.
      if (nextError) {
        console.error('Next-occurrence insert failed:', nextError.message)
        return NextResponse.json({ ...data, recurrenceError: nextError.message })
      }
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  // Allow deletion by creator or any workspace member
  const { data: taskToDelete } = await supabase
    .from('tasks')
    .select('created_by, workspace_id')
    .eq('id', params.id)
    .single()

  if (!taskToDelete) return new NextResponse(null, { status: 204 })

  if (taskToDelete.created_by !== user.id) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('id')
      .eq('workspace_id', taskToDelete.workspace_id)
      .eq('user_id', user.id)
      .single()
    if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
