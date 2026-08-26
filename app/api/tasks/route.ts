import { NextResponse } from 'next/server'
import { getPersonalWorkspaceId } from '@/lib/workspace-server'
import { requireCaller } from '@/lib/api-auth'
import { refusal, parseJson, badBody, trimmedString } from '@/lib/api'
import { createTask, listTasks, type TaskStatusFilter } from '@/lib/tasks-server'
import { horizonFieldsFromInput } from '@/lib/horizon'
import type { TaskStatus } from '@/types'

/**
 * The personal workspace's tasks.
 *
 * `GET` is new in Phase 4.10. The app never needed it — every page reads tasks
 * server-side and renders them — so the one thing a connector does most often
 * was the one thing the API could not do at all.
 */
export async function GET(request: Request) {
  const auth = await requireCaller(request, { scope: 'tasks:read' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  const workspaceId = await getPersonalWorkspaceId(supabase, userId)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })

  const { searchParams } = new URL(request.url)
  const number = (name: string) => {
    const raw = searchParams.get(name)
    if (raw === null) return undefined
    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : undefined
  }

  const result = await listTasks(supabase, userId, {
    workspaceId,
    status: (searchParams.get('status') as TaskStatusFilter | null) ?? 'all',
    categoryId: searchParams.get('category'),
    horizon: {
      year: number('year'),
      quarter: number('quarter'),
      month: number('month'),
      week: searchParams.get('week') ?? undefined,
      day: searchParams.get('day') ?? undefined,
    },
    dueFrom: searchParams.get('due_from') ?? undefined,
    dueTo: searchParams.get('due_to') ?? undefined,
    unplannedOnly: searchParams.get('unplanned') === 'true',
    limit: number('limit'),
  })

  if (!result.ok) return refusal(result)

  return NextResponse.json({ tasks: result.tasks })
}

export async function POST(request: Request) {
  const auth = await requireCaller(request, { scope: 'tasks:write' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  const workspaceId = await getPersonalWorkspaceId(supabase, userId)
  if (!workspaceId) return NextResponse.json({ error: 'No workspace found' }, { status: 400 })

  const body = await parseJson<Record<string, unknown>>(request)
  if (!body) return badBody()

  // The forms build their horizon fields with lib/horizon.ts and post the
  // result, so they are narrowed here rather than rebuilt (KB.md #22).
  const result = await createTask(supabase, userId, {
    workspaceId,
    title: trimmedString(body.title) ?? '',
    notes: trimmedString(body.notes),
    status: (body.status as TaskStatus) ?? undefined,
    categoryId: trimmedString(body.category_id),
    dueDate: trimmedString(body.due_date),
    horizon: horizonFieldsFromInput(body),
    isRecurring: body.is_recurring === true,
    recurrenceRule: trimmedString(body.recurrence_rule),
    recurrenceEndDate: trimmedString(body.recurrence_end_date),
  })

  if (!result.ok) return refusal(result)

  return NextResponse.json({ id: result.task.id }, { status: 201 })
}
