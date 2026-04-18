'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import type { RoleCategory } from '@/types'

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'not_started', label: 'Not started' },
  { value: 'wip', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

export default function TaskFilters({ allRoles }: { allRoles: RoleCategory[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const currentStatus = params.get('status') ?? 'all'
  const currentRole = params.get('role') ?? 'all'
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

  // Only show subcategories (children) as role filter options — same logic as task form
  const childRoles = allRoles.filter((r) => r.parent_id !== null)

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

      {/* Role */}
      {childRoles.length > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 mr-1">Role</span>
          <button
            onClick={() => set('role', 'all')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              currentRole === 'all'
                ? 'bg-gray-800 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {childRoles.map((role) => {
            const parent = allRoles.find((r) => r.id === role.parent_id)
            const colour = parent?.colour ?? '#6B7280'
            const selected = currentRole === role.id
            return (
              <button
                key={role.id}
                onClick={() => set('role', role.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  selected ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                style={selected ? { backgroundColor: colour } : {}}
              >
                {role.name}
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
