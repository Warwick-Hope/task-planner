import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember, mealBelongsToWorkspace } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody, trimmedString } from '@/lib/api'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; mealId: string; ingredientId: string } }
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

  const allowed: Record<string, unknown> = {}
  if ('name'     in body) allowed.name     = trimmedString(body.name)
  if ('quantity' in body) allowed.quantity = trimmedString(body.quantity)
  if ('unit'     in body) allowed.unit     = trimmedString(body.unit)

  const { data, error } = await supabase
    .from('ingredients')
    .update(allowed)
    .eq('id', params.ingredientId)
    .eq('meal_id', params.mealId)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ingredient: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; mealId: string; ingredientId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  if (!(await mealBelongsToWorkspace(supabase, params.id, params.mealId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { error } = await supabase
    .from('ingredients')
    .delete()
    .eq('id', params.ingredientId)
    .eq('meal_id', params.mealId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
