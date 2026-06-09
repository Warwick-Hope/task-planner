import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import InviteForm from '@/components/household/InviteForm'

export const metadata = { title: 'Invite member — Clarity' }

export default async function InvitePage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (membership?.role !== 'owner') redirect(`/household/${params.id}`)

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', params.id)
    .single()

  const { data: invitations } = await supabase
    .from('household_invitations')
    .select('id, email, role, expires_at, accepted_at, created_at')
    .eq('workspace_id', params.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-8">
        <Link
          href={`/household/${params.id}`}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← {workspace?.name ?? 'Household'}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Invite a member</h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate an invite link to share with someone you want to join the household.
        </p>
      </div>

      <InviteForm workspaceId={params.id} initialInvitations={invitations ?? []} />
    </div>
  )
}
