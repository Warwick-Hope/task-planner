'use client'

import { useState } from 'react'

interface Invitation {
  id: string
  email: string
  role: string
  expires_at: string
  accepted_at: string | null
  created_at: string
}

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
    setEmail('')
    setInvitations((prev) => [
      {
        id: crypto.randomUUID(),
        email: email.toLowerCase(),
        role,
        expires_at: json.expiresAt,
        accepted_at: null,
        created_at: new Date().toISOString(),
      },
      ...prev,
    ])
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
              <li key={inv.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                  <p className="text-xs text-gray-400">
                    Expires {new Date(inv.expires_at).toLocaleDateString()}
                  </p>
                </div>
                <span className="text-xs text-gray-400 capitalize">{inv.role}</span>
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
              <li key={inv.id} className="flex items-center justify-between px-4 py-3">
                <p className="text-sm text-gray-900">{inv.email}</p>
                <span className="text-xs text-green-600">Joined</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
