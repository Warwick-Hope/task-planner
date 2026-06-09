import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('household_profiles')
    .select('id, name, avatar_colour, created_at')
    .eq('workspace_id', params.id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profiles: data ?? [] })
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const avatarColour = typeof body.avatar_colour === 'string' ? body.avatar_colour : '#6366f1'

  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('household_profiles')
    .insert({ workspace_id: params.id, name, avatar_colour: avatarColour, created_by: user.id })
    .select('id, name, avatar_colour, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ profile: data })
}
