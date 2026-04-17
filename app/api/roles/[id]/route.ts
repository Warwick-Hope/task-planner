import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const body = await request.json()
  const { name, colour } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const updates: Record<string, unknown> = { name: name.trim(), updated_at: new Date().toISOString() }
  if (colour !== undefined) updates.colour = colour

  const { data, error } = await supabase
    .from('role_categories')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select('id, name, colour, parent_id, sort_order')
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

  // Prevent deletion if this category has children
  const { count } = await supabase
    .from('role_categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', params.id)
    .eq('user_id', user.id)

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Remove subcategories before deleting this category' },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('role_categories')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return new NextResponse(null, { status: 204 })
}
