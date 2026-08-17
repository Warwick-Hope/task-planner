import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember, mealBelongsToWorkspace } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody } from '@/lib/api'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id)
  if (!membership) return forbidden()

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
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const body = await parseJson<{ meal_id?: unknown; planned_date?: unknown; servings?: unknown }>(request)
  if (!body) return badBody()

  const meal_id = typeof body.meal_id === 'string' ? body.meal_id : ''
  const planned_date = typeof body.planned_date === 'string' ? body.planned_date : ''
  if (!meal_id || !planned_date) {
    return NextResponse.json({ error: 'meal_id and planned_date are required' }, { status: 400 })
  }

  // The meal must belong to this workspace — RLS on meal_plan does not check it
  if (!(await mealBelongsToWorkspace(supabase, params.id, meal_id))) {
    return NextResponse.json({ error: 'Meal not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('meal_plan')
    .insert({
      workspace_id: params.id,
      meal_id,
      planned_date,
      servings: typeof body.servings === 'number' ? body.servings : null,
    })
    .select('*, meal:meals(id, name, notes)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ plan: data }, { status: 201 })
}
