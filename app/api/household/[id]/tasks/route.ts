import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { forbidden, parseJson, badBody } from '@/lib/api'
import { requireCaller } from '@/lib/api-auth'
import type { TaskStatus, TaskSource } from '@/types'

interface CreateTaskBody {
  title: string
  notes?: string
  status?: TaskStatus
  category_id?: string | null
  due_date?: string | null
  is_recurring?: boolean
  recurrence_rule?: string | null
  recurrence_end_date?: string | null
  source?: TaskSource
  source_id?: string | null
  assigned_to_user_id?: string | null
  assigned_to_profile_id?: string | null
  horizon_year?: number | null
  horizon_half?: number | null
  horizon_quarter?: number | null
  horizon_month?: number | null
  horizon_week?: string | null
  horizon_day?: string | null
  horizon_time_slot?: string | null
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request, { scope: 'tasks:read' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  const membership = await requireMember(supabase, params.id, userId)
  if (!membership) return forbidden()

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const categoryId = searchParams.get('category')

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', params.id)

  if (status && status !== 'all') query = query.eq('status', status)
  if (categoryId && categoryId !== 'all') query = query.eq('category_id', categoryId)

  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request, { scope: 'tasks:write' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  const membership = await requireMember(supabase, params.id, userId, { blockRestricted: true })
  if (!membership) return forbidden()

  const body = await parseJson<CreateTaskBody>(request)
  if (!body) return badBody()

  const {
    title, notes, status, category_id, due_date,
    is_recurring, recurrence_rule, recurrence_end_date,
    source, source_id, assigned_to_user_id, assigned_to_profile_id,
    ...horizonFields
  } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  // An assignee must belong to this workspace
  if (assigned_to_user_id) {
    const assignee = await requireMember(supabase, params.id, assigned_to_user_id)
    if (!assignee) return NextResponse.json({ error: 'Assignee is not a member' }, { status: 400 })
  }
  if (assigned_to_profile_id) {
    const { data: profile } = await supabase
      .from('household_profiles')
      .select('id')
      .eq('id', assigned_to_profile_id)
      .eq('workspace_id', params.id)
      .single()
    if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 400 })
  }

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: params.id,
      created_by: userId,
      title: title.trim(),
      notes: notes?.trim() || null,
      status: status ?? 'not_started',
      category_id: category_id ?? null,
      due_date: due_date ?? null,
      is_recurring: is_recurring ?? false,
      recurrence_rule: recurrence_rule ?? null,
      recurrence_end_date: recurrence_end_date ?? null,
      source: source ?? 'manual',
      source_id: source_id ?? null,
      assigned_to_user_id: assigned_to_user_id ?? null,
      assigned_to_profile_id: assigned_to_profile_id ?? null,
      assignment_status: (assigned_to_user_id || assigned_to_profile_id) ? 'pending' : 'none',
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: task.id }, { status: 201 })
}
