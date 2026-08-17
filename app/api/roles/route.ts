import { createClient } from '@/lib/supabase-server'
import { getPersonalWorkspaceId } from '@/lib/workspace-server'
import { NextResponse } from 'next/server'
import { parseJson, badBody } from '@/lib/api'

export async function GET() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, colour, parent_id, sort_order')
    .eq('owner_id', user.id)
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

  const workspaceId = await getPersonalWorkspaceId(supabase, user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })

  const body = await parseJson<{ name?: string; colour?: string; parent_id?: string | null }>(request)
  if (!body) return badBody()
  const { name, colour, parent_id } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  const { count } = await supabase
    .from('categories')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', user.id)
    .is('parent_id', parent_id ?? null)

  const { data, error } = await supabase
    .from('categories')
    .insert({
      workspace_id: workspaceId,
      owner_id: user.id,
      name: name.trim(),
      colour: parent_id ? '#6B7280' : (colour ?? '#6B7280'),
      is_shared: false,
      parent_id: parent_id ?? null,
      sort_order: count ?? 0,
    })
    .select('id, name, colour, parent_id, sort_order')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
