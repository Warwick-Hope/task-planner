import { createClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'
import { unauthorised, parseJson, badBody } from '@/lib/api'
import { extractTasks } from '@/lib/brain-dump'

/**
 * The extraction itself lives in `lib/brain-dump.ts`, because the MCP `capture`
 * tool is the same operation arriving by a different door (Phase 4.10), and the
 * daily quota has to be one budget rather than two.
 *
 * This route stays **session-only**: it is the textarea's endpoint, and a token
 * reaches the same work through `/api/mcp` (KB.md #45).
 */
export async function POST(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return unauthorised()

  const body = await parseJson<{ text?: unknown }>(request)
  if (!body) return badBody()

  const result = await extractTasks(supabase, user.id, body.text)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ tasks: result.tasks, quota: result.quota })
}
