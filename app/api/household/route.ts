import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  if (!name) {
    return NextResponse.json({ error: 'Household name is required' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('create_household_workspace', { p_name: name })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ workspaceId: data })
}
