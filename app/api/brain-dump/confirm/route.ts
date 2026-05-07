import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { getPersonalWorkspaceId } from '@/lib/workspace-server'
import { buildHorizonFields } from '@/lib/horizon'
import type { ParsedTask } from '../route'

export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  let body: { tasks: ParsedTask[] }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { tasks } = body
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'No tasks to save' }, { status: 400 })
  }

  const workspaceId = await getPersonalWorkspaceId(supabase, user.id)
  if (!workspaceId) return NextResponse.json({ error: 'No personal workspace found' }, { status: 400 })

  const rows = tasks.map(t => {
    // Build horizon fields from the precision + individual date fields
    const horizonFields = buildHorizonFields(t.horizon_precision, {
      year: t.horizon_year ?? undefined,
      quarter: (t.horizon_quarter as 1 | 2 | 3 | 4) ?? undefined,
      month: t.horizon_month ?? undefined,
      weekStr: t.horizon_week ?? undefined,
      dayStr: t.horizon_day ?? undefined,
    })

    return {
      workspace_id: workspaceId,
      created_by: user.id,
      title: t.title,
      notes: t.notes || null,
      status: 'not_started' as const,
      category_id: t.category_id,
      source: 'brain_dump' as const,
      ...horizonFields,
    }
  })

  const { error } = await supabase.from('tasks').insert(rows)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: rows.length })
}
