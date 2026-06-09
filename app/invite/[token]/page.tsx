import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import AcceptInviteButton from '@/components/household/AcceptInviteButton'

export const metadata = { title: 'Join household — Clarity' }

export default async function AcceptInvitePage({ params }: { params: { token: string } }) {
  const supabase = createClient()

  // Look up invitation by token
  const { data: invitation } = await supabase
    .from('household_invitations')
    .select('id, email, role, expires_at, accepted_at, workspace_id, workspaces(name)')
    .eq('token', params.token)
    .single()

  if (!invitation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid invite link</h1>
          <p className="text-sm text-gray-500 mb-6">
            This link doesn&apos;t exist or has already been used.
          </p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  const expired = new Date(invitation.expires_at) < new Date()
  const accepted = !!invitation.accepted_at
  const workspaceName = (invitation.workspaces as unknown as { name: string } | null)?.name ?? 'a household'

  if (expired || accepted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-2">
            {accepted ? 'Already accepted' : 'Invite link expired'}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {accepted
              ? 'This invitation has already been accepted.'
              : 'This invite link has expired. Ask the household owner to send a new one.'}
          </p>
          <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
            Go to dashboard
          </Link>
        </div>
      </div>
    )
  }

  // Check if user is logged in
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 max-w-sm w-full text-center">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
          Household invitation
        </p>
        <h1 className="text-xl font-bold text-gray-900 mb-1">
          Join {workspaceName}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          You&apos;ve been invited to join as{' '}
          <span className="font-medium">{invitation.role === 'restricted' ? 'a restricted member' : 'an adult member'}</span>.
        </p>

        {user ? (
          <AcceptInviteButton token={params.token} />
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-gray-400 mb-4">
              Sign in or create an account to accept this invitation.
            </p>
            <Link
              href={`/login?next=/invite/${params.token}`}
              className="block w-full rounded-md bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href={`/signup?next=/invite/${params.token}`}
              className="block w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Create account
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
