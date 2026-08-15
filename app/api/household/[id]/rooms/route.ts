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
    .from('rooms')
    .select('id, name, sort_order, created_at')
    .eq('workspace_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rooms: data ?? [] })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const body = await parseJson<{ name?: unknown }>(request)
  if (!body) return badBody()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('rooms')
    .select('sort_order')
    .eq('workspace_id', params.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const sort_order = existing ? existing.sort_order + 1 : 0

  const { data, error } = await supabase
    .from('rooms')
    .insert({ workspace_id: params.id, name, sort_order })
    .select('id, name, sort_order, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ room: data }, { status: 201 })
}
