import type { SupabaseClient } from '@supabase/supabase-js'
import type { Refusal } from '@/lib/api'
import type { Task, TaskStatus, TaskSource } from '@/types'
import { requireMember } from '@/lib/workspace-server'
import { buildHorizonFields, horizonFromAnchor, type HorizonFields } from '@/lib/horizon'
import { nextOccurrence } from '@/lib/recurrence'

/**
 * Reading and writing tasks, once rather than per caller.
 *
 * Phase 4.10 gave the same three operations a second front door — the MCP tool
 * surface — and the tools were never going to talk to the table directly
 * (PLAN.md §"The tool surface"). Rather than let `/api/tasks` and a tool drift
 * into two ideas of what "complete" means, both call these.
 *
 * The recurrence advance is the reason this matters most: completing a repeating
 * task also creates its next occurrence, and that was written inline in one
 * route's PATCH handler. A second copy in a tool would have been the fifth time
 * this codebase duplicated shared logic and the first time the duplicate could
 * silently stop creating anything (KB.md #24).
 */

/** `all` for no filter, `open` for everything not finished, or one status. */
export type TaskStatusFilter = 'all' | 'open' | TaskStatus

/** Statuses that mean the task is still real work. */
const OPEN_STATUSES: TaskStatus[] = ['not_started', 'wip']

export interface TaskListFilters {
  workspaceId: string
  status?: TaskStatusFilter
  categoryId?: string | null
  /** Equality on whichever horizon fields are given — all of them optional. */
  horizon?: {
    year?: number
    quarter?: number
    month?: number
    /** Monday of the week, YYYY-MM-DD. */
    week?: string
    day?: string
  }
  /** Inclusive bounds on `due_date`, as YYYY-MM-DD. */
  dueFrom?: string
  dueTo?: string
  /** No horizon at all — the "someday" pile. */
  unplannedOnly?: boolean
  limit?: number
}

/** Enough rows to be useful to a model, few enough to stay a sane payload. */
export const DEFAULT_TASK_LIMIT = 100
export const MAX_TASK_LIMIT = 500

export type ListTasksResult = { ok: true; tasks: Task[] } | Refusal
export type TaskResult = { ok: true; task: Task } | Refusal

/**
 * Tasks in one workspace, filtered.
 *
 * Membership is checked before the query rather than left to RLS, so a caller
 * who is not a member gets a 403 that says so instead of an empty list that
 * looks like an empty workspace.
 */
export async function listTasks(
  supabase: SupabaseClient,
  userId: string,
  filters: TaskListFilters
): Promise<ListTasksResult> {
  const membership = await requireMember(supabase, filters.workspaceId, userId)
  if (!membership) return { ok: false, status: 403, error: 'Forbidden' }

  let query = supabase.from('tasks').select('*').eq('workspace_id', filters.workspaceId)

  const status = filters.status ?? 'all'
  if (status === 'open') query = query.in('status', OPEN_STATUSES)
  else if (status !== 'all') query = query.eq('status', status)

  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)

  const h = filters.horizon
  if (h?.year !== undefined) query = query.eq('horizon_year', h.year)
  if (h?.quarter !== undefined) query = query.eq('horizon_quarter', h.quarter)
  if (h?.month !== undefined) query = query.eq('horizon_month', h.month)
  if (h?.week) query = query.eq('horizon_week', h.week)
  if (h?.day) query = query.eq('horizon_day', h.day)

  if (filters.unplannedOnly) query = query.is('horizon_year', null)
  if (filters.dueFrom) query = query.gte('due_date', filters.dueFrom)
  if (filters.dueTo) query = query.lte('due_date', filters.dueTo)

  const limit = Math.min(Math.max(filters.limit ?? DEFAULT_TASK_LIMIT, 1), MAX_TASK_LIMIT)

  const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
  if (error) return { ok: false, status: 500, error: error.message }

  return { ok: true, tasks: (data ?? []) as Task[] }
}

