import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  _request: Request,
  { params }: { params: { id: string; mealId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify workspace membership
  const { data: meal } = await supabase
    .from('meals')
    .select('workspace_id')
    .eq('id', params.mealId)
    .single()

  if (!meal || meal.workspace_id !== params.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('ingredients')
    .insert({
      meal_id: params.mealId,
      name,
      quantity: body.quantity?.toString().trim() || null,
      unit: body.unit?.toString().trim() || null,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ingredient: data }, { status: 201 })
}
