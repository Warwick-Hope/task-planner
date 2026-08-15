import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { unauthorised, parseJson, badBody } from '@/lib/api'

export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorised()

  const body = await parseJson<{ name?: unknown }>(request)
  if (!body) return badBody()

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
