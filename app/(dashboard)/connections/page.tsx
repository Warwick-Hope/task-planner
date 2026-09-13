import { createClient } from '@/lib/supabase-server'
import TokenManager from '@/components/settings/TokenManager'
import ConnectedApps, { type GrantRow } from '@/components/settings/ConnectedApps'

export const metadata = { title: 'Connections — Clarity' }

export default async function ConnectionsPage() {
  const supabase = createClient()

  // Owner-only under RLS, so no filter is needed here — but the token hash is
  // deliberately not selected: nothing outside the resolver ever needs it.
  const { data: tokens } = await supabase
    .from('api_tokens')
    .select('id, name, token_prefix, scopes, expires_at, revoked_at, last_used_at, created_at')
    .order('created_at', { ascending: false })

  // Apps approved through OAuth (Phase 4.11). Owner-only under RLS as well, and
  // the two token hashes are left unselected for the same reason.
  const { data: grants } = await supabase
    .from('oauth_grants')
    .select('id, scopes, revoked_at, last_used_at, created_at, oauth_clients(name)')
    .order('created_at', { ascending: false })

  // PostgREST returns an embedded relation as an array — it cannot know from the
  // query that a grant has exactly one client — so it is flattened here rather
  // than every component that touches one having to know that.
  const connectedApps: GrantRow[] = (grants ?? []).map(grant => {
    const { oauth_clients, ...rest } = grant as typeof grant & {
      oauth_clients: { name: string }[] | { name: string } | null
    }
    return {
      ...rest,
      oauth_clients: Array.isArray(oauth_clients) ? (oauth_clients[0] ?? null) : oauth_clients,
    } as GrantRow
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Connections</h1>
        <p className="mt-1 text-sm text-gray-500">
          Two ways in, both acting as you. An <strong>app</strong> connects itself by asking your
          permission — that is how Claude on the web and on your phone does it. A{' '}
          <strong>token</strong> is one you paste into something yourself, which is what Claude
          Code and Claude Desktop take. Revoke anything you no longer recognise.
        </p>
      </div>
      <div className="max-w-2xl space-y-8">
        <ConnectedApps initialGrants={connectedApps} />
        <TokenManager initialTokens={tokens ?? []} />
      </div>
    </div>
  )
}
