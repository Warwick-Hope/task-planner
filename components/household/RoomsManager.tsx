'use client'

import { useState } from 'react'
import type { Room } from '@/types'

interface Props {
  workspaceId: string
  initialRooms: Room[]
  canManage: boolean
}

export default function RoomsManager({ workspaceId, initialRooms, canManage }: Props) {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openAdd() {
    setEditingId(null)
    setName('')
    setError(null)
    setShowForm(true)
  }

  function openEdit(room: Room) {
    setEditingId(room.id)
    setName(room.name)
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
      const res = await fetch(`/api/household/${workspaceId}/rooms/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      setRooms((prev) => prev.map((r) => (r.id === editingId ? json.room : r)))
    } else {
      const res = await fetch(`/api/household/${workspaceId}/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      setRooms((prev) => [...prev, json.room])
    }

    setShowForm(false)
    setEditingId(null)
  }

  async function handleDelete(room: Room) {
    if (!confirm(`Remove "${room.name}"? Cleaning tasks linked to this room will become unlinked.`)) return
    const res = await fetch(`/api/household/${workspaceId}/rooms/${room.id}`, { method: 'DELETE' })
    if (res.ok) setRooms((prev) => prev.filter((r) => r.id !== room.id))
  }

  return (
    <div className="space-y-4">
      {rooms.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white overflow-hidden">
          {rooms.map((room) => (
            <li key={room.id} className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-amber-100 flex items-center justify-center text-amber-600 text-base">
                  🏠
                </div>
                <span className="text-sm font-medium text-gray-900">{room.name}</span>
              </div>
              {canManage && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => openEdit(room)}
                    className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => handleDelete(room)}
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

      {rooms.length === 0 && !showForm && (
        <p className="text-sm text-gray-400">No rooms yet. Add rooms to create cleaning schedules.</p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4 space-y-4 max-w-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {editingId ? 'Rename room' : 'Room name'}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kitchen, Lounge, Master Bedroom"
              required
              autoFocus
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving…' : editingId ? 'Save' : 'Add room'}
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
          + Add room
        </button>
      )}
    </div>
  )
}
