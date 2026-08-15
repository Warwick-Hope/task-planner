import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody, trimmedString } from '@/lib/api'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id)
  if (!membership) return forbidden()

  const body = await parseJson<{
    is_purchased?: unknown
    name?: unknown
    quantity?: unknown
    unit?: unknown
    shop_tag?: unknown
  }>(request)
  if (!body) return badBody()

  const allowed: Record<string, unknown> = {}

  if ('is_purchased' in body) allowed.is_purchased = Boolean(body.is_purchased)
  if ('name'         in body) allowed.name         = trimmedString(body.name)
  if ('quantity'     in body) allowed.quantity     = trimmedString(body.quantity)
  if ('unit'         in body) allowed.unit         = trimmedString(body.unit)
  if ('shop_tag'     in body) allowed.shop_tag     = trimmedString(body.shop_tag)

  // Restricted members may tick items off, nothing more.
  if (membership.role === 'restricted') {
    const editsBeyondPurchase = Object.keys(allowed).some(k => k !== 'is_purchased')
    if (editsBeyondPurchase) return forbidden()
  }

  const { data, error } = await supabase
    .from('shopping_list')
    .update(allowed)
    .eq('id', params.itemId)
    .eq('workspace_id', params.id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ item: data })
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const { error } = await supabase
    .from('shopping_list')
    .delete()
    .eq('id', params.itemId)
    .eq('workspace_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
