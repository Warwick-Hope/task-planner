import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody } from '@/lib/api'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; roomId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const body = await parseJson<{ name?: unknown }>(request)
  if (!body) return badBody()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('rooms')
    .update({ name })
    .eq('id', params.roomId)
    .eq('workspace_id', params.id)
    .select('id, name, sort_order, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ room: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; roomId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', params.roomId)
    .eq('workspace_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
