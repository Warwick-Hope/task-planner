import { NextResponse } from 'next/server'
import { parseJson, badBody, refusal, trimmedString } from '@/lib/api'
import { requireCaller } from '@/lib/api-auth'
import { createTask, listTasks, type TaskStatusFilter } from '@/lib/tasks-server'
import { horizonFieldsFromInput } from '@/lib/horizon'
import type { TaskStatus, TaskSource } from '@/types'

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request, { scope: 'tasks:read' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const categoryId = searchParams.get('category')

  const result = await listTasks(supabase, userId, {
    workspaceId: params.id,
    status: (status as TaskStatusFilter | null) ?? 'all',
    categoryId: categoryId === 'all' ? null : categoryId,
  })

  if (!result.ok) return refusal(result)

  // A bare array, because this shape predates the connector and the household
  // task list reads it.
  return NextResponse.json(result.tasks)
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireCaller(request, { scope: 'tasks:write' })
  if (!auth.ok) return auth.response
  const { supabase, userId } = auth.caller

  const body = await parseJson<Record<string, unknown>>(request)
  if (!body) return badBody()

  const result = await createTask(supabase, userId, {
    workspaceId: params.id,
    title: trimmedString(body.title) ?? '',
    notes: trimmedString(body.notes),
    status: (body.status as TaskStatus) ?? undefined,
    categoryId: trimmedString(body.category_id),
    dueDate: trimmedString(body.due_date),
    horizon: horizonFieldsFromInput(body),
    isRecurring: body.is_recurring === true,
    recurrenceRule: trimmedString(body.recurrence_rule),
    recurrenceEndDate: trimmedString(body.recurrence_end_date),
    source: (body.source as TaskSource) ?? undefined,
    sourceId: trimmedString(body.source_id),
    assignedToUserId: trimmedString(body.assigned_to_user_id),
    assignedToProfileId: trimmedString(body.assigned_to_profile_id),
  })

  if (!result.ok) return refusal(result)

  return NextResponse.json({ id: result.task.id }, { status: 201 })
}
