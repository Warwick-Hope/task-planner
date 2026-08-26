import { createClient } from '@/lib/supabase-server'
import TokenManager from '@/components/settings/TokenManager'

export const metadata = { title: 'Connections — Clarity' }

export default async function ConnectionsPage() {
  const supabase = createClient()

  // Owner-only under RLS, so no filter is needed here — but the token hash is
  // deliberately not selected: nothing outside the resolver ever needs it.
  const { data: tokens } = await supabase
    .from('api_tokens')
    .select('id, name, token_prefix, scopes, expires_at, revoked_at, last_used_at, created_at')
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Connections</h1>
        <p className="mt-1 text-sm text-gray-500">
          Access tokens let something outside the app — a script, or Claude — read and create your
          tasks. A token acts as you, so give each one its own name and revoke anything you no
          longer recognise.
        </p>
      </div>
      <div className="max-w-2xl">
        <TokenManager initialTokens={tokens ?? []} />
      </div>
    </div>
  )
}
