'use client'

import { useState } from 'react'
import type { HouseholdInvitation } from '@/types'

// The columns the invite page and the API both select — the token is never sent
// to the client except in the freshly generated link.
type Invitation = Pick<
  HouseholdInvitation,
  'id' | 'email' | 'role' | 'expires_at' | 'accepted_at' | 'created_at'
>

interface Props {
  workspaceId: string
  initialInvitations: Invitation[]
}

export default function InviteForm({ workspaceId, initialInvitations }: Props) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'adult' | 'restricted'>('adult')
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [invitations, setInvitations] = useState<Invitation[]>(initialInvitations)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [lastInvited, setLastInvited] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInviteUrl(null)
    setLoading(true)

    const res = await fetch(`/api/household/${workspaceId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role }),
    })

    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong')
      return
    }

    setInviteUrl(json.inviteUrl)
    setLastInvited(json.invitation.id)
    setEmail('')
    // The row the API returns, not a locally built one: its id is what Revoke
    // sends back, so an invented one would 404 on the invitation just created.
    setInvitations((prev) => [json.invitation, ...prev])
  }

  async function handleRevoke(invitation: Invitation) {
    if (!confirm(`Revoke the invitation for ${invitation.email}? The link stops working.`)) return

    setError(null)
    setRevoking(invitation.id)

    const res = await fetch(`/api/household/${workspaceId}/invite/${invitation.id}`, {
      method: 'DELETE',
    })

    setRevoking(null)

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setError(json.error ?? 'Could not revoke that invitation')
      return
    }

    setInvitations((prev) => prev.filter((i) => i.id !== invitation.id))
    // The link still on screen may be the one just revoked.
    if (lastInvited === invitation.id) setInviteUrl(null)
  }

  async function copyLink() {
    if (!inviteUrl) return
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pending = invitations.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date())
  const accepted = invitations.filter((i) => i.accepted_at)

  return (
    <div className="space-y-8">
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
            Email address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
            Role
          </label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'adult' | 'restricted')}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="adult">Adult — full access to shared household content</option>
            <option value="restricted">Restricted — limited visibility (older children)</option>
          </select>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading || !email.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Generating…' : 'Generate invite link'}
        </button>
      </form>

      {inviteUrl && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 max-w-md">
          <p className="text-sm font-medium text-blue-900 mb-2">Invite link ready</p>
          <p className="text-xs text-blue-700 mb-3">
            Share this link with the person you&apos;re inviting. It expires in 7 days.
            Email delivery will be added in a future update.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="flex-1 rounded border border-blue-300 bg-white px-2 py-1.5 text-xs font-mono text-gray-700"
            />
            <button
              onClick={copyLink}
              className="rounded bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}

      {pending.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Pending invitations
          </h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
            {pending.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                {/* min-w-0 and truncate together: without them a long email
                    keeps its intrinsic width and runs under the controls on a
                    phone, rather than being cut off. */}
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-gray-400 capitalize">{inv.role}</span>
                  {/* Always visible, never on hover: a hover-only control does
                      not render at all on a touch screen (KB.md #26). */}
                  <button
                    onClick={() => handleRevoke(inv)}
                    disabled={revoking === inv.id}
                    className="rounded px-2 py-1.5 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50 transition-colors"
                  >
                    {revoking === inv.id ? 'Revoking…' : 'Revoke'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {accepted.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
            Accepted
          </h2>
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
            {accepted.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <p className="truncate text-sm text-gray-900">{inv.email}</p>
                <span className="shrink-0 text-xs text-green-600">Joined</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
