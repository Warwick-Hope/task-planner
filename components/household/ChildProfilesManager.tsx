'use client'

import { useState } from 'react'

const AVATAR_COLOURS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
]

interface ChildProfile {
  id: string
  name: string
  avatar_colour: string
  created_at: string
}

interface Props {
  workspaceId: string
  initialProfiles: ChildProfile[]
  canManage: boolean
}

function Avatar({ name, colour, size = 8 }: { name: string; colour: string; size?: number }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0`}
      style={{ backgroundColor: colour }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

export default function ChildProfilesManager({ workspaceId, initialProfiles, canManage }: Props) {
  const [profiles, setProfiles] = useState<ChildProfile[]>(initialProfiles)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [colour, setColour] = useState(AVATAR_COLOURS[0])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setName('')
    setColour(AVATAR_COLOURS[0])
    setError(null)
    setShowForm(true)
  }

  function openEdit(profile: ChildProfile) {
    setEditingId(profile.id)
    setName(profile.name)
    setColour(profile.avatar_colour)
    setError(null)
    setShowForm(true)
  }

  function cancel() {
    setShowForm(false)
    setEditingId(null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    if (editingId) {
      const res = await fetch(`/api/household/${workspaceId}/profiles/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar_colour: colour }),
      })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      setProfiles((prev) => prev.map((p) => (p.id === editingId ? json.profile : p)))
    } else {
      const res = await fetch(`/api/household/${workspaceId}/profiles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, avatar_colour: colour }),
      })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      setProfiles((prev) => [...prev, json.profile])
    }

    setShowForm(false)
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this child profile? Tasks assigned to them will become unassigned.')) return
    const res = await fetch(`/api/household/${workspaceId}/profiles/${id}`, { method: 'DELETE' })
    if (res.ok) setProfiles((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div className="space-y-4">
      {profiles.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
          {profiles.map((p) => (
            <li key={p.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={p.name} colour={p.avatar_colour} />
                <div>
                  <p className="text-sm font-medium text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-400">Child profile</p>
                </div>
              </div>
              {canManage && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEdit(p)}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-xs text-red-400 hover:text-red-600 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {profiles.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">No child profiles yet.</p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Isla"
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Avatar colour</label>
            <div className="flex items-center gap-2 flex-wrap">
              {AVATAR_COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColour(c)}
                  className={`w-7 h-7 rounded-full transition-transform ${colour === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <div className="flex items-center gap-2 ml-2">
                <Avatar name={name || '?'} colour={colour} />
                <span className="text-xs text-gray-400">Preview</span>
              </div>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : editingId ? 'Save changes' : 'Add profile'}
            </button>
            <button
              type="button"
              onClick={cancel}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {canManage && !showForm && (
        <button
          onClick={openAdd}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          + Add child profile
        </button>
      )}
    </div>
  )
}
