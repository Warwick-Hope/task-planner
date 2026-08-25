import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/auth/SignOutButton'
import WorkspaceSwitcher from '@/components/nav/WorkspaceSwitcher'
import NotificationBell from '@/components/nav/NotificationBell'

/**
 * The chrome shared by both route groups: auth gate, workspace switcher,
 * notification bell, and the page frame.
 *
 * The personal and household layouts were 87 and 83 lines that differed in four
 * places — which nav to render, how the "current" workspace is derived, and two
 * incidental variations in the profile query and display-name fallback. Everything
 * else, including the pending-assignment query, was duplicated exactly.
 *
 * `variant` decides only what the switcher shows as current: personal pins to the
 * personal workspace, household leaves a hint that the switcher refines from the
 * pathname on the client.
 */
export interface AppShellProps {
  variant: 'personal' | 'household'
  nav: React.ReactNode
  children: React.ReactNode
}

type WorkspaceRow = { id: string; name: string; type: 'personal' | 'household' }

export default async function AppShell({ variant, nav, children }: AppShellProps) {
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

  const allWorkspaces = (memberships ?? []).map(m => m.workspaces as unknown as WorkspaceRow)
  const personal = allWorkspaces.find(w => w.type === 'personal')
  const households = allWorkspaces.filter(w => w.type === 'household')

  const personalEntry = { id: personal?.id ?? '', name: 'Personal', type: 'personal' as const, href: '/dashboard' }
  const switcherWorkspaces = [
    ...(personal ? [personalEntry] : []),
    ...households.map(h => ({ id: h.id, name: h.name, type: 'household' as const, href: `/household/${h.id}` })),
  ]

  // Pending assignment notifications across all household workspaces.
  const householdIds = households.map(h => h.id)
  let pendingAssignments: {
    taskId: string
    taskTitle: string
    workspaceId: string
    workspaceName: string
  }[] = []

  if (householdIds.length > 0) {
    const { data: pendingTasks } = await supabase
      .from('tasks')
      .select('id, title, workspace_id')
      .in('workspace_id', householdIds)
      .eq('assigned_to_user_id', user.id)
      .eq('assignment_status', 'pending')
      .not('status', 'in', '("done","cancelled")')

    pendingAssignments = (pendingTasks ?? []).map(t => ({
      taskId: t.id,
      taskTitle: t.title,
      workspaceId: t.workspace_id,
      workspaceName: households.find(h => h.id === t.workspace_id)?.name ?? 'Household',
    }))
  }

  // Household pages let the switcher work the current workspace out from the
  // pathname, so this is only a starting hint.
  const current =
    variant === 'personal'
      ? personalEntry
      : switcherWorkspaces.find(w => w.type === 'household') ??
        { id: '', name: 'Household', type: 'household' as const, href: '/dashboard' }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors"
            >
              Clarity
            </Link>
            <WorkspaceSwitcher current={current} all={switcherWorkspaces} />
            {nav}
          </div>
          <div className="flex items-center gap-3">
            <NotificationBell initial={pendingAssignments} />
            <span className="text-xs text-gray-400">{profile.display_name ?? user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
