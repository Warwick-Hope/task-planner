import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody } from '@/lib/api'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; mealId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const body = await parseJson<{ name?: unknown; notes?: unknown }>(request)
  if (!body) return badBody()

  const allowed: Record<string, unknown> = {}
  if ('name'  in body) allowed.name  = typeof body.name === 'string' ? body.name.trim() || null : null
  if ('notes' in body) allowed.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null

  const { data, error } = await supabase
    .from('meals')
    .update(allowed)
    .eq('id', params.mealId)
    .eq('workspace_id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ meal: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; mealId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const { error } = await supabase
    .from('meals')
    .delete()
    .eq('id', params.mealId)
    .eq('workspace_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
