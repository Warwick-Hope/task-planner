import type { TaskStatus } from '@/types'

/**
 * The single definition of how task status behaves and looks.
 *
 * This was previously copy-pasted into five components (TaskRow,
 * HouseholdTaskRow, DashboardTaskRow, CleaningView, CleaningScheduleView),
 * which meant a change to the cycle or the icons had to be made five times and
 * silently applied to whichever ones you remembered.
 */

/** Clicking a task's status advances it through this cycle. */
export const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  not_started: 'wip',
  wip: 'done',
  done: 'not_started',
  cancelled: 'not_started',
}

/** The status a task moves to when its indicator is clicked. */
export function nextStatus(status: TaskStatus): TaskStatus {
  return STATUS_CYCLE[status]
}

export interface StatusDisplay {
  icon: string
  className: string
}

/** Icon and colour for a status indicator. */
export const STATUS_DISPLAY: Record<TaskStatus, StatusDisplay> = {
  not_started: { icon: '○', className: 'text-gray-300 hover:text-gray-500' },
  wip: { icon: '◉', className: 'text-blue-500 hover:text-blue-600' },
  done: { icon: '✓', className: 'text-green-500 hover:text-green-600' },
  cancelled: { icon: '—', className: 'text-gray-300 hover:text-gray-500' },
}

/** A task still needing attention. Everything else is finished with, one way or another. */
export const OPEN_STATUSES: TaskStatus[] = ['not_started', 'wip']

export const ALL_STATUSES: TaskStatus[] = ['not_started', 'wip', 'done', 'cancelled']

/** What a task list shows when the URL says nothing. */
export const DEFAULT_STATUS_FILTER = 'open'

/**
 * The statuses a `?status=` value selects, or `null` for "do not filter".
 *
 * An absent or unrecognised value means the default rather than an empty list —
 * a mistyped URL should show the usual list, not zero tasks.
 */
export function statusesForFilter(value: string | undefined): TaskStatus[] | null {
  const filter = value ?? DEFAULT_STATUS_FILTER
  if (filter === 'all') return null
  const one = ALL_STATUSES.find(s => s === filter)
  return one ? [one] : OPEN_STATUSES
}
