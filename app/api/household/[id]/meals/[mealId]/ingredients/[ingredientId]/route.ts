import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; mealId: string; ingredientId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}
  if ('name'     in body) allowed.name     = body.name?.trim() || null
  if ('quantity' in body) allowed.quantity = body.quantity?.toString().trim() || null
  if ('unit'     in body) allowed.unit     = body.unit?.toString().trim() || null

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('ingredients')
    .delete()
    .eq('id', params.ingredientId)
    .eq('meal_id', params.mealId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
