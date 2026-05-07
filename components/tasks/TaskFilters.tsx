'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Category } from '@/types'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: 'Not started' },
  { value: 'wip', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function TaskFilters({ allCategories }: { allCategories: Category[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const currentStatus = params.get('status') ?? 'all'
  const currentView = params.get('view') ?? 'all'
  const selectedIds: string[] = (params.get('category') ?? '').split(',').filter(Boolean)

  const [expandedParent, setExpandedParent] = useState<string | null>(null)

  const parents = allCategories
    .filter(c => c.parent_id === null)
    .sort((a, b) => a.sort_order - b.sort_order)

  function pushParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === '' || v === 'all') next.delete(k)
      else next.set(k, v)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  function setIds(ids: string[]) {
    pushParams({ category: ids.length ? ids.join(',') : null })
  }

  function toggleChildId(childId: string) {
    const next = new Set(selectedIds)
    if (next.has(childId)) next.delete(childId)
    else next.add(childId)
    setIds([...next])
  }

  function handleParentClick(parent: Category) {
    const children = allCategories.filter(c => c.parent_id === parent.id)
    if (children.length === 0) {
      // Leaf parent — toggle directly
      toggleChildId(parent.id)
      return
    }
    // Toggle expand
    setExpandedParent(prev => prev === parent.id ? null : parent.id)
  }

  function isParentActive(parent: Category): boolean {
    const children = allCategories.filter(c => c.parent_id === parent.id)
    if (children.length === 0) return selectedIds.includes(parent.id)
    return children.some(c => selectedIds.includes(c.id))
  }

  const expandedChildren = expandedParent
    ? allCategories.filter(c => c.parent_id === expandedParent).sort((a, b) => a.sort_order - b.sort_order)
    : []
  const expandedParentObj = parents.find(p => p.id === expandedParent)

  return (
    <div className="flex flex-col gap-2 mb-6">
      {/* Primary filter row */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">Status</span>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => pushParams({ status: opt.value })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                currentStatus === opt.value
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Category — parent tier */}
        {parents.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-gray-400 mr-1">Category</span>
            <button
              onClick={() => { setIds([]); setExpandedParent(null) }}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedIds.length === 0 && !expandedParent
                  ? 'bg-gray-800 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            {parents.map(parent => {
              const hasChildren = allCategories.some(c => c.parent_id === parent.id)
              const active = isParentActive(parent)
              const expanded = expandedParent === parent.id
              const highlight = active || expanded
              return (
                <button
                  key={parent.id}
                  onClick={() => handleParentClick(parent)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors flex items-center gap-1 ${
                    highlight ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                  style={highlight ? { backgroundColor: parent.colour ?? '#6B7280' } : {}}
                >
                  {parent.name}
                  {hasChildren && (
                    <span className={`text-[10px] ${highlight ? 'text-white/70' : 'text-gray-400'}`}>
                      {expanded ? '▲' : '▼'}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* Unplanned toggle */}
        <button
          onClick={() => pushParams({ view: currentView === 'unplanned' ? 'all' : 'unplanned' })}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            currentView === 'unplanned'
              ? 'bg-amber-500 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Unplanned
        </button>
      </div>

      {/* Subcategory row — shown when a parent with children is expanded */}
      {expandedParent && expandedParentObj && expandedChildren.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
          <span className="text-xs text-gray-400 mr-1">{expandedParentObj.name}:</span>
          {expandedChildren.map(child => {
            const selected = selectedIds.includes(child.id)
            return (
              <button
                key={child.id}
                onClick={() => toggleChildId(child.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  selected
                    ? 'border-transparent text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
                style={selected ? { backgroundColor: expandedParentObj.colour ?? '#6B7280' } : {}}
              >
                {child.name}
              </button>
            )
          })}
          {selectedIds.some(id => expandedChildren.some(c => c.id === id)) && (
            <button
              onClick={() => {
                const childIds = new Set(expandedChildren.map(c => c.id))
                setIds(selectedIds.filter(id => !childIds.has(id)))
              }}
              className="text-xs text-gray-400 hover:text-gray-600 ml-1"
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  )
}
