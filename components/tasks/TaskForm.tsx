'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Category, Task, TaskStatus } from '@/types'
import {
  type HorizonPrecision,
  HORIZON_PRECISION_LABELS,
  buildHorizonFields,
  monthToQuarter,
  quarterToHalf,
  getMondayOfWeek,
  monthFromDate,
  yearFromDate,
} from '@/lib/horizon'
import {
  type RecurrenceOptions,
  buildRrule,
  parseRrule,
} from '@/lib/recurrence'
import RecurrencePicker from './RecurrencePicker'

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

/** Derive the finest precision label and individual picker values from a saved task. */
function taskToHorizonState(task: Task) {
  if (task.horizon_time_slot) {
    const ts = new Date(task.horizon_time_slot)
    return {
      precision: 'time' as HorizonPrecision,
      year: task.horizon_year ?? currentYear(),
      half: (task.horizon_half as 1 | 2) ?? currentHalf(),
      quarter: (task.horizon_quarter as 1 | 2 | 3 | 4) ?? currentQuarter(),
      month: task.horizon_month ?? currentMonth(),
      weekStr: task.horizon_week ?? todayStr(),
      dayStr: task.horizon_day ?? todayStr(),
      timeStr: ts.toISOString().slice(0, 16),
    }
  }
  if (task.horizon_day) {
    return {
      precision: 'day' as HorizonPrecision,
      year: task.horizon_year ?? currentYear(),
      half: (task.horizon_half as 1 | 2) ?? currentHalf(),
      quarter: (task.horizon_quarter as 1 | 2 | 3 | 4) ?? currentQuarter(),
      month: task.horizon_month ?? currentMonth(),
      weekStr: task.horizon_week ?? getMondayOfWeek(task.horizon_day),
      dayStr: task.horizon_day,
      timeStr: nowLocalStr(),
    }
  }
  if (task.horizon_week) {
    return {
      precision: 'week' as HorizonPrecision,
      year: task.horizon_year ?? currentYear(),
      half: (task.horizon_half as 1 | 2) ?? currentHalf(),
      quarter: (task.horizon_quarter as 1 | 2 | 3 | 4) ?? currentQuarter(),
      month: task.horizon_month ?? currentMonth(),
      weekStr: task.horizon_week,
      dayStr: todayStr(),
      timeStr: nowLocalStr(),
    }
  }
  if (task.horizon_month != null) {
    return {
      precision: 'month' as HorizonPrecision,
      year: task.horizon_year ?? currentYear(),
      half: (task.horizon_half as 1 | 2) ?? currentHalf(),
      quarter: (task.horizon_quarter as 1 | 2 | 3 | 4) ?? currentQuarter(),
      month: task.horizon_month,
      weekStr: todayStr(),
      dayStr: todayStr(),
      timeStr: nowLocalStr(),
    }
  }
  if (task.horizon_quarter != null) {
    return {
      precision: 'quarter' as HorizonPrecision,
      year: task.horizon_year ?? currentYear(),
      half: (task.horizon_half as 1 | 2) ?? currentHalf(),
      quarter: task.horizon_quarter as 1 | 2 | 3 | 4,
      month: currentMonth(),
      weekStr: todayStr(),
      dayStr: todayStr(),
      timeStr: nowLocalStr(),
    }
  }
  if (task.horizon_half != null) {
    return {
      precision: 'half' as HorizonPrecision,
      year: task.horizon_year ?? currentYear(),
      half: task.horizon_half as 1 | 2,
      quarter: currentQuarter(),
      month: currentMonth(),
      weekStr: todayStr(),
      dayStr: todayStr(),
      timeStr: nowLocalStr(),
    }
  }
  if (task.horizon_year != null) {
    return {
      precision: 'year' as HorizonPrecision,
      year: task.horizon_year,
      half: currentHalf(),
      quarter: currentQuarter(),
      month: currentMonth(),
      weekStr: todayStr(),
      dayStr: todayStr(),
      timeStr: nowLocalStr(),
    }
  }
  return {
    precision: 'unplanned' as HorizonPrecision,
    year: currentYear(),
    half: currentHalf(),
    quarter: currentQuarter(),
    month: currentMonth(),
    weekStr: todayStr(),
    dayStr: todayStr(),
    timeStr: nowLocalStr(),
  }
}

