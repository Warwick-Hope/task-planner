'use client'

import { useState } from 'react'
import type { ApiToken, ApiTokenScope } from '@/types'

// What the API returns: everything except the hash, which never leaves the server.
type TokenRow = Omit<ApiToken, 'user_id' | 'token_hash'>

interface Props {
  initialTokens: TokenRow[]
}

const EXPIRY_CHOICES: { label: string; days: number | null }[] = [
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
  { label: '1 year', days: 365 },
  { label: 'No expiry', days: null },
]

const CURL_EXAMPLE = [
  'curl -H "Authorization: Bearer clr_your_token" \\',
  '  https://your-clarity-url/api/tasks/<task-id>',
].join('\n')

const SCOPE_CHOICES: { scope: ApiTokenScope; label: string; hint: string }[] = [
  { scope: 'tasks:read', label: 'Read tasks', hint: 'List your tasks and categories' },
  { scope: 'tasks:write', label: 'Create and change tasks', hint: 'Includes reading them' },
]

export default function TokenManager({ initialTokens }: Props) {
  const [tokens, setTokens] = useState<TokenRow[]>(initialTokens)
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<ApiTokenScope[]>(['tasks:read', 'tasks:write'])
  const [expiryDays, setExpiryDays] = useState<number | null>(90)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Held in component state only, and only until the page is left: this is the
  // one moment the plaintext exists outside the caller's own storage.
  const [freshToken, setFreshToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function toggleScope(scope: ApiTokenScope) {
    setScopes((prev) => {
      const next = prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
      // Write implies read — the API applies the same rule, so mirror it here
      // rather than letting the form offer a combination it will not honour.
      if (next.includes('tasks:write') && !next.includes('tasks:read')) next.push('tasks:read')
      return next
    })
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setFreshToken(null)
    setCreating(true)

    const res = await fetch('/api/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, scopes, expiresInDays: expiryDays }),
    })

    const json = await res.json().catch(() => ({}))
    setCreating(false)

    if (!res.ok) {
      setError(json.error ?? 'Could not create that token')
      return
    }

    setFreshToken(json.token)
    setTokens((prev) => [json.apiToken, ...prev])
    setName('')
  }

  async function handleRevoke(token: TokenRow) {
    if (!confirm(`Revoke "${token.name}"? Anything using it stops working immediately.`)) return

    setError(null)
    setRevoking(token.id)

    const res = await fetch(`/api/tokens/${token.id}`, { method: 'DELETE' })
    setRevoking(null)

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Could not revoke that token')
      return
    }

    const revokedAt = new Date().toISOString()
    setTokens((prev) => prev.map((t) => (t.id === token.id ? { ...t, revoked_at: revokedAt } : t)))
  }

  async function copyToken() {
    if (!freshToken) return
    await navigator.clipboard.writeText(freshToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const live = tokens.filter((t) => !t.revoked_at)
  const dead = tokens.filter((t) => t.revoked_at)

  return (
    <div className="space-y-8">
      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label htmlFor="token-name" className="block text-sm font-medium text-gray-700 mb-1">
            What is it for?
          </label>
          <input
            id="token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Claude desktop"
            maxLength={60}
            required
            className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-gray-700 mb-1">What it may do</legend>
          <div className="space-y-2">
            {SCOPE_CHOICES.map(({ scope, label, hint }) => (
              <label key={scope} className="flex items-start gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={scopes.includes(scope)}
                  onChange={() => toggleScope(scope)}
                  className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>
                  {label}
                  <span className="block text-xs text-gray-400">{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <div>
          <label htmlFor="token-expiry" className="block text-sm font-medium text-gray-700 mb-1">
            Expires
          </label>
          <select
            id="token-expiry"
            value={String(expiryDays)}
            onChange={(e) => setExpiryDays(e.target.value === 'null' ? null : Number(e.target.value))}
            className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {EXPIRY_CHOICES.map(({ label, days }) => (
              <option key={label} value={String(days)}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={creating || !name.trim() || scopes.length === 0}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {creating ? 'Creating…' : 'Create token'}
        </button>
      </form>

      {freshToken && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-900 mb-1">
            Copy it now — it is not shown again
          </p>
          <p className="text-xs text-amber-800 mb-3">
            Only a hash is stored, so nobody, including this app, can show you this token a second
            time. Lose it and you create another.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={freshToken}
              onFocus={(e) => e.currentTarget.select()}
              className="min-w-0 flex-1 rounded border border-amber-300 bg-white px-2 py-1.5 text-xs font-mono text-gray-700"
            />
            <button
              onClick={copyToken}
              className="shrink-0 rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      <TokenList
        title="Active"
        tokens={live}
        empty="No tokens yet."
        revoking={revoking}
        onRevoke={handleRevoke}
      />
      <TokenList title="Revoked" tokens={dead} revoking={revoking} />

      <section className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Using a token</h2>
        <p className="text-xs text-gray-500 mb-2">
          Send it as a bearer token. A session cookie still works exactly as before, so the app
          itself is unaffected.
        </p>
        <pre className="overflow-x-auto rounded bg-gray-900 p-3 text-xs text-gray-100">{CURL_EXAMPLE}</pre>
      </section>
    </div>
  )
}

function TokenList({
  title,
  tokens,
  empty,
  revoking,
  onRevoke,
}: {
  title: string
  tokens: TokenRow[]
  empty?: string
  revoking: string | null
  onRevoke?: (token: TokenRow) => void
}) {
  if (tokens.length === 0) {
    return empty ? (
      <section>
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{title}</h2>
        <p className="text-sm text-gray-400">{empty}</p>
      </section>
    ) : null
  }

  return (
    <section>
      <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">{title}</h2>
      <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
        {tokens.map((token) => (
          <li key={token.id} className="flex items-center justify-between gap-3 px-4 py-3">
            {/* min-w-0 with truncate, or a long name runs under the controls on a
                phone rather than being cut off (KB.md #43). */}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-gray-900">{token.name}</p>
              <p className="truncate text-xs text-gray-400">
                <span className="font-mono">{token.token_prefix}…</span>
                {' · '}
                {token.scopes.join(', ')}
                {' · '}
                {describeUse(token)}
              </p>
            </div>
            {onRevoke && (
              <button
                onClick={() => onRevoke(token)}
                disabled={revoking === token.id}
                className="shrink-0 rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
              >
                {revoking === token.id ? 'Revoking…' : 'Revoke'}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Last use, expiry or revocation — whichever is the thing worth knowing. */
function describeUse(token: TokenRow): string {
  const date = (value: string) => new Date(value).toLocaleDateString()

  if (token.revoked_at) return `revoked ${date(token.revoked_at)}`
  if (!token.last_used_at) return 'never used'

  const expiry =
    token.expires_at && new Date(token.expires_at) < new Date()
      ? ', expired'
      : token.expires_at
        ? `, expires ${date(token.expires_at)}`
        : ''

  return `last used ${date(token.last_used_at)}${expiry}`
}
