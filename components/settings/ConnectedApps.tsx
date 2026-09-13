'use client'

import { useState } from 'react'
import type { ApiTokenScope } from '@/types'

/**
 * The apps you have approved, and the button that disconnects one (Phase 4.11).
 *
 * A grant is revoked rather than deleted, like a personal access token: the row
 * is the record that it existed, and `last_used_at` on a revoked grant is the
 * only way to answer "was this being used when I killed it?" — the first
 * question anyone asks after revoking something in a hurry.
 */

export interface GrantRow {
  id: string
  scopes: ApiTokenScope[]
  revoked_at: string | null
  last_used_at: string | null
  created_at: string
  /** Supabase returns an embedded row; a client deleted since would be null. */
  oauth_clients: { name: string } | null
}

const SCOPE_SHORT: Record<ApiTokenScope, string> = {
  'tasks:read': 'read',
  'tasks:write': 'write',
}

function when(value: string | null): string {
  if (!value) return 'never'
  return new Date(value).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export default function ConnectedApps({ initialGrants }: { initialGrants: GrantRow[] }) {
  const [grants, setGrants] = useState(initialGrants)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function revoke(id: string) {
    setBusy(id)
    setError(null)

    const res = await fetch(`/api/oauth/grants/${id}`, { method: 'DELETE' })
    setBusy(null)
    setConfirming(null)

    if (!res.ok) {
      setError('Could not disconnect that app')
      return
    }

    setGrants(prev =>
      prev.map(g => (g.id === id ? { ...g, revoked_at: new Date().toISOString() } : g))
    )
  }

  const live = grants.filter(g => !g.revoked_at)

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-gray-900">Connected apps</h2>
      <p className="mt-1 text-sm text-gray-500">
        Approved by you, in a browser. Disconnecting one stops it immediately — it does not wait
        for anything to expire.
      </p>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      {live.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">
          Nothing connected. On claude.ai, add a custom connector pointing at this app and it will
          ask for your permission here.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {live.map(grant => (
            <li
              key={grant.id}
              className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {grant.oauth_clients?.name ?? 'Unknown app'}
                </p>
                <p className="mt-0.5 text-xs text-gray-500">
                  {grant.scopes.map(s => SCOPE_SHORT[s] ?? s).join(' + ')} · connected{' '}
                  {when(grant.created_at)} · last used {when(grant.last_used_at)}
                </p>
              </div>

              {confirming === grant.id ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => setConfirming(null)}
                    className="min-h-11 rounded-lg border border-gray-300 px-3 text-sm text-gray-700"
                  >
                    Keep
                  </button>
                  <button
                    onClick={() => revoke(grant.id)}
                    disabled={busy === grant.id}
                    className="min-h-11 rounded-lg bg-red-600 px-3 text-sm font-medium text-white disabled:opacity-50"
                  >
                    {busy === grant.id ? 'Disconnecting…' : 'Disconnect'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirming(grant.id)}
                  aria-label={`Disconnect ${grant.oauth_clients?.name ?? 'this app'}`}
                  className="min-h-11 shrink-0 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Disconnect
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
