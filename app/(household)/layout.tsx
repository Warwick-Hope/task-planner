import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/auth/SignOutButton'
import WorkspaceSwitcher from '@/components/nav/WorkspaceSwitcher'

export default async function HouseholdLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const { data: memberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces!inner(id, name, type)')
    .eq('user_id', user.id)

  type WsRow = { id: string; name: string; type: 'personal' | 'household' }
  const allWorkspaces = (memberships ?? []).map((m) => m.workspaces as unknown as WsRow)

  const personal = allWorkspaces.find((w) => w.type === 'personal')
  const households = allWorkspaces.filter((w) => w.type === 'household')

  const switcherWorkspaces = [
    ...(personal ? [{ id: personal.id, name: 'Personal', type: 'personal' as const, href: '/dashboard' }] : []),
    ...households.map((h) => ({ id: h.id, name: h.name, type: 'household' as const, href: `/household/${h.id}` })),
  ]

  // Fallback current — switcher will override from pathname
  const currentHint = switcherWorkspaces[0] ?? { id: '', name: 'Household', type: 'household' as const, href: '/dashboard' }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors">
              Clarity
            </Link>
            <WorkspaceSwitcher current={currentHint} all={switcherWorkspaces} />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{profile.display_name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
