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

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(supabase, params.id, user.id)
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, colour, parent_id, sort_order')
    .eq('workspace_id', params.id)
    .is('owner_id', null)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const membership = await getMembership(supabase, params.id, user.id)
  if (!membership || membership.role === 'restricted') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { name, colour, parent_id } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { count } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', params.id)
    .is('owner_id', null)
    .is('parent_id', parent_id ?? null)

  const { data, error } = await supabase
    .from('categories')
    .insert({
      workspace_id: params.id,
      owner_id: null,
      name: name.trim(),
      colour: parent_id ? '#6B7280' : (colour ?? '#6B7280'),
      is_shared: true,
      parent_id: parent_id ?? null,
      sort_order: count ?? 0,
    })
    .select('id, name, colour, parent_id, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
