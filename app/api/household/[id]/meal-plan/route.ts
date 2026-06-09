import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('meal_plan')
    .select('*, meal:meals(id, name, notes)')
    .eq('workspace_id', params.id)
    .order('planned_date')

  if (from) query = query.gte('planned_date', from)
  if (to)   query = query.lte('planned_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plans: data ?? [] })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const meal_id = body.meal_id
  const planned_date = body.planned_date
  if (!meal_id || !planned_date) {
    return NextResponse.json({ error: 'meal_id and planned_date are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('meal_plan')
    .insert({
      workspace_id: params.id,
      meal_id,
      planned_date,
      servings: body.servings ?? null,
    })
    .select('*, meal:meals(id, name, notes)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data }, { status: 201 })
}