export default function TaskForm({
  categories,
  task,
}: {
  categories: Category[]
  task?: Task
}) {
  const router = useRouter()
  const isEdit = !!task

  const initialHorizon = task ? taskToHorizonState(task) : null

  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [status, setStatus] = useState<TaskStatus>(task?.status ?? 'not_started')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    task?.category_id ?? null,
  )

  // Horizon state
  const [precision, setPrecision] = useState<HorizonPrecision>(
    initialHorizon?.precision ?? 'unplanned',
  )
  const [year, setYear] = useState(initialHorizon?.year ?? currentYear())
  const [half, setHalf] = useState<1 | 2>(initialHorizon?.half ?? currentHalf())
  const [quarter, setQuarter] = useState<1 | 2 | 3 | 4>(
    initialHorizon?.quarter ?? currentQuarter(),
  )
  const [month, setMonth] = useState(initialHorizon?.month ?? currentMonth())
  const [weekStr, setWeekStr] = useState(initialHorizon?.weekStr ?? todayStr())
  const [dayStr, setDayStr] = useState(initialHorizon?.dayStr ?? todayStr())
  const [timeStr, setTimeStr] = useState(initialHorizon?.timeStr ?? nowLocalStr())

  // Due date (for calendar + recurrence)
  const [dueDate, setDueDate] = useState<string>(task?.due_date ?? '')

  // Recurrence
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring ?? false)
  const [recurrenceOpts, setRecurrenceOpts] = useState<RecurrenceOptions>(
    task?.recurrence_rule
      ? (parseRrule(task.recurrence_rule) ?? { frequency: 'weekly', interval: 1, weekdays: [0,1,2,3,4], endDate: null })
      : { frequency: 'weekly', interval: 1, weekdays: [0,1,2,3,4], endDate: null },
  )

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Group children under their parent for display
  const categoryGroups = (() => {
    const parents = categories
      .filter((c) => c.parent_id === null)
      .sort((a, b) => a.sort_order - b.sort_order)
    return parents.map((parent) => ({
      parent,
      children: categories
        .filter((c) => c.parent_id === parent.id)
        .sort((a, b) => a.sort_order - b.sort_order),
    }))
  })()

  /**
   * Changing precision snaps the visible pickers to consistent values:
   * - Moving to a coarser level: derive from whatever fine value is currently set
   * - Moving to a finer level: seed from the coarser value already shown, defaulting to "now"
   */
  function handlePrecisionChange(next: HorizonPrecision) {
    const today = todayStr()

    // Helper: month of the currently-shown week picker
    const weekMonth = () => monthFromDate(getMondayOfWeek(weekStr))
    const weekYear  = () => yearFromDate(getMondayOfWeek(weekStr))
    // Helper: month of the currently-shown day picker
    const dayMonth  = () => monthFromDate(dayStr)
    const dayYear   = () => yearFromDate(dayStr)
    // Helper: month of the currently-shown time picker
    const timeDay   = () => timeStr.split('T')[0]
    const timeMonth = () => monthFromDate(timeDay())
    const timeYear  = () => yearFromDate(timeDay())

    if (next === 'unplanned') {
      setPrecision(next)
      return
    }

    if (next === 'year') {
      // Derive year from finest currently-set field
      if (precision === 'time')    setYear(timeYear())
      else if (precision === 'day')  setYear(dayYear())
      else if (precision === 'week') setYear(weekYear())
      // For month/quarter/half/year the year input is already visible — leave it
      else if (precision === 'unplanned') setYear(currentYear())
    }

    if (next === 'half') {
      if (precision === 'time')    { setYear(timeYear());  setHalf(quarterToHalf(monthToQuarter(timeMonth()))) }
      else if (precision === 'day')  { setYear(dayYear());   setHalf(quarterToHalf(monthToQuarter(dayMonth()))) }
      else if (precision === 'week') { setYear(weekYear());  setHalf(quarterToHalf(monthToQuarter(weekMonth()))) }
      else if (precision === 'month') setHalf(quarterToHalf(monthToQuarter(month)))
      else if (precision === 'quarter') setHalf(quarterToHalf(quarter))
      else if (precision === 'unplanned') { setYear(currentYear()); setHalf(currentHalf()) }
      // year → half: keep year, default half to current
      else if (precision === 'year') setHalf(currentHalf())
    }

    if (next === 'quarter') {
      if (precision === 'time')    { setYear(timeYear());  setQuarter(monthToQuarter(timeMonth())) }
      else if (precision === 'day')  { setYear(dayYear());   setQuarter(monthToQuarter(dayMonth())) }
      else if (precision === 'week') { setYear(weekYear());  setQuarter(monthToQuarter(weekMonth())) }
      else if (precision === 'month') setQuarter(monthToQuarter(month))
      else if (precision === 'half') setQuarter(half === 1 ? currentQuarter() <= 2 ? currentQuarter() : 1 : currentQuarter() >= 3 ? currentQuarter() : 3)
      else if (precision === 'unplanned') { setYear(currentYear()); setQuarter(currentQuarter()) }
      else if (precision === 'year') setQuarter(currentQuarter())
    }

    if (next === 'month') {
      if (precision === 'time')    { setYear(timeYear());  setMonth(timeMonth()) }
      else if (precision === 'day')  { setYear(dayYear());   setMonth(dayMonth()) }
      else if (precision === 'week') { setYear(weekYear());  setMonth(weekMonth()) }
      else if (precision === 'quarter') setMonth(currentMonth())   // stay in same quarter if possible
      else if (precision === 'half')    setMonth(currentMonth())
      else if (precision === 'year')    setMonth(currentMonth())
      else if (precision === 'unplanned') { setYear(currentYear()); setMonth(currentMonth()) }
    }

    if (next === 'week') {
      if (precision === 'time')   setWeekStr(getMondayOfWeek(timeDay()))
      else if (precision === 'day') setWeekStr(getMondayOfWeek(dayStr))
      else setWeekStr(getMondayOfWeek(today)) // coarser → finer: default to current week
    }

    if (next === 'day') {
      if (precision === 'time')   setDayStr(timeDay())
      else if (precision === 'week') setDayStr(getMondayOfWeek(weekStr)) // snap to Monday of selected week
      else setDayStr(today) // coarser → finer: default to today
    }

    if (next === 'time') {
      if (precision === 'day') {
        // Keep the date, snap time to next hour
        const d = new Date(dayStr + 'T12:00:00')
        d.setMinutes(0, 0, 0)
        d.setHours(d.getHours() + 1)
        setTimeStr(d.toISOString().slice(0, 16))
      } else if (precision !== 'time') {
        setTimeStr(nowLocalStr())
      }
    }

    setPrecision(next)
  }

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

    const url    = isEdit ? `/api/tasks/${task!.id}` : '/api/tasks'
    const method = isEdit ? 'PATCH' : 'POST'

    const recurrenceRule = isRecurring ? buildRrule(recurrenceOpts) : null

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        notes: notes || null,
        status,
        category_id: selectedCategoryId,
        due_date: dueDate || null,
        is_recurring: isRecurring,
        recurrence_rule: recurrenceRule,
        recurrence_end_date: isRecurring ? (recurrenceOpts.endDate ?? null) : null,
        ...horizonFields,
      }),
    })

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
      setSaving(false)
      return
    }

    router.push('/tasks')
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
              onClick={() => handlePrecisionChange(p)}
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
                  onChange={(e) => {
                    if (e.target.value) setWeekStr(getMondayOfWeek(e.target.value))
                  }}
                  className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">snapped to Monday</span>
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

      {/* Categories — top-level are group headers; children are selectable (single select) */}
      {categoryGroups.length > 0 && (
        <div>
          <p className="block text-sm font-medium text-gray-700 mb-3">Category</p>
          <div className="space-y-3">
            {categoryGroups.map(({ parent, children }) => (
              <div key={parent.id}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: parent.colour ?? '#6B7280' }}
                  />
                  <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                    {parent.name}
                  </span>
                </div>

                {children.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pl-4">
                    {children.map((child) => {
                      const colour = parent.colour ?? '#6B7280'
                      const selected = selectedCategoryId === child.id
                      return (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() =>
                            setSelectedCategoryId(selected ? null : child.id)
                          }
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
                    No subcategories — add them in Categories
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

      {/* Due date */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Due date
          <span className="ml-1 text-xs font-normal text-gray-400">(shows on calendar)</span>
        </label>
        <input
          type="date"
          value={dueDate}
          onChange={e => setDueDate(e.target.value)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {dueDate && (
          <button
            type="button"
            onClick={() => setDueDate('')}
            className="ml-2 text-xs text-gray-400 hover:text-red-500 transition-colors"
          >
            clear
          </button>
        )}
      </div>

      {/* Recurrence */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <button
            type="button"
            role="switch"
            aria-checked={isRecurring}
            onClick={() => setIsRecurring(r => !r)}
            className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              isRecurring ? 'bg-blue-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${
                isRecurring ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
          <span className="text-sm font-medium text-gray-700">Recurring task</span>
        </div>
        {isRecurring && (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
            <RecurrencePicker value={recurrenceOpts} onChange={setRecurrenceOpts} />
          </div>
        )}
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
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
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
