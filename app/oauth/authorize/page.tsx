import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { ALL_SCOPES } from '@/lib/api-tokens'
import { SCOPE_LABELS } from '@/lib/oauth'
import type { ApiTokenScope } from '@/types'
import ConsentForm from '@/components/oauth/ConsentForm'

/**
 * The consent screen (Phase 4.11) — the only place a person is involved in the
 * OAuth flow, and the only thing standing between a registered client and
 * somebody's tasks.
 *
 * Registration is open, so a client row proves nothing about who made it. What
 * this screen is for is the sentence "this is what it will be able to do", shown
 * to the person whose data it is, before anything is issued.
 *
 * It lives outside `/api` because the middleware has to be able to send a
 * signed-out visitor to `/login` and back here afterwards — with the query
 * string intact, which is a thing the redirect did not used to preserve.
 */

interface SearchParams {
  client_id?: string
  redirect_uri?: string
  response_type?: string
  scope?: string
  state?: string
  code_challenge?: string
  code_challenge_method?: string
  resource?: string
}

/** An error the client can act on, sent back to it rather than shown here. */
function bounce(redirectUri: string, state: string | undefined, error: string, description: string) {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', description)
  if (state) url.searchParams.set('state', state)
  redirect(url.toString())
}

function Refusal({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        {children}
      </div>
    </div>
  )
}

export default async function AuthorizePage({ searchParams }: { searchParams: SearchParams }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // The middleware sends a signed-out visitor to /login and back. Reaching here
  // without a user would mean that failed, and issuing a code then is the one
  // thing this page must never do.
  if (!user) redirect('/login')

  const { client_id, redirect_uri, response_type, scope, state, code_challenge } = searchParams
  const method = searchParams.code_challenge_method

  if (!client_id || !redirect_uri) {
    return (
      <Refusal>
        This link is missing its <code>client_id</code> or <code>redirect_uri</code>, so there is
        nothing to approve. Start the connection again from the app that sent you here.
      </Refusal>
    )
  }

  const { data } = await supabase.rpc('oauth_client_public', { p_client_id: client_id })
  const client = (data as { id: string; name: string; redirect_uris: string[] }[] | null)?.[0]

  // An unregistered redirect_uri cannot be bounced to — that would be handing the
  // error, and anything in it, to whoever supplied the address.
  if (!client) {
    return <Refusal>That application is not registered with Clarity.</Refusal>
  }
  if (!client.redirect_uris.includes(redirect_uri)) {
    return (
      <Refusal>
        <strong>{client.name}</strong> asked to be sent back to an address it has not registered.
        Nothing has been approved.
      </Refusal>
    )
  }

  if (response_type !== 'code') {
    bounce(redirect_uri, state, 'unsupported_response_type', 'Only response_type=code is supported')
  }
  if (!code_challenge || method !== 'S256') {
    bounce(redirect_uri, state, 'invalid_request', 'PKCE with code_challenge_method=S256 is required')
  }

  const asked = (scope ?? '').split(/[\s,]+/).filter(Boolean)
  const scopes = (
    asked.length > 0 ? ALL_SCOPES.filter(s => asked.includes(s)) : ['tasks:read']
  ) as ApiTokenScope[]

  if (scopes.length === 0) {
    bounce(redirect_uri, state, 'invalid_scope', `Known scopes: ${ALL_SCOPES.join(', ')}`)
  }
  if (scopes.includes('tasks:write') && !scopes.includes('tasks:read')) {
    scopes.unshift('tasks:read')
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <div className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-5">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">
            Connect {client.name} to Clarity?
          </h1>
          <p className="text-sm text-gray-600">
            Signed in as {user.email}. {client.name} is asking for access to your Clarity account.
          </p>
        </div>

        <div className="rounded-xl bg-gray-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-2">
            It will be able to
          </p>
          <ul className="space-y-2">
            {scopes.map(s => (
              <li key={s} className="flex gap-2 text-sm text-gray-800">
                <span aria-hidden className="text-gray-400">
                  •
                </span>
                {SCOPE_LABELS[s]}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-gray-500">
          It acts as you, so it sees exactly what you see — your personal workspace and every
          household you belong to, and nothing else. You can disconnect it at any time from
          Connections.
        </p>

        <ConsentForm
          clientId={client_id}
          clientName={client.name}
          redirectUri={redirect_uri}
          scopes={scopes}
          state={state}
          codeChallenge={code_challenge!}
          resource={searchParams.resource}
        />
      </div>
    </div>
  )
}
