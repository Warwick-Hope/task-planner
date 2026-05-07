import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getPersonalWorkspaceId } from '@/lib/workspace-server'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date')
  if (!date) return NextResponse.json({ error: 'date required' }, { status: 400 })

  // Fetch NNs joined with their tasks
  const { data, error } = await supabase
    .from('non_negotiables')
    .select('*, task:tasks(*)')
    .eq('user_id', user.id)
    .eq('date', date)
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ items: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: { task_id: string; date: string; sort_order?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { task_id, date, sort_order = 0 } = body
  if (!task_id || !date) return NextResponse.json({ error: 'task_id and date required' }, { status: 400 })

  const workspaceId = await getPersonalWorkspaceId(supabase, user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace' }, { status: 400 })

  // Enforce max 3 per day
  const { count } = await supabase
    .from('non_negotiables')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('date', date)

  if ((count ?? 0) >= 3) {
    return NextResponse.json({ error: 'Maximum 3 focus tasks per day' }, { status: 422 })
  }

  const { data, error } = await supabase
    .from('non_negotiables')
    .insert({ user_id: user.id, workspace_id: workspaceId, task_id, date, sort_order })
    .select('*, task:tasks(*)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}
