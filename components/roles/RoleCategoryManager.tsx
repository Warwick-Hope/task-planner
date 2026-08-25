'use client'

import { useState } from 'react'
import { ROLE_COLOURS } from '@/lib/constants'
import type { Category } from '@/types'

import { categoryColour, DEFAULT_CATEGORY_COLOUR } from '@/lib/category-colour'

interface EditState {
  id: string
  name: string
  colour: string
}

interface AddState {
  name: string
  colour: string
  parentId: string | null
}

function ColourPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (c: string) => void
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {ROLE_COLOURS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`w-5 h-5 rounded-full transition-transform ${
            value === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400' : ''
          }`}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  )
}

export default function CategoryManager({
  initialCategories,
  apiBase = '/api/roles',
}: {
  initialCategories: Category[]
  apiBase?: string
}) {
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [editing, setEditing] = useState<EditState | null>(null)
  const [adding, setAdding] = useState<AddState | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const topLevel = categories
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)

  function childrenOf(parentId: string) {
    return categories
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order)
  }

  // ── Edit ──────────────────────────────────────────────────────────────────

  function startEdit(cat: Category) {
    setEditing({ id: cat.id, name: cat.name, colour: categoryColour(cat.id, categories) ?? DEFAULT_CATEGORY_COLOUR })
    setAdding(null)
    setError(null)
  }

  async function saveEdit() {
    if (!editing || !editing.name.trim()) return
    setSaving(true)
    setError(null)

    const cat = categories.find((c) => c.id === editing.id)
    const isTopLevel = cat?.parent_id === null

    const res = await fetch(`${apiBase}/${editing.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editing.name,
        colour: isTopLevel ? editing.colour : undefined,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
      setSaving(false)
      return
    }

    const updated: Category = await res.json()
    setCategories((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    setEditing(null)
    setSaving(false)
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async function confirmDelete(id: string) {
    setSaving(true)
    setError(null)

    const res = await fetch(`${apiBase}/${id}`, { method: 'DELETE' })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Delete failed')
      setSaving(false)
      setDeleteConfirm(null)
      return
    }

    setCategories((prev) => prev.filter((c) => c.id !== id))
    setDeleteConfirm(null)
    setSaving(false)
  }

  // ── Add ───────────────────────────────────────────────────────────────────

  function startAdd(parentId: string | null) {
    setAdding({ name: '', colour: ROLE_COLOURS[0], parentId })
    setEditing(null)
    setError(null)
  }

  async function saveAdd() {
    if (!adding || !adding.name.trim()) return
    setSaving(true)
    setError(null)

    const res = await fetch(apiBase, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: adding.name,
        colour: adding.parentId === null ? adding.colour : undefined,
        parent_id: adding.parentId,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Add failed')
      setSaving(false)
      return
    }

    const created: Category = await res.json()
    setCategories((prev) => [...prev, created])
    setAdding(null)
    setSaving(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function renderInlineForm(parentId: string | null) {
    if (!adding || adding.parentId !== parentId) return null
    const isTopLevel = parentId === null

    return (
      <div className="mt-3 rounded-lg border border-dashed border-blue-300 bg-blue-50 p-3 space-y-2">
        <input
          autoFocus
          type="text"
          value={adding.name}
          onChange={(e) => setAdding({ ...adding, name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveAdd()
            if (e.key === 'Escape') setAdding(null)
          }}
          placeholder={isTopLevel ? 'Category name' : 'Subcategory name'}
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {isTopLevel && (
          <ColourPicker
            value={adding.colour}
            onChange={(c) => setAdding({ ...adding, colour: c })}
          />
        )}
        <div className="flex gap-2">
          <button
            onClick={saveAdd}
            disabled={!adding.name.trim() || saving}
            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Add'}
          </button>
          <button
            onClick={() => setAdding(null)}
            className="rounded-md px-3 py-1 text-xs text-gray-500 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  function renderCategory(cat: Category, isChild = false) {
    const colour = categoryColour(cat.id, categories) ?? DEFAULT_CATEGORY_COLOUR
    const isEditing = editing?.id === cat.id
    const isDeletePending = deleteConfirm === cat.id

    if (isEditing) {
      return (
        <div
          key={cat.id}
          className="flex items-start gap-3 rounded-lg border border-blue-300 bg-blue-50 p-3"
        >
          <span
            className="mt-0.5 w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: colour }}
          />
          <div className="flex-1 space-y-2">
            <input
              autoFocus
              type="text"
              value={editing.name}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit()
                if (e.key === 'Escape') setEditing(null)
              }}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            {!isChild && (
              <ColourPicker
                value={editing.colour}
                onChange={(c) => setEditing({ ...editing, colour: c })}
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={saveEdit}
                disabled={!editing.name.trim() || saving}
                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="rounded-md px-3 py-1 text-xs text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )
    }

    if (isDeletePending) {
      return (
        <div
          key={cat.id}
          className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2"
        >
          <span className="text-sm text-red-700 flex-1">
            Delete &ldquo;{cat.name}&rdquo;?
          </span>
          <button
            onClick={() => confirmDelete(cat.id)}
            disabled={saving}
            className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? '…' : 'Delete'}
          </button>
          <button
            onClick={() => setDeleteConfirm(null)}
            className="rounded-md px-3 py-1 text-xs text-gray-500 hover:text-gray-800"
          >
            Cancel
          </button>
        </div>
      )
    }

    return (
      <div
        key={cat.id}
        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 group"
      >
        <span
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: colour }}
        />
        <span className="text-sm text-gray-900 flex-1">{cat.name}</span>
        <div className="flex gap-1 md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100 transition-opacity">
          <button
            onClick={() => startEdit(cat)}
            className="inline-flex items-center justify-center min-h-[36px] min-w-[32px] sm:min-h-0 sm:min-w-0 rounded px-2 py-0.5 text-xs text-gray-400 hover:text-gray-700 hover:bg-gray-100"
          >
            Edit
          </button>
          <button
            onClick={() => setDeleteConfirm(cat.id)}
            className="inline-flex items-center justify-center min-h-[36px] min-w-[32px] sm:min-h-0 sm:min-w-0 rounded px-2 py-0.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      {topLevel.length === 0 && !adding && (
        <p className="text-sm text-gray-400">No categories yet. Add one below.</p>
      )}

      {topLevel.map((parent) => {
        const children = childrenOf(parent.id)
        return (
          <div key={parent.id} className="space-y-1.5">
            {renderCategory(parent, false)}

            {/* Children */}
            {children.length > 0 && (
              <div className="ml-6 space-y-1.5">
                {children.map((child) => renderCategory(child, true))}
              </div>
            )}

            {/* Add subcategory inline form or button */}
            <div className="ml-6">
              {adding?.parentId === parent.id ? (
                renderInlineForm(parent.id)
              ) : (
                editing?.id !== parent.id && (
                  <button
                    onClick={() => startAdd(parent.id)}
                    className="text-xs text-gray-400 hover:text-blue-600 transition-colors py-1"
                  >
                    + Add subcategory
                  </button>
                )
              )}
            </div>
          </div>
        )
      })}

      {/* Add top-level inline form or button */}
      {adding?.parentId === null ? (
        renderInlineForm(null)
      ) : (
        <button
          onClick={() => startAdd(null)}
          className="rounded-lg border border-dashed border-gray-300 w-full py-2 text-sm text-gray-400 hover:text-blue-600 hover:border-blue-300 transition-colors"
        >
          + Add category
        </button>
      )}
    </div>
  )
}
