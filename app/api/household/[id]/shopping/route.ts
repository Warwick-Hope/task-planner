import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'restricted') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const incomingQty = body.quantity?.toString().trim() || null
  const incomingUnit = body.unit?.toString().trim() || null

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
      shop_tag: body.shop_tag?.toString().trim() || null,
      source: body.source ?? 'manual',
      source_id: body.source_id ?? null,
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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
