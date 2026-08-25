import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import HouseholdTaskList from '@/components/household/HouseholdTaskList'
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

  const [
    { data: allCategories },
    { data: rawMembers },
    { data: rawProfiles },
  ] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('workspace_id', params.id)
      .is('owner_id', null)
      .order('sort_order', { ascending: true }),
    supabase
      .from('workspace_members')
      .select('id, user_id, display_name, role')
      .eq('workspace_id', params.id)
      .not('user_id', 'is', null)
      .order('joined_at'),
    supabase
      .from('household_profiles')
      .select('id, name, avatar_colour')
      .eq('workspace_id', params.id)
      .order('created_at'),
  ])

  const categories: Category[] = (allCategories ?? []) as Category[]
  const members = (rawMembers ?? []).map((m) => ({
    id: m.id,
    userId: m.user_id as string,
    displayName: m.display_name,
  }))
  const childProfiles = (rawProfiles ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    avatarColour: p.avatar_colour,
  }))

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
      <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
        <div>
          <Link href={`/household/${params.id}`} className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            ← {workspace?.name ?? 'Household'}
          </Link>
          <h1 className="text-xl font-semibold text-gray-900 mt-1">Tasks</h1>
        </div>
        {canCreate && (
          <Link
            href={`/household/${params.id}/tasks/new`}
            className="shrink-0 whitespace-nowrap rounded-lg bg-blue-600 px-4 py-2.5 sm:py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
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
              <Link href={`/household/${params.id}/tasks/new`} className="mt-3 inline-block text-sm text-blue-600 hover:underline">
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
              <div className="w-28 text-right text-xs font-medium text-gray-400 uppercase tracking-wide">When</div>
              <div className="text-xs font-medium text-gray-400 uppercase tracking-wide">Assigned</div>
              <div className="w-16 shrink-0" />
            </div>
            <HouseholdTaskList
              tasks={tasks}
              categories={categories}
              workspaceId={params.id}
              currentUserId={user.id}
              members={members}
              childProfiles={childProfiles}
            />
          </>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-400 text-right">
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </p>
    </div>
  )
}
