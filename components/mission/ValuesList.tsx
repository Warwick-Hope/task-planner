'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Value } from '@/types'

export default function ValuesList({ initial }: { initial: Value[] }) {
  const router = useRouter()
  const [values, setValues]       = useState<Value[]>(initial)
  const [editing, setEditing]     = useState<string | null>(null)  // id being edited
  const [editName, setEditName]   = useState('')
  const [editDesc, setEditDesc]   = useState('')
  const [adding, setAdding]       = useState(false)
  const [newName, setNewName]     = useState('')
  const [newDesc, setNewDesc]     = useState('')
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)

  // ── Add ───────────────────────────────────────────────────────────────────

  async function handleAdd() {
    if (!newName.trim() || saving) return
    setSaving(true)

    const res = await fetch('/api/values', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim(), description: newDesc.trim() || undefined }),
    })
    setSaving(false)

    if (!res.ok) return
    const value = await res.json() as Value
    setValues(prev => [...prev, value])
    setNewName(''); setNewDesc(''); setAdding(false)
    router.refresh()
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function startEdit(v: Value) {
    setEditing(v.id); setEditName(v.name); setEditDesc(v.description ?? '')
  }

  async function handleSaveEdit(id: string) {
    if (!editName.trim()) return
    setSaving(true)

    const res = await fetch(`/api/values/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editName.trim(), description: editDesc.trim() || null }),
    })
    setSaving(false)
    if (!res.ok) return

    const updated = await res.json() as Value
    setValues(prev => prev.map(v => v.id === id ? updated : v))
    setEditing(null)
    router.refresh()
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    setDeleting(id)
    await fetch(`/api/values/${id}`, { method: 'DELETE' })
    setValues(prev => prev.filter(v => v.id !== id))
    setDeleting(null)
    router.refresh()
  }

  // ── Reorder ───────────────────────────────────────────────────────────────

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= values.length) return

    const updated = [...values]
    ;[updated[index], updated[target]] = [updated[target], updated[index]]

    // Assign sequential sort_orders
    const reordered = updated.map((v, i) => ({ ...v, sort_order: i }))
    setValues(reordered)

    // Persist both swapped items
    await Promise.all([
      fetch(`/api/values/${reordered[index].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: reordered[index].sort_order }),
      }),
      fetch(`/api/values/${reordered[target].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: reordered[target].sort_order }),
      }),
    ])
    router.refresh()
  }

  return (
    <div className="space-y-2">
      {values.length === 0 && !adding && (
        <p className="text-sm text-gray-400 italic py-2">No values added yet.</p>
      )}

      {values.map((value, i) => (
        <div
          key={value.id}
          className="group rounded-xl border border-gray-200 bg-white p-4"
        >
          {editing === value.id ? (
            /* Edit mode */
            <div className="space-y-2">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveEdit(value.id) }}
                placeholder="Value name"
                className="w-full rounded-md border border-blue-400 px-2 py-1.5 text-sm font-medium text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <textarea
                rows={2}
                value={editDesc}
                onChange={e => setEditDesc(e.target.value)}
                placeholder="Description (optional)"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleSaveEdit(value.id)}
                  disabled={!editName.trim() || saving}
                  className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? '…' : 'Save'}
                </button>
                <button
                  onClick={() => setEditing(null)}
                  className="rounded-md border border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            /* View mode */
            <div className="flex items-start gap-3">
              {/* Reorder buttons */}
              <div className="flex flex-col gap-0.5 shrink-0 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="inline-flex items-center justify-center min-h-[36px] min-w-[32px] sm:min-h-0 sm:min-w-0 text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === values.length - 1}
                  className="inline-flex items-center justify-center min-h-[36px] min-w-[32px] sm:min-h-0 sm:min-w-0 text-gray-300 hover:text-gray-600 disabled:opacity-20 text-xs leading-none"
                  title="Move down"
                >
                  ▼
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900">{value.name}</p>
                {value.description && (
                  <p className="mt-0.5 text-xs text-gray-500 leading-relaxed">{value.description}</p>
                )}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex items-center gap-2 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(value)}
                  className="inline-flex items-center justify-center min-h-[36px] min-w-[32px] sm:min-h-0 sm:min-w-0 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                >
                  Edit
                </button>
                {deleting === value.id ? (
                  <span className="text-xs text-gray-400">…</span>
                ) : (
                  <button
                    onClick={() => handleDelete(value.id)}
                    aria-label="Delete value"
                    className="inline-flex items-center justify-center min-h-[36px] min-w-[32px] sm:min-h-0 sm:min-w-0 text-xs text-gray-300 hover:text-red-500 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add form */}
      {adding ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
          <input
            autoFocus
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd() }}
            placeholder="Value name (e.g. Family, Integrity, Health)"
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <textarea
            rows={2}
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="What does this value mean to you? (optional)"
            className="w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              disabled={!newName.trim() || saving}
              className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? '…' : 'Add value'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewName(''); setNewDesc('') }}
              className="rounded-md border border-gray-200 bg-white px-3 py-1 text-xs text-gray-500 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full rounded-xl border border-dashed border-gray-200 py-2.5 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors"
        >
          + Add a value
        </button>
      )}
    </div>
  )
}
