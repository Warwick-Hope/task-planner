import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TaskListClient from '@/components/tasks/TaskListClient'
import { horizonSortKey } from '@/lib/horizon'
import type { Task, Category } from '@/types'

export const metadata = { title: 'Household tasks — Clarity' }

interface PageProps {
  params: { id: string }
  searchParams: { status?: string; category?: string }
}

export default async function HouseholdTasksPage({ params, searchParams }: PageProps) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/dashboard')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', params.id)
    .single()

  // Household categories (owner_id null)
  const { data: allCategories } = await supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', params.id)
    .is('owner_id', null)
    .order('sort_order', { ascending: true })

  const categories: Category[] = (allCategories ?? []) as Category[]

  let query = supabase
    .from('tasks')
    .select('*')
    .eq('workspace_id', params.id)

  if (searchParams.status && searchParams.status !== 'all') {
    query = query.eq('status', searchParams.status)
  }

  if (searchParams.category && searchParams.category !== 'all') {
    const ids = searchParams.category.split(',').filter(Boolean)
    if (ids.length === 1) query = query.eq('category_id', ids[0])
    else if (ids.length > 1) query = query.in('category_id', ids)
  }

  const { data: rawTasks } = await query

  const tasks: Task[] = ((rawTasks as Task[]) ?? []).sort((a, b) => {
    const ka = horizonSortKey(a)
    const kb = horizonSortKey(b)
    if (ka !== kb) return ka < kb ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })

  const canCreate = membership.role !== 'restricted'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={`/household/${params.id}`}
            className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            ← {workspace?.name ?? 'Household'}
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Tasks</h1>
        </div>
        {canCreate && (
          <Link
            href={`/household/${params.id}/tasks/new`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            + New task
          </Link>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        {tasks.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-gray-400">No tasks yet.</p>
            {canCreate && (
              <Link
                href={`/household/${params.id}/tasks/new`}
                className="mt-3 inline-block text-sm text-blue-600 hover:underline"
              >
                Create the first household task
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="w-5 shrink-0" />
              <div className="flex-1 text-xs font-medium text-gray-400 uppercase tracking-wide">Task</div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Category</div>
              <div className="w-32 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">When</div>
              <div className="w-10 shrink-0" />
            </div>
            <TaskListClient tasks={tasks} categories={categories} />
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400 text-right">
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </p>
    </div>
  )
}
