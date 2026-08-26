import type { Caller } from '@/lib/api-auth'
import type { ApiTokenScope } from '@/types'
import type { Refusal } from '@/lib/api'
import { listCategories, listWorkspaces } from '@/lib/workspace-server'
import {
  completeTask,
  createTask,
  listTasks,
  updateTask,
  DEFAULT_TASK_LIMIT,
  MAX_TASK_LIMIT,
  type TaskStatusFilter,
} from '@/lib/tasks-server'
import { extractTasks, saveParsedTasks } from '@/lib/brain-dump'
import { horizonFromAnchor, HORIZON_PRECISION_LABELS, type HorizonPrecision } from '@/lib/horizon'
import { MAX_CAPTURES_PER_DAY } from '@/lib/limits'

/**
 * The connector's tool surface (Phase 4.10).
 *
 * Seven tools, and the number is a decision rather than a stopping point: every
 * one of them goes through `lib/` helpers that the web app's own routes use, so
 * a tool cannot mean something different from the app doing the same thing
 * (PLAN.md §"The tool surface").
 *
 * **Scope is per tool, not per endpoint.** `/api/mcp` is reachable by any token
 * holding `tasks:read`, and each tool then names what it needs — so a read-only
 * token can list and cannot write, through one URL. That is the natural
 * extension of KB.md #45: the default is still the safe direction, because a
 * tool added later is refused until it declares a scope.
 *
 * **Nothing here knows how the caller authenticated.** A tool receives a
 * `Caller`, which is a user id, a Supabase client acting as them, and their
 * scopes. A session cookie, a personal access token and — in 4.11 — an OAuth
 * access token all produce one, so OAuth is a third way in rather than a
 * rewrite (KB.md #44, #46).
 */

/** The two things every handler gets, and the only two it should need. */
export interface ToolContext {
  caller: Caller
}

