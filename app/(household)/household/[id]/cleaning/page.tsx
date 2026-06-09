import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import CleaningTabs from '@/components/household/CleaningTabs'
import type { Room, Task, Category } from '@/types'

export const metadata = { title: 'Cleaning — Clarity' }

export default async function CleaningPage({ params }: { params: { id: string } }) {
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

  const [
    { data: rooms },
    { data: tasks },
    { data: categories },
    { data: rawMembers },
    { data: rawProfiles },
  ] = await Promise.all([
    supabase.from('rooms').select('*').eq('workspace_id', params.id).order('sort_order'),
    supabase.from('tasks').select('*').eq('workspace_id', params.id).eq('source', 'cleaning').not('status', 'in', '("cancelled")').order('created_at'),
    supabase.from('categories').select('*').eq('workspace_id', params.id).is('owner_id', null).order('sort_order'),
    supabase.from('workspace_members').select('id, user_id, display_name, role').eq('workspace_id', params.id).not('user_id', 'is', null).order('joined_at'),
    supabase.from('household_profiles').select('id, name, avatar_colour').eq('workspace_id', params.id).order('created_at'),
  ])

  const canManage = membership.role !== 'restricted'
  const today = new Date().toISOString().split('T')[0]

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/household/${params.id}`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← {workspace.name}
          </Link>
        </div>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cleaning</h1>
          <Link
            href={`/household/${params.id}/rooms`}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Manage rooms →
          </Link>
        </div>

        <CleaningTabs
          workspaceId={params.id}
          rooms={(rooms ?? []) as Room[]}
          tasks={(tasks ?? []) as Task[]}
          categories={(categories ?? []) as Category[]}
          members={members}
          childProfiles={childProfiles}
          canManage={canManage}
          today={today}
        />
      </div>
    </div>
  )
}
