import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

interface CategoryInput {
  name: string
  colour: string
}

interface OnboardingPayload {
  displayName: string
  roleCategories: CategoryInput[]
  mission?: string
}

export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
  }

  let payload: OnboardingPayload
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { displayName, roleCategories, mission } = payload

  if (!displayName?.trim()) {
    return NextResponse.json({ error: 'Display name is required' }, { status: 400 })
  }
  if (!roleCategories?.length) {
    return NextResponse.json({ error: 'At least one category is required' }, { status: 400 })
  }

  // Insert profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: user.id, display_name: displayName.trim() })

  if (profileError) {
    if (profileError.code === '23505') {
      return NextResponse.json({ error: 'Already onboarded' }, { status: 409 })
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Create personal workspace + owner member via SECURITY DEFINER RPC (bypasses RLS for bootstrap)
  const { data: workspaceId, error: workspaceError } = await supabase.rpc(
    'create_personal_workspace',
    { p_display_name: displayName.trim() }
  )

  if (workspaceError) {
    return NextResponse.json({ error: workspaceError.message }, { status: 500 })
  }

  // Insert personal categories
  const { error: categoriesError } = await supabase.from('categories').insert(
    roleCategories.map((rc, index) => ({
      workspace_id: workspaceId,
      owner_id: user.id,
      name: rc.name.trim(),
      colour: rc.colour,
      is_shared: false,
      sort_order: index,
    }))
  )

  if (categoriesError) {
    return NextResponse.json({ error: categoriesError.message }, { status: 500 })
  }

  // Insert mission if provided
  if (mission?.trim()) {
    const { error: missionError } = await supabase
      .from('missions')
      .insert({ user_id: user.id, content: mission.trim(), is_active: true })

    if (missionError) {
      return NextResponse.json({ error: missionError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
