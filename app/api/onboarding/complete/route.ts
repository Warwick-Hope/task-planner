import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

interface RoleCategory {
  name: string
  colour: string
}

interface OnboardingPayload {
  displayName: string
  roleCategories: RoleCategory[]
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
    return NextResponse.json({ error: 'At least one role category is required' }, { status: 400 })
  }

  // Insert profile
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: user.id, display_name: displayName.trim() })

  if (profileError) {
    // Profile already exists — onboarding already completed
    if (profileError.code === '23505') {
      return NextResponse.json({ error: 'Already onboarded' }, { status: 409 })
    }
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  // Insert role categories
  const { error: rolesError } = await supabase.from('role_categories').insert(
    roleCategories.map((rc, index) => ({
      user_id: user.id,
      name: rc.name.trim(),
      colour: rc.colour,
      sort_order: index,
    }))
  )

  if (rolesError) {
    return NextResponse.json({ error: rolesError.message }, { status: 500 })
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
