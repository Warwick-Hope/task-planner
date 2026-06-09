import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ChildProfilesManager from '@/components/household/ChildProfilesManager'
import HouseholdTaskList from '@/components/household/HouseholdTaskList'
import type { Task, Category } from '@/types'

export const metadata = { title: 'Household — Clarity' }

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function inNDays(n: number) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

export default async function HouseholdDashboardPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role, display_name')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!membership) redirect('/dashboard')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name, type')
    .eq('id', params.id)
    .single()

  if (!workspace || workspace.type !== 'household') redirect('/dashboard')

  const today = todayStr()
  const in7 = inNDays(7)

  const [
    { data: rawMembers },
    { data: rawProfiles },
    { data: rawCategories },
    { data: rawToday },
    { data: rawAssigned },
    { data: rawUpcoming },
  ] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('id, user_id, display_name, role')
      .eq('workspace_id', params.id)
      .not('user_id', 'is', null)
      .order('joined_at'),
    supabase
      .from('household_profiles')
      .select('id, name, avatar_colour, created_at')
      .eq('workspace_id', params.id)
      .order('created_at'),
    supabase
      .from('categories')
      .select('*')
      .eq('workspace_id', params.id)
      .is('owner_id', null)
      .order('sort_order'),
    // Today's tasks
    supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', params.id)
      .not('status', 'in', '("done","cancelled")')
      .or(`horizon_day.eq.${today},due_date.eq.${today}`),
    // Assigned to me (pending or accepted)
    supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', params.id)
      .eq('assigned_to_user_id', user.id)
      .in('assignment_status', ['pending', 'accepted'])
      .not('status', 'in', '("done","cancelled")'),
    // Upcoming: due in next 7 days (excluding today)
    supabase
      .from('tasks')
      .select('*')
      .eq('workspace_id', params.id)
      .not('status', 'in', '("done","cancelled")')
      .gt('due_date', today)
      .lte('due_date', in7),
  ])

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
  const categories: Category[] = (rawCategories ?? []) as Category[]
  const todayTasks: Task[] = (rawToday ?? []) as Task[]
  const assignedTasks: Task[] = (rawAssigned ?? []) as Task[]
  const upcomingTasks: Task[] = (rawUpcoming ?? []) as Task[]

  // Deduplicate: remove from assigned/upcoming if already in today
  const todayIds = new Set(todayTasks.map((t) => t.id))
  const assignedFiltered = assignedTasks.filter((t) => !todayIds.has(t.id))
  const upcomingFiltered = upcomingTasks.filter((t) => !todayIds.has(t.id))

  const isOwner = membership.role === 'owner'
  const canManage = membership.role !== 'restricted'

  const taskListProps = { categories, workspaceId: params.id, currentUserId: user.id, members, childProfiles }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Household workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/household/${params.id}/tasks`} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            All tasks
          </Link>
          <Link href={`/household/${params.id}/categories`} className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
            Categories
          </Link>
          {isOwner && (
            <Link href={`/household/${params.id}/invite`} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              Invite
            </Link>
          )}
        </div>
      </div>

      {/* Today */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Today</h2>
          {canManage && (
            <Link href={`/household/${params.id}/tasks/new`} className="text-xs text-blue-600 hover:text-blue-800 transition-colors">
              + Add task
            </Link>
          )}
        </div>
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          {todayTasks.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">No tasks scheduled for today.</p>
          ) : (
            <HouseholdTaskList tasks={todayTasks} {...taskListProps} />
          )}
        </div>
      </section>

      {/* Assigned to me */}
      {assignedFiltered.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Assigned to me</h2>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <HouseholdTaskList tasks={assignedFiltered} {...taskListProps} />
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcomingFiltered.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Upcoming — next 7 days</h2>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <HouseholdTaskList tasks={upcomingFiltered} {...taskListProps} />
          </div>
        </section>
      )}

      {/* Members & Children */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Members</h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
            {members.map((m) => (
              <li key={m.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm font-medium text-gray-900">
                  {m.displayName}
                  {m.userId === user.id && <span className="ml-1.5 text-xs text-gray-400">(you)</span>}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Children</h2>
          <ChildProfilesManager
            workspaceId={params.id}
            initialProfiles={rawProfiles ?? []}
            canManage={canManage}
          />
        </section>
      </div>
    </div>
  )
}