export interface ToolDefinition {
  name: string
  /** Written for a model, not for a changelog. */
  description: string
  inputSchema: Record<string, unknown>
  /** What a bearer token must hold. Session callers hold everything. */
  scope: ApiTokenScope
  handler: (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolOutcome>
}

export type ToolOutcome = { ok: true; data: unknown } | Refusal

/** The precisions a tool may name — the labels come from lib/horizon.ts. */
const PRECISIONS = Object.keys(HORIZON_PRECISION_LABELS) as HorizonPrecision[]

// ─── Argument narrowing ──────────────────────────────────────────────────────
//
// Arguments arrive from a model, so every one of them is checked. A refusal here
// is a sentence the model can act on: "which workspace" is answerable, "invalid
// params" is not.

function str(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function int(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) ? value : undefined
}

function requireStr(
  args: Record<string, unknown>,
  key: string
): { ok: true; value: string } | Refusal {
  const value = str(args[key])
  if (!value) return { ok: false, status: 400, error: `${key} is required` }
  return { ok: true, value }
}

/** A precision the horizon builder recognises, or a refusal naming the set. */
function precision(value: unknown): { ok: true; value: HorizonPrecision } | Refusal {
  const raw = str(value)
  if (!raw) return { ok: true, value: 'unplanned' }
  if (!PRECISIONS.includes(raw as HorizonPrecision)) {
    return {
      ok: false,
      status: 400,
      error: `horizon_precision must be one of: ${PRECISIONS.join(', ')}`,
    }
  }
  return { ok: true, value: raw as HorizonPrecision }
}

/**
 * The horizon a task should carry, from a precision and one date inside the
 * period. Anything else is refused rather than half-applied.
 */
function horizonFrom(args: Record<string, unknown>) {
  const p = precision(args.horizon_precision)
  if (!p.ok) return p
  const date = str(args.horizon_date) ?? null

  if (p.value !== 'unplanned' && !date) {
    return {
      ok: false as const,
      status: 400,
      error: 'horizon_date is required unless horizon_precision is "unplanned"',
    }
  }

  return { ok: true as const, value: horizonFromAnchor(p.value, date) }
}

// ─── Shared schema fragments ─────────────────────────────────────────────────

const WORKSPACE_ID = {
  type: 'string',
  description: 'Workspace id from list_workspaces.',
}

const HORIZON_ARGS = {
  horizon_precision: {
    type: 'string',
    enum: PRECISIONS,
    description:
      'How precisely the timing is known. "day" for a date, "week"/"month"/"quarter"/"year" for a period, "unplanned" when there is no timing.',
  },
  horizon_date: {
    type: 'string',
    description:
      'Any date inside the intended period, as YYYY-MM-DD. The server derives week start, quarter and month itself. Required unless the precision is "unplanned".',
  },
}

const TASK_FIELDS = {
  title: { type: 'string', description: 'Short, actionable, verb-first.' },
  notes: { type: 'string', description: 'Supporting context. Keep it brief.' },
  category_id: {
    type: ['string', 'null'],
    description:
      'From list_categories. A task’s category is what decides who can see it, so guess nothing — leave it null when unsure.',
  },
  due_date: { type: ['string', 'null'], description: 'A hard deadline, YYYY-MM-DD.' },
  ...HORIZON_ARGS,
}

// ─── The tools ───────────────────────────────────────────────────────────────

export const TOOLS: ToolDefinition[] = [
  {
    name: 'list_workspaces',
    description:
      'List the workspaces this user can act in: their personal workspace, plus every household they belong to. Every other tool takes a workspace id, so start here. The role matters: a "restricted" member cannot create or change tasks.',
    scope: 'tasks:read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    handler: async (_args, { caller }) => ({
      ok: true,
      data: { workspaces: await listWorkspaces(caller.supabase, caller.userId) },
    }),
  },

  {
    name: 'list_categories',
    description:
      'List the categories in one workspace. Call this before creating tasks: a category is what decides who can see a task, and category ids cannot be guessed from names.',
    scope: 'tasks:read',
    inputSchema: {
      type: 'object',
      properties: { workspace_id: WORKSPACE_ID },
      required: ['workspace_id'],
      additionalProperties: false,
    },
    handler: async (args, { caller }) => {
      const workspaceId = requireStr(args, 'workspace_id')
      if (!workspaceId.ok) return workspaceId

      const categories = await listCategories(caller.supabase, caller.userId, workspaceId.value)
      if (!categories) return { ok: false, status: 404, error: 'Workspace not found' }

      return { ok: true, data: { categories } }
    },
  },

  {
    name: 'list_tasks',
    description:
      'List tasks in a workspace. Filters combine: status, category, a horizon period, a due-date range. Defaults to open tasks (not started or in progress) — pass status "all" for everything including done and cancelled.',
    scope: 'tasks:read',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: WORKSPACE_ID,
        status: {
          type: 'string',
          enum: ['open', 'all', 'not_started', 'wip', 'done', 'cancelled'],
          description: 'Defaults to "open".',
        },
        category_id: { type: 'string', description: 'From list_categories.' },
        year: { type: 'integer', description: 'Tasks planned in this year.' },
        quarter: { type: 'integer', description: '1 to 4, with year.' },
        month: { type: 'integer', description: '1 to 12, with year.' },
        week: { type: 'string', description: 'Monday of the week, YYYY-MM-DD.' },
        day: { type: 'string', description: 'A single day, YYYY-MM-DD.' },
        unplanned: { type: 'boolean', description: 'Only tasks with no horizon at all.' },
        due_from: { type: 'string', description: 'Earliest due date, YYYY-MM-DD.' },
        due_to: { type: 'string', description: 'Latest due date, YYYY-MM-DD.' },
        limit: {
          type: 'integer',
          description: `Rows to return. Default ${DEFAULT_TASK_LIMIT}, maximum ${MAX_TASK_LIMIT}.`,
        },
      },
      required: ['workspace_id'],
      additionalProperties: false,
    },
    handler: async (args, { caller }) => {
      const workspaceId = requireStr(args, 'workspace_id')
      if (!workspaceId.ok) return workspaceId

      const result = await listTasks(caller.supabase, caller.userId, {
        workspaceId: workspaceId.value,
        // A model asking for "my tasks" means the ones outstanding, which is why
        // this default differs from the HTTP route's — that one answers a page
        // that then filters for itself.
        status: (str(args.status) as TaskStatusFilter | undefined) ?? 'open',
        categoryId: str(args.category_id) ?? null,
        horizon: {
          year: int(args.year),
          quarter: int(args.quarter),
          month: int(args.month),
          week: str(args.week),
          day: str(args.day),
        },
        unplannedOnly: args.unplanned === true,
        dueFrom: str(args.due_from),
        dueTo: str(args.due_to),
        limit: int(args.limit),
      })

      if (!result.ok) return result

      return { ok: true, data: { count: result.tasks.length, tasks: result.tasks } }
    },
  },

  {
    name: 'create_tasks',
    description:
      'Create one or more tasks in a workspace. Plural on purpose: a meeting or a brain dump produces several at once, and one call beats six. Returns the created tasks with their ids. Give a horizon rather than a due date unless there is a real deadline — a due date is a promise, a horizon is a plan.',
    scope: 'tasks:write',
    inputSchema: {
      type: 'object',
      properties: {
        workspace_id: WORKSPACE_ID,
        tasks: {
          type: 'array',
          minItems: 1,
          description: 'The tasks to create.',
          items: {
            type: 'object',
            properties: {
              ...TASK_FIELDS,
              assigned_to_user_id: {
                type: ['string', 'null'],
                description:
                  'Another member of the same workspace. They are asked to accept, and are notified.',
              },
            },
            required: ['title'],
            additionalProperties: false,
          },
        },
      },
      required: ['workspace_id', 'tasks'],
      additionalProperties: false,
    },
    handler: async (args, { caller }) => {
      const workspaceId = requireStr(args, 'workspace_id')
      if (!workspaceId.ok) return workspaceId

      const input = args.tasks
      if (!Array.isArray(input) || input.length === 0) {
        return { ok: false, status: 400, error: 'tasks must be a non-empty array' }
      }

      const created: { id: string; title: string }[] = []

      // One at a time, and the first failure stops the run: a partial batch that
      // reports what it did is recoverable, and a model can retry the rest.
      // Silently skipping a failure would be a task nobody knows is missing.
      for (let index = 0; index < input.length; index++) {
        const raw: unknown = input[index]
        if (typeof raw !== 'object' || raw === null) {
          return { ok: false, status: 400, error: `tasks[${index}] is not an object` }
        }
        const task = raw as Record<string, unknown>

        const title = requireStr(task, 'title')
        if (!title.ok) return { ...title, error: `tasks[${index}]: ${title.error}` }

        const horizon = horizonFrom(task)
        if (!horizon.ok) return { ...horizon, error: `tasks[${index}]: ${horizon.error}` }

        const result = await createTask(caller.supabase, caller.userId, {
          workspaceId: workspaceId.value,
          title: title.value,
          notes: str(task.notes) ?? null,
          categoryId: str(task.category_id) ?? null,
          dueDate: str(task.due_date) ?? null,
          horizon: horizon.value,
          assignedToUserId: str(task.assigned_to_user_id) ?? null,
        })

        if (!result.ok) {
          return {
            ...result,
            error: `tasks[${index}]: ${result.error}${created.length ? ` (${created.length} already created)` : ''}`,
          }
        }

        created.push({ id: result.task.id, title: result.task.title })
      }

      return { ok: true, data: { created: created.length, tasks: created } }
    },
  },

  {
    name: 'update_task',
    description:
      'Change a task. Only the fields given are touched. To reschedule, give a horizon_precision and a horizon_date; to clear a category or a due date, pass null. Use complete_task to finish a task rather than setting the status here — completing also advances a recurring task.',
    scope: 'tasks:write',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'From list_tasks or create_tasks.' },
        ...TASK_FIELDS,
        status: {
          type: 'string',
          enum: ['not_started', 'wip', 'cancelled'],
          description: 'Use complete_task for "done".',
        },
        assigned_to_user_id: {
          type: ['string', 'null'],
          description: 'Another member of the task’s workspace, or null to unassign.',
        },
      },
      required: ['task_id'],
      additionalProperties: false,
    },
    handler: async (args, { caller }) => {
      const taskId = requireStr(args, 'task_id')
      if (!taskId.ok) return taskId

      // A horizon is only rebuilt when the caller mentioned one — otherwise an
      // update of the title would quietly unplan the task.
      let horizon
      if ('horizon_precision' in args || 'horizon_date' in args) {
        const built = horizonFrom(args)
        if (!built.ok) return built
        horizon = built.value
      }

      const status = str(args.status)
      if (status === 'done') {
        return {
          ok: false,
          status: 400,
          error: 'Use complete_task to mark a task done — it also advances a recurring task',
        }
      }

      const result = await updateTask(caller.supabase, caller.userId, taskId.value, {
        title: str(args.title),
        notes: 'notes' in args ? (str(args.notes) ?? null) : undefined,
        status: status as 'not_started' | 'wip' | 'cancelled' | undefined,
        categoryId: 'category_id' in args ? (str(args.category_id) ?? null) : undefined,
        dueDate: 'due_date' in args ? (str(args.due_date) ?? null) : undefined,
        horizon,
        assignedToUserId:
          'assigned_to_user_id' in args ? (str(args.assigned_to_user_id) ?? null) : undefined,
      })

      if (!result.ok) return result

      return { ok: true, data: { task: result.task } }
    },
  },

  {
    name: 'complete_task',
    description:
      'Mark a task done. Separate from update_task because completing a recurring task also creates its next occurrence — the id of which comes back as next_task_id. Completing an already-done task is not an error.',
    scope: 'tasks:write',
    inputSchema: {
      type: 'object',
      properties: { task_id: { type: 'string', description: 'From list_tasks.' } },
      required: ['task_id'],
      additionalProperties: false,
    },
    handler: async (args, { caller }) => {
      const taskId = requireStr(args, 'task_id')
      if (!taskId.ok) return taskId

      const result = await completeTask(caller.supabase, caller.userId, taskId.value)
      if (!result.ok) return result

      return {
        ok: true,
        data: {
          task: result.task,
          next_task_id: result.nextTaskId,
          // The completion stands even when the follow-up failed, so say so
          // rather than implying a repeating task is still repeating.
          ...(result.recurrenceError ? { recurrence_error: result.recurrenceError } : {}),
        },
      }
    },
  },

  {
    name: 'capture',
    description: `Free text in, tasks out — the app's brain dump, callable. Give it a transcript, a note or a paragraph of thinking, and it extracts every distinct action, works out the timing from the words used, and saves them to the personal workspace. Prefer this over create_tasks when the input is prose rather than a list you have already decided on. Limited to ${MAX_CAPTURES_PER_DAY} calls per day, shared with the app's own brain dump — send one long text rather than several short ones.`,
    scope: 'tasks:write',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'The raw text. Prose is fine; so is a rough list.' },
        save: {
          type: 'boolean',
          description:
            'Default true. False extracts and returns without saving, which still costs one of the daily calls.',
        },
      },
      required: ['text'],
      additionalProperties: false,
    },
    handler: async (args, { caller }) => {
      const text = requireStr(args, 'text')
      if (!text.ok) return text

      const extracted = await extractTasks(caller.supabase, caller.userId, text.value)
      if (!extracted.ok) return extracted

      if (args.save === false) {
        return { ok: true, data: { saved: false, tasks: extracted.tasks, quota: extracted.quota } }
      }

      if (extracted.tasks.length === 0) {
        return { ok: true, data: { saved: true, created: 0, tasks: [], quota: extracted.quota } }
      }

      const saved = await saveParsedTasks(caller.supabase, caller.userId, extracted.tasks)
      if (!saved.ok) return saved

      return {
        ok: true,
        data: {
          saved: true,
          created: saved.tasks.length,
          tasks: saved.tasks,
          quota: extracted.quota,
        },
      }
    },
  },
]

/** The tool by that name, or undefined. */
export function findTool(name: string): ToolDefinition | undefined {
  return TOOLS.find(t => t.name === name)
}

/** What `tools/list` sends: everything except how the tool is implemented. */
export function toolListing(): { name: string; description: string; inputSchema: unknown }[] {
  return TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}
