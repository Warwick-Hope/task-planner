import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data, error } = await supabase
    .from('values')
    .select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ values: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: { name: string; description?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const name = body.name?.trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  // Place at the end
  const { count } = await supabase
    .from('values')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)

  const { data, error } = await supabase
    .from('values')
    .insert({
      user_id: user.id,
      name,
      description: body.description?.trim() || null,
      sort_order: count ?? 0,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
