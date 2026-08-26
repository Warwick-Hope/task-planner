import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { unauthorised, parseJson, badBody } from '@/lib/api'
import { saveParsedTasks, type ParsedTask } from '@/lib/brain-dump'

/**
 * Saves what the review panel confirmed. Session-only, like the extract route:
 * the tool surface saves through `lib/brain-dump.ts` directly (KB.md #45).
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const body = await parseJson<{ tasks?: ParsedTask[] }>(request)
  if (!body) return badBody()

  const result = await saveParsedTasks(supabase, user.id, body.tasks ?? [])
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ saved: result.tasks.length, tasks: result.tasks })
}
