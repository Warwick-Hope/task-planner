'use client'

import { useState } from 'react'
import type { ShoppingListItem } from '@/types'

interface Props {
  workspaceId: string
  initialItems: ShoppingListItem[]
  canManage: boolean
}

interface AddForm {
  name: string
  quantity: string
  unit: string
  shop_tag: string
}

const EMPTY_FORM: AddForm = { name: '', quantity: '', unit: '', shop_tag: '' }

function groupByShopTag(items: ShoppingListItem[]): Map<string, ShoppingListItem[]> {
  const map = new Map<string, ShoppingListItem[]>()
  for (const item of items) {
    const tag = item.shop_tag ?? ''
    if (!map.has(tag)) map.set(tag, [])
    map.get(tag)!.push(item)
  }
  // Sort: named shops first (alphabetical), then untagged
  return new Map(
    Array.from(map.entries()).sort(([a], [b]) => {
      if (!a && b) return 1
      if (a && !b) return -1
      return a.localeCompare(b)
    })
  )
}

export default function ShoppingList({ workspaceId, initialItems, canManage }: Props) {
  const [items, setItems] = useState<ShoppingListItem[]>(initialItems)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<AddForm>(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const unpurchased = items.filter((i) => !i.is_purchased)
  const purchased = items.filter((i) => i.is_purchased)

  async function togglePurchased(item: ShoppingListItem) {
    const next = !item.is_purchased
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_purchased: next } : i))
    const res = await fetch(`/api/household/${workspaceId}/shopping/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_purchased: next }),
    })
    if (!res.ok) setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, is_purchased: item.is_purchased } : i))
  }

  async function deleteItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    await fetch(`/api/household/${workspaceId}/shopping/${id}`, { method: 'DELETE' })
  }

  async function clearPurchased() {
    if (!confirm('Remove all purchased items?')) return
    setClearing(true)
    const res = await fetch(`/api/household/${workspaceId}/shopping?purchased=true`, { method: 'DELETE' })
    if (res.ok) setItems((prev) => prev.filter((i) => !i.is_purchased))
    setClearing(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return
    setError(null)
    setLoading(true)
    const res = await fetch(`/api/household/${workspaceId}/shopping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: form.name, quantity: form.quantity, unit: form.unit, shop_tag: form.shop_tag }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
    setItems((prev) => [...prev, json.item])
    setForm(EMPTY_FORM)
    setShowForm(false)
  }

  const grouped = groupByShopTag(unpurchased)

  return (
    <div className="space-y-6">
      {/* Unpurchased items grouped by shop */}
      {unpurchased.length === 0 && !showForm && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center">
          <p className="text-sm text-gray-400">Shopping list is empty.</p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([tag, tagItems]) => (
        <section key={tag || '__untagged__'} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          {tag && (
            <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{tag}</h2>
            </div>
          )}
          {tagItems.map((item) => (
            <div key={item.id} className="group flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
              <button
                onClick={() => togglePurchased(item)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  item.is_purchased ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                {item.is_purchased && <span className="text-xs">✓</span>}
              </button>
              <div className="flex-1 min-w-0">
                <span className={`text-sm ${item.is_purchased ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.name}
                </span>
                {(item.quantity || item.unit) && (
                  <span className="ml-2 text-xs text-gray-400">
                    {[item.quantity, item.unit].filter(Boolean).join(' ')}
                  </span>
                )}
              </div>
              {canManage && (
                <button
                  onClick={() => deleteItem(item.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-300 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </section>
      ))}

      {/* Add form */}
      {canManage && showForm && (
        <form onSubmit={handleAdd} className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Item</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Milk"
                required
                autoFocus
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-600 mb-1">Qty</label>
              <input
                type="text"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="2"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
              <input
                type="text"
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                placeholder="L, kg…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Shop (optional)</label>
            <input
              type="text"
              value={form.shop_tag}
              onChange={(e) => setForm((f) => ({ ...f, shop_tag: e.target.value }))}
              placeholder="e.g. Tesco, Asda, Boots"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Adding…' : 'Add item'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(EMPTY_FORM); setError(null) }}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {canManage && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
        >
          + Add item
        </button>
      )}

      {/* Purchased section */}
      {purchased.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white overflow-hidden opacity-70">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Purchased ({purchased.length})
            </h2>
            {canManage && (
              <button
                onClick={clearPurchased}
                disabled={clearing}
                className="text-xs text-red-400 hover:text-red-600 transition-colors"
              >
                {clearing ? 'Clearing…' : 'Clear all'}
              </button>
            )}
          </div>
          {purchased.map((item) => (
            <div key={item.id} className="group flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0">
              <button
                onClick={() => togglePurchased(item)}
                className="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 bg-green-500 border-green-500 text-white"
              >
                <span className="text-xs">✓</span>
              </button>
              <span className="flex-1 text-sm line-through text-gray-400">{item.name}</span>
              {canManage && (
                <button
                  onClick={() => deleteItem(item.id)}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-gray-300 hover:text-red-500"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  )
}
