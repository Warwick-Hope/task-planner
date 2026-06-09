import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import RoomsManager from '@/components/household/RoomsManager'
import type { Room } from '@/types'

export const metadata = { title: 'Rooms — Clarity' }

export default async function RoomsPage({ params }: { params: { id: string } }) {
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
    .select('name, type')
    .eq('id', params.id)
    .single()

  if (!workspace || workspace.type !== 'household') redirect('/dashboard')

  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, sort_order, created_at')
    .eq('workspace_id', params.id)
    .order('sort_order')

  const canManage = membership.role === 'owner' || membership.role === 'adult'

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

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Rooms</h1>
        <p className="text-sm text-gray-500 mb-6">
          Rooms group cleaning tasks by area of your home.
        </p>

        <RoomsManager
          workspaceId={params.id}
          initialRooms={(rooms ?? []) as Room[]}
          canManage={canManage}
        />
      </div>
    </div>
  )
}
