import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

async function getMembership(supabase: ReturnType<typeof createClient>, workspaceId: string, userId: string) {
  const { data } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single()
  return data
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; categoryId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(supabase, params.id, user.id)
  if (!membership || membership.role === 'restricted') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, colour } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const updates: Record<string, unknown> = { name: name.trim() }
  if (colour !== undefined) updates.colour = colour

  const { data, error } = await supabase
    .from('categories')
    .update(updates)
    .eq('id', params.categoryId)
    .eq('workspace_id', params.id)
    .is('owner_id', null)
    .select('id, name, colour, parent_id, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(data)
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; categoryId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(supabase, params.id, user.id)
  if (!membership || membership.role === 'restricted') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { count } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('parent_id', params.categoryId)
    .eq('workspace_id', params.id)
    .is('owner_id', null)

  if (count && count > 0) {
    return NextResponse.json(
      { error: 'Remove subcategories before deleting this category' },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', params.categoryId)
    .eq('workspace_id', params.id)
    .is('owner_id', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
