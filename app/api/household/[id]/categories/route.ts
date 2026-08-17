import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody } from '@/lib/api'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id)
  if (!membership) return forbidden()

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
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const body = await parseJson<{ name?: unknown; colour?: unknown; parent_id?: unknown }>(request)
  if (!body) return badBody()

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const colour = typeof body.colour === 'string' ? body.colour : null
  const parent_id = typeof body.parent_id === 'string' ? body.parent_id : null

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

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
      name,
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
