'use client'

import { useState } from 'react'
import type { ApiTokenScope } from '@/types'

/**
 * Allow and Cancel, and the redirect that follows either (Phase 4.11).
 *
 * The code comes back from `/api/oauth/authorize` as JSON and the browser is sent
 * on from here, rather than the route answering with a 302: a `fetch` that
 * followed a redirect to the client's own origin would land the code in a
 * response this page cannot read, and the user would sit on a spinner while the
 * connection quietly failed.
 */
export default function ConsentForm({
  clientId,
  clientName,
  redirectUri,
  scopes,
  state,
  codeChallenge,
  resource,
}: {
  clientId: string
  clientName: string
  redirectUri: string
  scopes: ApiTokenScope[]
  state?: string
  codeChallenge: string
  resource?: string
}) {
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function leaveFor(params: Record<string, string | undefined>) {
    const url = new URL(redirectUri)
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value)
    }
    window.location.href = url.toString()
  }

  async function allow() {
    setWorking(true)
    setError(null)

    const res = await fetch('/api/oauth/authorize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        redirect_uri: redirectUri,
        scopes,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        resource,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      setWorking(false)
      setError(data.error ?? 'Could not approve the connection')
      return
    }

    leaveFor({ code: data.code, state })
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => leaveFor({ error: 'access_denied', state })}
          disabled={working}
          className="min-h-11 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={allow}
          disabled={working}
          className="min-h-11 rounded-lg bg-gray-900 px-4 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          {working ? 'Connecting…' : `Allow ${clientName}`}
        </button>
      </div>
    </div>
  )
}
