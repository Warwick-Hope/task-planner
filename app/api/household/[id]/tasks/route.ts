import { createClient } from '@/lib/supabase-server'
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

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'restricted') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateTaskBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const {
    title, notes, status, category_id, due_date,
    is_recurring, recurrence_rule, recurrence_end_date,
    ...horizonFields
  } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 })

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: params.id,
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

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: task.id }, { status: 201 })
}
