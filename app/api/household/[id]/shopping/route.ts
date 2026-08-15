import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { requireMember } from '@/lib/workspace-server'
import { unauthorised, forbidden, parseJson, badBody, trimmedString } from '@/lib/api'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id)
  if (!membership) return forbidden()

  const { data, error } = await supabase
    .from('shopping_list')
    .select('*')
    .eq('workspace_id', params.id)
    .order('is_purchased')
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const body = await parseJson<{
    name?: unknown
    quantity?: unknown
    unit?: unknown
    shop_tag?: unknown
    source?: unknown
    source_id?: unknown
  }>(request)
  if (!body) return badBody()

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const incomingQty = trimmedString(body.quantity)
  const incomingUnit = trimmedString(body.unit)

  // Deduplication: if a matching unpurchased item exists with the same name (case-insensitive),
  // merge by appending quantity rather than creating a duplicate.
  if (body.source === 'meal') {
    const { data: existing } = await supabase
      .from('shopping_list')
      .select('*')
      .eq('workspace_id', params.id)
      .eq('is_purchased', false)
      .ilike('name', name)
      .limit(1)
      .single()

    if (existing) {
      // Combine quantities if both have numeric quantities and matching units
      let mergedQty = existing.quantity
      if (incomingQty && existing.quantity && existing.unit === incomingUnit) {
        const sum = parseFloat(existing.quantity) + parseFloat(incomingQty)
        if (!isNaN(sum)) mergedQty = String(sum)
      } else if (incomingQty && !existing.quantity) {
        mergedQty = incomingQty
      }
      const { data: updated, error: updateError } = await supabase
        .from('shopping_list')
        .update({ quantity: mergedQty })
        .eq('id', existing.id)
        .select('*')
        .single()
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })
      return NextResponse.json({ item: updated }, { status: 200 })
    }
  }

  const { data, error } = await supabase
    .from('shopping_list')
    .insert({
      workspace_id: params.id,
      added_by: user.id,
      name,
      quantity: incomingQty,
      unit: incomingUnit,
      shop_tag: trimmedString(body.shop_tag),
      source: body.source === 'meal' ? 'meal' : 'manual',
      source_id: typeof body.source_id === 'string' ? body.source_id : null,
      is_purchased: false,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data }, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const membership = await requireMember(supabase, params.id, user.id, { blockRestricted: true })
  if (!membership) return forbidden()

  const { searchParams } = new URL(request.url)
  const clearPurchased = searchParams.get('purchased') === 'true'

  if (clearPurchased) {
    const { error } = await supabase
      .from('shopping_list')
      .delete()
      .eq('workspace_id', params.id)
      .eq('is_purchased', true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json({ error: 'Bad request' }, { status: 400 })
}
