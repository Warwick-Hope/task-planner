'use client'

import { useState } from 'react'
import type { Mission } from '@/types'

export default function MissionEditor({ initial }: { initial: Mission | null }) {
  const [content, setContent] = useState(initial?.content ?? '')
  const [saved, setSaved]     = useState(initial?.content ?? '')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<Date | null>(
    initial ? new Date(initial.created_at) : null,
  )

  const dirty = content !== saved

  async function handleSave() {
    if (!content.trim() || saving) return
    setSaving(true)
    setError(null)

    const res = await fetch('/api/mission', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    })
    setSaving(false)

    if (!res.ok) {
      const d = await res.json()
      setError(d.error ?? 'Save failed')
      return
    }

    setSaved(content)
    setSavedAt(new Date())
  }

  return (
    <div className="space-y-3">
      <textarea
        rows={5}
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="Write your personal mission statement… What do you want to achieve? Who do you want to be?"
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
      />

      {error && (
        <p className="text-xs text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!dirty || !content.trim() || saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Save mission'}
        </button>

        {!dirty && savedAt && (
          <span className="text-xs text-gray-400">
            Saved {savedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
        {dirty && (
          <span className="text-xs text-amber-500">Unsaved changes</span>
        )}
      </div>
    </div>
  )
}
