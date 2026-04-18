import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { Suspense } from 'react'
import { horizonSortKey } from '@/lib/horizon'
import TaskFilters from '@/components/tasks/TaskFilters'
import TaskRow from '@/components/tasks/TaskRow'
import type { Task, RoleCategory } from '@/types'

export const metadata = { title: 'Tasks — Task Planner' }

interface TaskWithRoles extends Task {
  task_roles: { role_category_id: string }[]
}

interface PageProps {
  searchParams: {
    status?: string
    role?: string
    view?: string
  }
}

export default async function TasksPage({ searchParams }: PageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch role categories for filters and display
  const { data: allRoles } = await supabase
    .from('role_categories')
    .select('id, name, colour, parent_id, sort_order')
    .eq('user_id', user!.id)
    .order('sort_order', { ascending: true })

  const roles: RoleCategory[] = allRoles ?? []

  // Build task query
  let query = supabase
    .from('tasks')
    .select('*, task_roles(role_category_id)')
    .eq('user_id', user!.id)

  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status)
  }

  if (searchParams.view === 'unplanned') {
    query = query.is('horizon_year', null)
  }

  const { data: rawTasks } = await query

  let tasks: TaskWithRoles[] = (rawTasks as TaskWithRoles[]) ?? []

  // Role filter — applied in TypeScript since it's a junction table
  if (searchParams.role && searchParams.role !== 'all') {
    const roleId = searchParams.role
    tasks = tasks.filter((t) => t.task_roles.some((tr) => tr.role_category_id === roleId))
  }

  // Sort by horizon (earliest first, unplanned last), then by created_at desc within same key
  tasks.sort((a, b) => {
    const ka = horizonSortKey(a)
    const kb = horizonSortKey(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const isEmpty = tasks.length === 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Tasks</h1>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + New task
        </Link>
      </div>

      {/* Filters wrapped in Suspense — required for useSearchParams in child */}
      <Suspense fallback={null}>
        <TaskFilters allRoles={roles} />
      </Suspense>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {isEmpty ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-400">No tasks match the current filters.</p>
            <Link
              href="/tasks/new"
              className="mt-3 inline-block text-sm text-blue-600 hover:underline"
            >
              Create your first task
            </Link>
          </div>
        ) : (
          <>
            {/* Column headers */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="w-5 shrink-0" />
              <div className="flex-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                Task
              </div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Role
              </div>
              <div className="w-32 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">
                When
              </div>
              <div className="w-10 shrink-0" />
            </div>

            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} allRoles={roles} />
            ))}
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400 text-right">
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </p>
    </div>
  )
}
