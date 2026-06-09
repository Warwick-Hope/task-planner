import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/auth/SignOutButton'
import WorkspaceSwitcher from '@/components/nav/WorkspaceSwitcher'
import NotificationBell from '@/components/nav/NotificationBell'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces!inner(id, name, type)')
    .eq('user_id', user.id)

  type WsRow = { id: string; name: string; type: 'personal' | 'household' }
  const allWorkspaces = (memberships ?? []).map((m) => {
    const ws = m.workspaces as unknown as WsRow
    return ws
  })

  const personal = allWorkspaces.find((w) => w.type === 'personal')
  const households = allWorkspaces.filter((w) => w.type === 'household')

  const switcherWorkspaces = [
    ...(personal ? [{ id: personal.id, name: 'Personal', type: 'personal' as const, href: '/dashboard' }] : []),
    ...households.map((h) => ({ id: h.id, name: h.name, type: 'household' as const, href: `/household/${h.id}` })),
  ]

  // Pending assignment notifications across all household workspaces
  const householdIds = households.map((h) => h.id)
  let pendingAssignments: { taskId: string; taskTitle: string; workspaceId: string; workspaceName: string }[] = []
  if (householdIds.length > 0) {
    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('id, title, workspace_id')
      .in('workspace_id', householdIds)
      .eq('assigned_to_user_id', user.id)
      .eq('assignment_status', 'pending')
      .not('status', 'in', '("done","cancelled")')

    pendingAssignments = (pendingTasks ?? []).map((t) => {
      const ws = households.find((h) => h.id === t.workspace_id)
      return { taskId: t.id, taskTitle: t.title, workspaceId: t.workspace_id, workspaceName: ws?.name ?? 'Household' }
    })
  }

  const currentWorkspace = personal
    ? { id: personal.id, name: 'Personal', type: 'personal' as const, href: '/dashboard' }
    : { id: '', name: 'Personal', type: 'personal' as const, href: '/dashboard' }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors">
              Clarity
            </Link>
            <WorkspaceSwitcher current={currentWorkspace} all={switcherWorkspaces} />
            <nav className="flex items-center gap-4">
              <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Dashboard</Link>
              <Link href="/tasks" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Tasks</Link>
              <Link href="/plan" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Plan</Link>
              <Link href="/calendar" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Calendar</Link>
              <Link href="/brain-dump" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Brain dump</Link>
              <Link href="/roles" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Categories</Link>
              <Link href="/mission" className="text-sm text-gray-500 hover:text-gray-900 transition-colors">Mission</Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell initial={pendingAssignments} />
            <span className="text-xs text-gray-400">{profile?.display_name ?? user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
