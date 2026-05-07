import { createClient } from '@/lib/supabase-server'
import { getPersonalWorkspaceId } from '@/lib/workspace-server'
import { NextResponse } from 'next/server'
import type { TaskStatus } from '@/types'

interface CreateTaskBody {
  title: string
  notes?: string
  status?: TaskStatus
  category_id?: string | null
  due_date?: string | null
  is_recurring?: boolean
  recurrence_rule?: string | null
  recurrence_end_date?: string | null
  horizon_year?: number | null
  horizon_half?: number | null
  horizon_quarter?: number | null
  horizon_month?: number | null
  horizon_week?: string | null
  horizon_day?: string | null
  horizon_time_slot?: string | null
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const workspaceId = await getPersonalWorkspaceId(supabase, user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })

  let body: CreateTaskBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    title,
    notes,
    status,
    category_id,
    due_date,
    is_recurring,
    recurrence_rule,
    recurrence_end_date,
    ...horizonFields
  } = body

  if (!title?.trim()) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .insert({
      workspace_id: workspaceId,
      created_by: user.id,
      title: title.trim(),
      notes: notes?.trim() || null,
      status: status ?? 'not_started',
      category_id: category_id ?? null,
      due_date: due_date ?? null,
      is_recurring: is_recurring ?? false,
      recurrence_rule: recurrence_rule ?? null,
      recurrence_end_date: recurrence_end_date ?? null,
      horizon_year: horizonFields.horizon_year ?? null,
      horizon_half: horizonFields.horizon_half ?? null,
      horizon_quarter: horizonFields.horizon_quarter ?? null,
      horizon_month: horizonFields.horizon_month ?? null,
      horizon_week: horizonFields.horizon_week ?? null,
      horizon_day: horizonFields.horizon_day ?? null,
      horizon_time_slot: horizonFields.horizon_time_slot ?? null,
    })
    .select('id')
    .single()

  if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 })

  return NextResponse.json({ id: task.id }, { status: 201 })
}
