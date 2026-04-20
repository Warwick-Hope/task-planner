'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
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
  const currentCategory = params.get('category') ?? 'all'
  const currentView = params.get('view') ?? 'all'

  function set(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value === 'all' || value === '') {
      next.delete(key)
    } else {
      next.set(key, value)
    }
    const qs = next.toString()
    router.push(qs ? `${pathname}?${qs}` : pathname)
  }

  // Only show subcategories (children) as filter options
  const childCategories = allCategories.filter((c) => c.parent_id !== null)

  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-6">
      {/* Status */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-gray-400 mr-1">Status</span>
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => set('status', opt.value)}
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

      {/* Category */}
      {childCategories.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">Category</span>
          <button
            onClick={() => set('category', 'all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              currentCategory === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {childCategories.map((cat) => {
            const parent = allCategories.find((c) => c.id === cat.parent_id)
            const colour = parent?.colour ?? '#6B7280'
            const selected = currentCategory === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => set('category', cat.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selected ? { backgroundColor: colour } : {}}
              >
                {cat.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Unplanned toggle */}
      <button
        onClick={() => set('view', currentView === 'unplanned' ? 'all' : 'unplanned')}
        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
          currentView === 'unplanned'
            ? 'bg-amber-500 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        Unplanned
      </button>
    </div>
  )
}
