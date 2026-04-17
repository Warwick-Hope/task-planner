export type TaskStatus = 'not_started' | 'wip' | 'done' | 'cancelled'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  wip: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

export interface Task {
  id: string
  user_id: string
  title: string
  notes: string | null
  parent_task_id: string | null
  status: TaskStatus
  horizon_year: number | null
  horizon_half: number | null
  horizon_quarter: number | null
  horizon_month: number | null
  horizon_week: string | null
  horizon_day: string | null
  horizon_time_slot: string | null
  created_at: string
  updated_at: string
}

export interface RoleCategory {
  id: string
  name: string
  colour: string | null
  parent_id: string | null
  sort_order: number
}
