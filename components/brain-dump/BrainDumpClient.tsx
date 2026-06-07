'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Category } from '@/types'
import type { ParsedTask } from '@/app/api/brain-dump/route'

const HORIZON_LABELS: Record<ParsedTask['horizon_precision'], string> = {
  unplanned: 'Unplanned',
  year: 'This year',
  quarter: 'This quarter',
  month: 'This month',
  week: 'This week',
  day: 'Today',
}

const HORIZON_OPTIONS = Object.entries(HORIZON_LABELS) as [ParsedTask['horizon_precision'], string][]

function horizonSummary(task: ParsedTask): string {
  if (task.horizon_day) {
    return new Date(task.horizon_day + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
    })
  }
  if (task.horizon_week) {
    const d = new Date(task.horizon_week + 'T12:00:00')
    return `w/c ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
  }
  if (task.horizon_month != null && task.horizon_year != null) {
    return new Date(task.horizon_year, task.horizon_month - 1, 1)
      .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  }
  if (task.horizon_quarter != null && task.horizon_year != null) {
    return `Q${task.horizon_quarter} ${task.horizon_year}`
  }
  if (task.horizon_year != null) return `${task.horizon_year}`
  return 'Unplanned'
}

interface TaskCardProps {
  task: ParsedTask
  index: number
  categories: Category[]
  onChange: (index: number, updated: ParsedTask) => void
  onDiscard: (index: number) => void
}

function TaskCard({ task, index, categories, onChange, onDiscard }: TaskCardProps) {
  const [editing, setEditing] = useState(false)

  const topLevel = categories.filter(c => c.parent_id === null)
  const children = categories.filter(c => c.parent_id !== null)
  const selectedCat = categories.find(c => c.id === task.category_id)
  const parentCat = selectedCat?.parent_id
    ? categories.find(c => c.id === selectedCat.parent_id)
    : null
  const dotColour = (parentCat ?? selectedCat)?.colour ?? '#6B7280'

  function setField<K extends keyof ParsedTask>(key: K, value: ParsedTask[K]) {
    onChange(index, { ...task, [key]: value })
  }

  function setHorizonPrecision(p: ParsedTask['horizon_precision']) {
    const today = new Date().toISOString().split('T')[0]
    const year = new Date().getFullYear()
    const month = new Date().getMonth() + 1
    const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4

    const updates: Partial<ParsedTask> = {
      horizon_precision: p,
      horizon_year: null,
      horizon_quarter: null,
      horizon_month: null,
      horizon_week: null,
      horizon_day: null,
    }
    if (p === 'year') updates.horizon_year = year
    if (p === 'quarter') { updates.horizon_year = year; updates.horizon_quarter = quarter }
    if (p === 'month') { updates.horizon_year = year; updates.horizon_quarter = quarter; updates.horizon_month = month }
    if (p === 'week') {
      // Monday of current week
      const d = new Date(today + 'T12:00:00')
      const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
      d.setDate(d.getDate() + diff)
      updates.horizon_week = d.toISOString().split('T')[0]
      updates.horizon_month = month
      updates.horizon_quarter = quarter
      updates.horizon_year = year
    }
    if (p === 'day') {
      updates.horizon_day = today
      updates.horizon_week = (() => {
        const d = new Date(today + 'T12:00:00')
        const diff = d.getDay() === 0 ? -6 : 1 - d.getDay()
        d.setDate(d.getDate() + diff)
        return d.toISOString().split('T')[0]
      })()
      updates.horizon_month = month
      updates.horizon_quarter = quarter
      updates.horizon_year = year
    }
    onChange(index, { ...task, ...updates })
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
      {/* Title row */}
      <div className="flex items-start gap-2">
        {editing ? (
          <input
            autoFocus
            className="flex-1 rounded-md border border-blue-400 px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
            value={task.title}
            onChange={e => setField('title', e.target.value)}
            onBlur={() => setEditing(false)}
            onKeyDown={e => { if (e.key === 'Enter') setEditing(false) }}
          />
        ) : (
          <button
            className="flex-1 text-left text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
            onClick={() => setEditing(true)}
            title="Click to edit title"
          >
            {task.title}
          </button>
        )}
        <button
          onClick={() => onDiscard(index)}
          className="shrink-0 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
          title="Discard this task"
        >
          ×
        </button>
      </div>

      {/* Notes */}
      <textarea
        rows={task.notes ? 2 : 1}
        value={task.notes ?? ''}
        onChange={e => setField('notes', e.target.value)}
        placeholder="Add notes…"
        className="w-full rounded-md border border-transparent bg-gray-50 px-2 py-1 text-xs text-gray-500 placeholder-gray-300 focus:border-gray-200 focus:outline-none focus:bg-white resize-none transition-colors"
      />

      {/* Footer: category + horizon */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* Category selector */}
        <div className="relative">
          <select
            className="appearance-none rounded-full border border-gray-200 bg-white pl-6 pr-6 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            value={task.category_id ?? ''}
            onChange={e => setField('category_id', e.target.value || null)}
          >
            <option value="">No category</option>
            {topLevel.map(parent => {
              const subs = children.filter(c => c.parent_id === parent.id)
              return subs.length > 0 ? (
                <optgroup key={parent.id} label={parent.name}>
                  {subs.map(sub => (
                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                  ))}
                </optgroup>
              ) : (
                <option key={parent.id} value={parent.id}>{parent.name}</option>
              )
            })}
          </select>
          {task.category_id && selectedCat && (
            <span
              className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: dotColour }}
            />
          )}
        </div>

        {/* Horizon selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-gray-400">When:</span>
          <select
            className="rounded-full border border-gray-200 bg-white px-2 py-1 text-xs text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            value={task.horizon_precision}
            onChange={e => setHorizonPrecision(e.target.value as ParsedTask['horizon_precision'])}
          >
            {HORIZON_OPTIONS.map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
          {task.horizon_precision !== 'unplanned' && (
            <span className="text-xs text-gray-400">({horizonSummary(task)})</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default function BrainDumpClient({ categories }: { categories: Category[] }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)
  const [tasks, setTasks] = useState<ParsedTask[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  async function handleParse() {
    if (!text.trim()) return
    setParsing(true)
    setParseError(null)
    setTasks(null)

    const res = await fetch('/api/brain-dump', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    const data = await res.json()
    setParsing(false)

    if (!res.ok) {
      setParseError(data.error ?? 'Something went wrong')
      return
    }
    setTasks(data.tasks)
  }

  function handleChange(index: number, updated: ParsedTask) {
    setTasks(prev => prev ? prev.map((t, i) => i === index ? updated : t) : prev)
  }

  function handleDiscard(index: number) {
    setTasks(prev => prev ? prev.filter((_, i) => i !== index) : prev)
  }

  async function handleConfirm() {
    if (!tasks || tasks.length === 0) return
    setSaving(true)
    setSaveError(null)

    const res = await fetch('/api/brain-dump/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks }),
    })
    const data = await res.json()
    setSaving(false)

    if (!res.ok) {
      setSaveError(data.error ?? 'Save failed')
      return
    }

    router.push('/tasks')
    router.refresh()
  }

  const remaining = tasks?.length ?? 0

  return (
    <div className="max-w-2xl space-y-6">
      {/* Input panel — always visible so user can re-dump */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What&apos;s on your mind?
          </label>
          <textarea
            rows={6}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Just write — don't worry about structure. 'I need to sort out the car insurance, book the dentist, finish the proposal for Wednesday, and at some point get around to clearing the garage…'"
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            disabled={parsing}
          />
        </div>
        {parseError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{parseError}</p>
        )}
        <div className="flex items-center gap-3">
          <button
            onClick={handleParse}
            disabled={!text.trim() || parsing}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {parsing ? 'Extracting tasks…' : tasks ? 'Re-extract' : 'Extract tasks'}
          </button>
          {parsing && (
            <span className="text-sm text-gray-400">Asking Claude to pull out the tasks…</span>
          )}
        </div>
      </div>

      {/* Review panel */}
      {tasks !== null && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">
              {remaining === 0 ? 'All tasks discarded' : `${remaining} task${remaining === 1 ? '' : 's'} extracted — review and confirm`}
            </h2>
            {remaining > 0 && (
              <p className="text-xs text-gray-400">Click a title to edit it</p>
            )}
          </div>

          {tasks.map((task, i) => (
            <TaskCard
              key={i}
              task={task}
              index={i}
              categories={categories}
              onChange={handleChange}
              onDiscard={handleDiscard}
            />
          ))}

          {saveError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</p>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleConfirm}
              disabled={remaining === 0 || saving}
              className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : `Save ${remaining} task${remaining === 1 ? '' : 's'}`}
            </button>
            <button
              onClick={() => { setTasks(null); setText('') }}
              className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
            >
              Start over
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
