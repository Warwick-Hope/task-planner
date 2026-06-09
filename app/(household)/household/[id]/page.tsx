import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ChildProfilesManager from '@/components/household/ChildProfilesManager'

export const metadata = { title: 'Household — Clarity' }

export default async function HouseholdDashboardPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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

  const [{ data: members }, { data: childProfiles }] = await Promise.all([
    supabase
      .from('workspace_members')
      .select('id, display_name, role, user_id')
      .eq('workspace_id', params.id)
      .order('joined_at'),
    supabase
      .from('household_profiles')
      .select('id, name, avatar_colour, created_at')
      .eq('workspace_id', params.id)
      .order('created_at'),
  ])

  const isOwner = membership.role === 'owner'
  const canManage = membership.role === 'owner' || membership.role === 'adult'

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{workspace.name}</h1>
          <p className="text-sm text-gray-500 mt-1">Household workspace</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/household/${params.id}/tasks`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Tasks
          </Link>
          <Link
            href={`/household/${params.id}/categories`}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Categories
          </Link>
          {isOwner && (
            <Link
              href={`/household/${params.id}/invite`}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Invite member
            </Link>
          )}
        </div>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Adult members
        </h2>
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
          {(members ?? []).map((m) => (
            <li key={m.id} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-medium text-gray-900">{m.display_name}</p>
              <span className="text-xs text-gray-400 capitalize">{m.role}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
          Children
        </h2>
        <ChildProfilesManager
          workspaceId={params.id}
          initialProfiles={childProfiles ?? []}
          canManage={canManage}
        />
      </section>

    </div>
  )
}
