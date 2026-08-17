import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember, mealBelongsToWorkspace } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody, trimmedString } from '@/lib/api'

export async function GET(
  _request: Request,
  { params }: { params: { id: string; mealId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id)
  if (!membership) return forbidden()

  if (!(await mealBelongsToWorkspace(supabase, params.id, params.mealId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('ingredients')
    .select('*')
    .eq('meal_id', params.mealId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ingredients: data ?? [] })
}

export async function POST(
  request: Request,
  { params }: { params: { id: string; mealId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  if (!(await mealBelongsToWorkspace(supabase, params.id, params.mealId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await parseJson<{ name?: unknown; quantity?: unknown; unit?: unknown }>(request)
  if (!body) return badBody()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      meal_id: params.mealId,
      name,
      quantity: trimmedString(body.quantity),
      unit: trimmedString(body.unit),
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ingredient: data }, { status: 201 })
}
