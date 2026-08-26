// ─── Enums ────────────────────────────────────────────────────────────────────

export type TaskStatus = 'not_started' | 'wip' | 'done' | 'cancelled'
export type WorkspaceType = 'personal' | 'household'
export type MemberRole = 'owner' | 'adult' | 'restricted'
export type TaskSource = 'manual' | 'brain_dump' | 'cleaning' | 'meal' | 'shopping'
export type AssignmentStatus = 'none' | 'pending' | 'accepted' | 'declined'

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  wip: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

// ─── Workspaces ───────────────────────────────────────────────────────────────

export interface Workspace {
  id: string
  type: WorkspaceType
  name: string
  created_by: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string | null // null = child profile
  role: MemberRole
  display_name: string
  joined_at: string
}

// ─── Profiles ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string
  display_name: string
  created_at: string
  updated_at: string
}

export interface HouseholdProfile {
  id: string
  workspace_id: string
  name: string
  avatar_colour: string
  created_by: string
  created_at: string
}

// ─── Categories ───────────────────────────────────────────────────────────────

export interface Category {
  id: string
  workspace_id: string
  owner_id: string | null // null = household-level category
  name: string
  colour: string
  is_shared: boolean
  sort_order: number
  parent_id: string | null
  created_at: string
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export interface Task {
  id: string
  workspace_id: string
  created_by: string
  assigned_to_user_id: string | null
  assigned_to_profile_id: string | null
  assignment_status: AssignmentStatus
  title: string
  notes: string | null
  status: TaskStatus
  priority: number | null // 1–3
  due_date: string | null
  due_time: string | null
  horizon_year: number | null
  horizon_half: number | null // 1–2
  horizon_quarter: number | null // 1–4
  horizon_month: number | null // 1–12
  horizon_week: string | null // week start date
  horizon_day: string | null
  horizon_time_slot: string | null
  is_recurring: boolean
  recurrence_rule: string | null
  recurrence_end_date: string | null
  parent_task_id: string | null
  source: TaskSource
  source_id: string | null
  category_id: string | null
  created_at: string
  updated_at: string
}

// ─── Non-negotiables ──────────────────────────────────────────────────────────

export interface NonNegotiable {
  id: string
  user_id: string
  workspace_id: string
  task_id: string
  date: string
  sort_order: number
  created_at: string
}

// ─── Mission & Values ─────────────────────────────────────────────────────────

export interface Mission {
  id: string
  user_id: string
  content: string
  is_active: boolean
  created_at: string
}

export interface Value {
  id: string
  user_id: string
  name: string
  description: string | null
  sort_order: number
  created_at: string
}

// ─── Household features ───────────────────────────────────────────────────────

export interface Room {
  id: string
  workspace_id: string
  name: string
  sort_order: number
  created_at: string
}

export interface Meal {
  id: string
  workspace_id: string
  name: string
  notes: string | null
  created_at: string
}

export interface MealPlan {
  id: string
  workspace_id: string
  meal_id: string
  planned_date: string
  servings: number | null
  created_at: string
}

export interface Ingredient {
  id: string
  meal_id: string
  name: string
  quantity: string | null
  unit: string | null
  created_at: string
}

export interface ShoppingListItem {
  id: string
  workspace_id: string
  name: string
  quantity: string | null
  unit: string | null
  shop_tag: string | null
  source: 'manual' | 'meal'
  source_id: string | null
  is_purchased: boolean
  added_by: string
  created_at: string
}

export interface HouseholdInvitation {
  id: string
  workspace_id: string
  email: string
  role: MemberRole
  token: string
  expires_at: string
  accepted_at: string | null
  created_by: string
  created_at: string
}

// A device's web push registration. Owner-only under RLS — see
// 20260826000001_push_subscriptions.sql.
export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
  user_agent: string | null
  created_at: string
  last_used_at: string | null
}

// ─── Joined/view types ────────────────────────────────────────────────────────

// Task with its category joined — used in list/detail views
export interface TaskWithCategory extends Task {
  category: Category | null
}

// Non-negotiable with its task joined — used on dashboard
export interface NonNegotiableWithTask extends NonNegotiable {
  task: Task
}