export interface CreateTaskInput {
  workspaceId: string
  title: string
  notes?: string | null
  status?: TaskStatus
  categoryId?: string | null
  dueDate?: string | null
  /**
   * Already built by `lib/horizon.ts` — either from a form's precision and
   * dates, or by `horizonFromAnchor` for a caller that has one date and a word
   * for how precise it is. Never assembled by hand (KB.md #22).
   */
  horizon?: HorizonFields
  isRecurring?: boolean
  recurrenceRule?: string | null
  recurrenceEndDate?: string | null
  source?: TaskSource
  /** What the task came from — a room for cleaning, a meal for a meal plan. */
  sourceId?: string | null
  assignedToUserId?: string | null
  assignedToProfileId?: string | null
}

/**
 * Creates one task in a workspace the caller belongs to.
 *
 * Horizon columns come from `lib/horizon.ts` and are never accepted from the
 * caller (KB.md #22). A restricted member cannot create at all — RLS enforces
 * membership but not role, so that check has to happen here.
 */
export async function createTask(
  supabase: SupabaseClient,
  userId: string,
  input: CreateTaskInput
): Promise<TaskResult> {
  const title = input.title?.trim()
  if (!title) return { ok: false, status: 400, error: 'Title is required' }

  const membership = await requireMember(supabase, input.workspaceId, userId, {
    blockRestricted: true,
  })
  if (!membership) return { ok: false, status: 403, error: 'Forbidden' }

  if (input.assignedToUserId) {
    const assignee = await requireMember(supabase, input.workspaceId, input.assignedToUserId)
    if (!assignee) {
      return { ok: false, status: 400, error: 'Assignee is not a member of this workspace' }
    }
  }

  if (input.assignedToProfileId) {
    const { data: profile } = await supabase
      .from('household_profiles')
      .select('id')
      .eq('id', input.assignedToProfileId)
      .eq('workspace_id', input.workspaceId)
      .single()
    if (!profile) return { ok: false, status: 400, error: 'Profile not found' }
  }

  const horizon = input.horizon ?? buildHorizonFields('unplanned', {})

  const assigned = input.assignedToUserId || input.assignedToProfileId

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: input.workspaceId,
      created_by: userId,
      title,
      notes: input.notes?.trim() || null,
      status: input.status ?? 'not_started',
      category_id: input.categoryId ?? null,
      due_date: input.dueDate ?? null,
      is_recurring: input.isRecurring ?? false,
      recurrence_rule: input.recurrenceRule ?? null,
      recurrence_end_date: input.recurrenceEndDate ?? null,
      source: input.source ?? 'manual',
      source_id: input.sourceId ?? null,
      assigned_to_user_id: input.assignedToUserId ?? null,
      assigned_to_profile_id: input.assignedToProfileId ?? null,
      assignment_status: assigned ? 'pending' : 'none',
      ...horizon,
    })
    .select('*')
    .single()

  if (error) return { ok: false, status: 500, error: error.message }

  return { ok: true, task: data as Task }
}

/**
 * The task, if this caller may act on it.
 *
 * A missing row and a row RLS is hiding are the same answer here — 404, not 403.
 * That is not politeness: RLS returns no row, so there is nothing to tell apart,
 * and pretending otherwise would leak that the id exists.
 */
export async function resolveTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string
): Promise<TaskResult> {
  const { data } = await supabase.from('tasks').select('*').eq('id', taskId).single()
  if (!data) return { ok: false, status: 404, error: 'Not found' }

  const task = data as Task
  if (task.created_by !== userId) {
    const membership = await requireMember(supabase, task.workspace_id, userId)
    if (!membership) return { ok: false, status: 403, error: 'Forbidden' }
  }

  return { ok: true, task }
}

export interface UpdateTaskInput {
  title?: string
  notes?: string | null
  status?: TaskStatus
  categoryId?: string | null
  dueDate?: string | null
  /** Built by lib/horizon.ts. Omit to leave the horizon alone. */
  horizon?: HorizonFields
  assignedToUserId?: string | null
}

/**
 * Changes the fields a caller named, and only those.
 *
 * `/api/tasks/[id]` PATCH keeps its own column-level handler rather than calling
 * this: a form legitimately speaks in columns, and it needs the difference
 * between "not mentioned" and "explicitly cleared" for each of them. This takes
 * a horizon that has already been built instead, because the caller it exists
 * for is a model, and a model handed seven horizon columns fills them
 * inconsistently (KB.md #22).
 */
