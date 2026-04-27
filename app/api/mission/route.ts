import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data } = await supabase
    .from('missions')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ mission: data ?? null })
}

export async function PUT(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: { content: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const content = body.content?.trim()
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  // Deactivate all previous active missions
  await supabase
    .from('missions')
    .update({ is_active: false })
    .eq('user_id', user.id)
    .eq('is_active', true)

  // Insert new active mission
  const { data, error } = await supabase
    .from('missions')
    .insert({ user_id: user.id, content, is_active: true })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ mission: data })
}
