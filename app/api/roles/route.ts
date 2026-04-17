import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('role_categories')
    .select('id, name, colour, parent_id, sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const { name, colour, parent_id } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Determine sort_order: append after existing siblings
  const { count } = await supabase
    .from('role_categories')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('parent_id', parent_id ?? null)

  const { data, error } = await supabase
    .from('role_categories')
    .insert({
      user_id: user.id,
      name: name.trim(),
      colour: parent_id ? null : (colour ?? '#6B7280'),
      parent_id: parent_id ?? null,
      sort_order: count ?? 0,
    })
    .select('id, name, colour, parent_id, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
