import { NextResponse } from 'next/server'
import { requireCaller } from '@/lib/api-auth'
import { listWorkspaces } from '@/lib/workspace-server'

/**
 * What this caller can see: their personal workspace, plus every household.
 *
 * New in Phase 4.10, because the app never needed it — a page knows its
 * workspace from the URL. A connector does not: every other tool takes a
 * workspace id, so without this one there is nothing to pass them.
 */
export async function GET(request: Request) {
  const auth = await requireCaller(request, { scope: 'tasks:read' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  return NextResponse.json({ workspaces: await listWorkspaces(supabase, userId) })
}
