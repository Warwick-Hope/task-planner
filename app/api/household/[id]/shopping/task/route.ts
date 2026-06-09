import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

// Creates or returns an existing "Go shopping" task for this week.
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check for an existing active shopping task this week
  const today = new Date().toISOString().split('T')[0]
  const { data: existing } = await supabase
    .from('tasks')
    .select('id')
    .eq('workspace_id', params.id)
    .eq('source', 'shopping')
    .not('status', 'in', '("done","cancelled")')
    .gte('created_at', new Date(today + 'T00:00:00Z').toISOString())
    .limit(1)
    .single()

  if (existing) return NextResponse.json({ task: existing, created: false })

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: params.id,
      created_by: user.id,
      title: 'Go shopping',
      source: 'shopping',
      status: 'not_started',
    })
    .select('id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ task: data, created: true }, { status: 201 })
}
