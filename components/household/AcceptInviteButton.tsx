'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  token: string
}

export default function AcceptInviteButton({ token }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAccept() {
    setError(null)
    setLoading(true)

    const res = await fetch(`/api/invite/${token}/accept`, { method: 'POST' })
    const json = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(json.error ?? 'Something went wrong')
      return
    }

    router.push(`/household/${json.workspaceId}`)
  }

  return (
    <div className="space-y-3">
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        onClick={handleAccept}
        disabled={loading}
        className="rounded-md bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Joining…' : 'Accept invitation'}
      </button>
    </div>
  )
}
