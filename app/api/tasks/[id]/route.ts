import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { nextOccurrence } from '@/lib/recurrence'
import type { TaskStatus, Task } from '@/types'
import { buildHorizonFields, getMondayOfWeek, monthFromDate, yearFromDate, monthToQuarter, quarterToHalf } from '@/lib/horizon'

const HORIZON_FIELDS = [
  'horizon_year',
  'horizon_half',
  'horizon_quarter',
  'horizon_month',
  'horizon_week',
  'horizon_day',
  'horizon_time_slot',
] as const

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}

  if (body.status    !== undefined) allowed.status      = body.status as TaskStatus
  if (body.title     !== undefined) allowed.title       = body.title
  if (body.notes     !== undefined) allowed.notes       = body.notes
  if ('category_id'  in body)       allowed.category_id = body.category_id ?? null
  if ('due_date'          in body) allowed.due_date           = body.due_date ?? null
  if ('is_recurring'      in body) allowed.is_recurring       = body.is_recurring ?? false
  if ('recurrence_rule'   in body) allowed.recurrence_rule    = body.recurrence_rule ?? null
  if ('recurrence_end_date' in body) allowed.recurrence_end_date = body.recurrence_end_date ?? null

  // Allow all horizon fields to be set/cleared explicitly
  for (const field of HORIZON_FIELDS) {
    if (field in body) allowed[field] = body[field] ?? null
  }

  // Fetch the current task so we can detect a done transition on a recurring task
  const { data: existing } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', params.id)
    .eq('created_by', user.id)
    .single()

  const { data, error } = await supabase
    .from('tasks')
    .update(allowed)
    .eq('id', params.id)
    .eq('created_by', user.id)
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
      await supabase.from('tasks').insert({
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

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', params.id)
    .eq('created_by', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