export async function updateTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string,
  input: UpdateTaskInput
): Promise<TaskResult> {
  const found = await resolveTask(supabase, userId, taskId)
  if (!found.ok) return found

  const patch: Record<string, unknown> = {}
  if (input.title !== undefined) {
    const title = input.title.trim()
    if (!title) return { ok: false, status: 400, error: 'Title cannot be empty' }
    patch.title = title
  }
  if (input.notes !== undefined) patch.notes = input.notes?.trim() || null
  if (input.status !== undefined) patch.status = input.status
  if (input.categoryId !== undefined) patch.category_id = input.categoryId
  if (input.dueDate !== undefined) patch.due_date = input.dueDate
  if (input.horizon) Object.assign(patch, input.horizon)

  if (input.assignedToUserId !== undefined) {
    if (input.assignedToUserId) {
      const assignee = await requireMember(supabase, found.task.workspace_id, input.assignedToUserId)
      if (!assignee) {
        return { ok: false, status: 400, error: 'Assignee is not a member of this workspace' }
      }
      patch.assigned_to_user_id = input.assignedToUserId
      patch.assignment_status = 'pending'
    } else {
      patch.assigned_to_user_id = null
      patch.assignment_status = 'none'
    }
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, status: 400, error: 'Nothing to update' }
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', taskId)
    .select('*')
    .single()

  if (error) return { ok: false, status: 500, error: error.message }
  if (!data) return { ok: false, status: 404, error: 'Not found' }

  return { ok: true, task: data as Task }
}

/**
 * Creates the next occurrence of a recurring task that has just been completed.
 *
 * Returns the new task's id, or null when the rule has run out. A failure here
 * is reported rather than thrown: the completion itself has already succeeded,
 * and silently dropping the next occurrence is how a repeating task quietly
 * stops repeating.
 */
export async function advanceRecurrence(
  supabase: SupabaseClient,
  task: Task
): Promise<{ nextTaskId: string | null; error?: string }> {
  if (!task.is_recurring || !task.recurrence_rule) return { nextTaskId: null }

  const afterDate = task.due_date ?? new Date().toISOString().split('T')[0]
  const nextDate = nextOccurrence(task.recurrence_rule, afterDate)
  if (!nextDate) return { nextTaskId: null }

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      workspace_id: task.workspace_id,
      created_by: task.created_by,
      title: task.title,
      notes: task.notes,
      status: 'not_started',
      category_id: task.category_id,
      due_date: nextDate,
      is_recurring: true,
      recurrence_rule: task.recurrence_rule,
      recurrence_end_date: task.recurrence_end_date,
      source: task.source,
      ...horizonFromAnchor('day', nextDate),
    })
    .select('id')
    .single()

  if (error) {
    console.error('Next-occurrence insert failed:', error.message)
    return { nextTaskId: null, error: error.message }
  }

  return { nextTaskId: (data as { id: string }).id }
}

export type CompleteTaskResult =
  | { ok: true; task: Task; nextTaskId: string | null; recurrenceError?: string }
  | Refusal

/**
 * Marks a task done, and advances its recurrence if it has one.
 *
 * This is a separate operation from a general update because completing is not
 * only a status change — it is the one status change that creates something.
 * Completing an already-done task is not an error; it just has nothing to do.
 */
export async function completeTask(
  supabase: SupabaseClient,
  userId: string,
  taskId: string
): Promise<CompleteTaskResult> {
  const found = await resolveTask(supabase, userId, taskId)
  if (!found.ok) return found

  const existing = found.task
  if (existing.status === 'done') {
    return { ok: true, task: existing, nextTaskId: null }
  }

  const { data, error } = await supabase
    .from('tasks')
    .update({ status: 'done' })
    .eq('id', taskId)
    .select('*')
    .single()

  if (error) return { ok: false, status: 500, error: error.message }
  if (!data) return { ok: false, status: 404, error: 'Not found' }

  const { nextTaskId, error: recurrenceError } = await advanceRecurrence(supabase, existing)

  return { ok: true, task: data as Task, nextTaskId, recurrenceError }
}
