import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import type { TaskStatus } from '@/types'

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

  // Allow all horizon fields to be set/cleared explicitly
  for (const field of HORIZON_FIELDS) {
    if (field in body) allowed[field] = body[field] ?? null
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(allowed)
    .eq('id', params.id)
    .eq('created_by', user.id)
    .select('id, status, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

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
