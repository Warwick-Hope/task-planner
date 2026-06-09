import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const allowed: Record<string, unknown> = {}

  if ('is_purchased' in body) allowed.is_purchased = Boolean(body.is_purchased)
  if ('name'         in body) allowed.name         = body.name?.trim() || null
  if ('quantity'     in body) allowed.quantity      = body.quantity?.toString().trim() || null
  if ('unit'         in body) allowed.unit          = body.unit?.toString().trim() || null
  if ('shop_tag'     in body) allowed.shop_tag      = body.shop_tag?.toString().trim() || null

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
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabase
    .from('shopping_list')
    .delete()
    .eq('id', params.itemId)
    .eq('workspace_id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return new NextResponse(null, { status: 204 })
}
