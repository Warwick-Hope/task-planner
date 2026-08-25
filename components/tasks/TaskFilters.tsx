'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useState } from 'react'
import type { Category } from '@/types'

import { DEFAULT_CATEGORY_COLOUR } from '@/lib/category-colour'

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
  // Three rows of filter pills would push the list itself off a phone screen,
  // so on mobile they live behind a toggle that reports what is active.
  const [showFilters, setShowFilters] = useState(false)

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

  function toggleId(id: string) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setIds(Array.from(next))
  }

  /** Clicking the parent pill body toggles ALL its children (or itself if no children). */
  function handleParentToggle(parent: Category) {
    const children = allCategories.filter(c => c.parent_id === parent.id)
    if (children.length === 0) {
      toggleId(parent.id)
      return
    }
    const childIds = children.map(c => c.id)
    const allSelected = childIds.every(id => selectedIds.includes(id))
    if (allSelected) {
      // Deselect all children of this parent
      setIds(selectedIds.filter(id => !childIds.includes(id)))
    } else {
      // Select all children of this parent (merge with existing)
      const next = new Set([...selectedIds, ...childIds])
      setIds(Array.from(next))
    }
  }

  /** Clicking the ▼ arrow toggles the subcategory expand row independently. */
  function handleParentExpand(parentId: string, e: React.MouseEvent) {
    e.stopPropagation()
    setExpandedParent(prev => prev === parentId ? null : parentId)
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

  const activeCount =
    (currentStatus === 'all' ? 0 : 1) + (currentView === 'unplanned' ? 1 : 0) + selectedIds.length

  return (
    <div className="flex flex-col gap-2 mb-4 sm:mb-6">
      {/* Mobile-only disclosure */}
      <button
        onClick={() => setShowFilters(o => !o)}
        aria-expanded={showFilters}
        className="sm:hidden flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-600"
      >
        <span>
          Filters
          {activeCount > 0 && (
            <span className="ml-2 rounded-full bg-gray-800 px-2 py-0.5 text-xs font-medium text-white">
              {activeCount}
            </span>
          )}
        </span>
        <span className="text-xs text-gray-400">{showFilters ? 'Hide' : 'Show'}</span>
      </button>

      {/* Primary filter row */}
      <div
        className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2`}
      >
        {/* Status */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">Status</span>
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => pushParams({ status: opt.value })}
              className={`rounded-full px-3 py-1.5 sm:py-1 text-xs font-medium transition-colors ${
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
              className={`rounded-full px-3 py-1.5 sm:py-1 text-xs font-medium transition-colors ${
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
              const colour = parent.colour ?? DEFAULT_CATEGORY_COLOUR
              return (
                <div key={parent.id} className="flex items-stretch rounded-full overflow-hidden text-xs font-medium transition-colors">
                  {/* Name — click to toggle all children (multi-select) */}
                  <button
                    onClick={() => handleParentToggle(parent)}
                    className={`px-3 py-1.5 sm:py-1 transition-colors ${
                      active ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    style={active ? { backgroundColor: colour } : {}}
                  >
                    {parent.name}
                  </button>
                  {/* Arrow — click to expand/collapse subcategory row independently */}
                  {hasChildren && (
                    <button
                      onClick={(e) => handleParentExpand(parent.id, e)}
                      className={`px-2.5 sm:px-1.5 transition-colors border-l ${
                        active
                          ? 'text-white/80 border-white/20 hover:bg-black/10'
                          : expanded
                          ? 'bg-gray-200 text-gray-600 border-gray-300'
                          : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                      }`}
                      style={active ? { backgroundColor: colour } : {}}
                      title="Show subcategories"
                    >
                      {expanded ? '▲' : '▼'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Unplanned toggle */}
        <button
          onClick={() => pushParams({ view: currentView === 'unplanned' ? 'all' : 'unplanned' })}
          className={`rounded-full px-3 py-1.5 sm:py-1 text-xs font-medium transition-colors ${
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
        <div
          className={`${showFilters ? 'flex' : 'hidden'} sm:flex flex-wrap items-center gap-1.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100`}
        >
          <span className="text-xs text-gray-400 mr-1">{expandedParentObj.name}:</span>
          {expandedChildren.map(child => {
            const selected = selectedIds.includes(child.id)
            return (
              <button
                key={child.id}
                onClick={() => toggleId(child.id)}
                className={`rounded-full px-3 py-1.5 sm:py-1 text-xs font-medium border transition-colors ${
                  selected
                    ? 'border-transparent text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                }`}
                style={selected ? { backgroundColor: expandedParentObj.colour ?? DEFAULT_CATEGORY_COLOUR } : {}}
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
