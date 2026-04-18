'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { RoleCategory, TaskStatus } from '@/types'
import {
  type HorizonPrecision,
  HORIZON_PRECISION_LABELS,
  buildHorizonFields,
  monthToQuarter,
  quarterToHalf,
} from '@/lib/horizon'

const PRECISIONS: HorizonPrecision[] = [
  'unplanned',
  'year',
  'half',
  'quarter',
  'month',
  'week',
  'day',
  'time',
]

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'wip', label: 'In progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
]

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function nowLocalStr() {
  const d = new Date()
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d.toISOString().slice(0, 16)
}

function currentYear() {
  return new Date().getFullYear()
}

function currentMonth() {
  return new Date().getMonth() + 1
}

function currentQuarter(): 1 | 2 | 3 | 4 {
  return monthToQuarter(currentMonth())
}

function currentHalf(): 1 | 2 {
  return quarterToHalf(currentQuarter())
}

export default function TaskForm({ roles }: { roles: RoleCategory[] }) {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<TaskStatus>('not_started')
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())

  // Horizon state
  const [precision, setPrecision] = useState<HorizonPrecision>('unplanned')
  const [year, setYear] = useState(currentYear())
  const [half, setHalf] = useState<1 | 2>(currentHalf())
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(currentQuarter())
  const [month, setMonth] = useState(currentMonth())
  const [weekStr, setWeekStr] = useState(todayStr())
  const [dayStr, setDayStr] = useState(todayStr())
  const [timeStr, setTimeStr] = useState(nowLocalStr())

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggleRole(id: string) {
    setSelectedRoleIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Group children under their parent for display
  const roleGroups = (() => {
    const parents = roles
      .filter((r) => r.parent_id === null)
      .sort((a, b) => a.sort_order - b.sort_order)
    return parents.map((parent) => ({
      parent,
      children: roles
        .filter((r) => r.parent_id === parent.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setSaving(true)
    setError(null)

    const horizonFields = buildHorizonFields(precision, {
      year,
      half,
      quarter,
      month,
      weekStr,
      dayStr,
      timeStr,
    })

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes: notes || undefined,
        status,
        roleIds: Array.from(selectedRoleIds),
        ...horizonFields,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
      setSaving(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-xl">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          autoFocus
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs doing?"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Additional context…"
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Horizon */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">When?</p>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {PRECISIONS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrecision(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                precision === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {HORIZON_PRECISION_LABELS[p]}
            </button>
          ))}
        </div>

        {precision !== 'unplanned' && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            {/* Year — shown for all non-unplanned except week/day/time which derive it */}
            {['year', 'half', 'quarter', 'month'].includes(precision) && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-16 shrink-0">Year</label>
                <input
                  type="number"
                  min={2020}
                  max={2099}
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-24 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Half */}
            {precision === 'half' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-16 shrink-0">Half</label>
                <div className="flex gap-2">
                  {([1, 2] as const).map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setHalf(h)}
                      className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
                        half === h
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      H{h}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quarter */}
            {precision === 'quarter' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-16 shrink-0">Quarter</label>
                <div className="flex gap-2">
                  {([1, 2, 3, 4] as const).map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => setQuarter(q)}
                      className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                        quarter === q
                          ? 'bg-blue-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      Q{q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Month */}
            {precision === 'month' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-16 shrink-0">Month</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {MONTHS.map((name, i) => (
                    <option key={name} value={i + 1}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Week */}
            {precision === 'week' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-16 shrink-0">Week of</label>
                <input
                  type="date"
                  value={weekStr}
                  onChange={(e) => setWeekStr(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">rounded to Monday</span>
              </div>
            )}

            {/* Day */}
            {precision === 'day' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-16 shrink-0">Date</label>
                <input
                  type="date"
                  value={dayStr}
                  onChange={(e) => setDayStr(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Time */}
            {precision === 'time' && (
              <div className="flex items-center gap-3">
                <label className="text-sm text-gray-600 w-16 shrink-0">Date &amp; time</label>
                <input
                  type="datetime-local"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Roles — top-level are group headers only; children are selectable */}
      {roleGroups.length > 0 && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-3">Role</p>
          <div className="space-y-3">
            {roleGroups.map(({ parent, children }) => (
              <div key={parent.id}>
                {/* Non-selectable parent label */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: parent.colour ?? '#6B7280' }}
                  />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {parent.name}
                  </span>
                </div>

                {/* Selectable children */}
                {children.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pl-4">
                    {children.map((child) => {
                      const colour = parent.colour ?? '#6B7280'
                      const selected = selectedRoleIds.has(child.id)
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => toggleRole(child.id)}
                          className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            selected
                              ? 'border-transparent text-white'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                          style={selected ? { backgroundColor: colour } : {}}
                        >
                          {child.name}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="pl-4 text-xs text-gray-400 italic">
                    No subcategories — add them in Roles
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div>
        <p className="block text-sm font-medium text-gray-700 mb-2">Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setStatus(opt.value)}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                status === opt.value
                  ? 'border-gray-800 bg-gray-800 text-white'
                  : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
      )}

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={!title.trim() || saving}
          className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : 'Create task'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
