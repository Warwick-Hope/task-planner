'use client'

import { useState, useTransition, useRef } from 'react'
import { useRouter } from 'next/navigation'
import type { Task, NonNegotiableWithTask } from '@/types'

/** Build full horizon fields for a given date string (YYYY-MM-DD) */
function horizonFieldsForDate(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const year  = d.getFullYear()
  const month = d.getMonth() + 1
  const quarter = Math.ceil(month / 3) as 1 | 2 | 3 | 4
  const half  = quarter <= 2 ? 1 : 2
  const monday = new Date(d)
  const dow = monday.getDay()
  monday.setDate(monday.getDate() + (dow === 0 ? -6 : 1 - dow))
  const weekStr = monday.toISOString().split('T')[0]
  return {
    horizon_year: year,
    horizon_half: half,
    horizon_quarter: quarter,
    horizon_month: month,
    horizon_week: weekStr,
    horizon_day: dateStr,
    horizon_time_slot: null,
  }
}

const SLOTS = [0, 1, 2]

interface Props {
  date: string
  initialItems: NonNegotiableWithTask[]
  availableTasks: Task[]
}

export default function NonNegotiablesWidget({ date, initialItems, availableTasks }: Props) {
  const router = useRouter()
  const [items, setItems] = useState<NonNegotiableWithTask[]>(initialItems)
  const [addingSlot, setAddingSlot] = useState<number | null>(null)
  const [, startTransition] = useTransition()

  // Tasks not already pinned today
  const pinned = new Set(items.map(i => i.task_id))
  const unpinned = availableTasks.filter(t => !pinned.has(t.id))

  async function pinTask(taskId: string) {
    // Set the task's horizon_day to today so it appears in the calendar
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(horizonFieldsForDate(date)),
    })

    const res = await fetch('/api/non-negotiables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, date, sort_order: items.length }),
    })
    if (!res.ok) return null
    return res.json() as Promise<NonNegotiableWithTask>
  }

  async function addTask(taskId: string) {
    if (!taskId) return
    setAddingSlot(null)
    const item = await pinTask(taskId)
    if (item) setItems(prev => [...prev, item])
    startTransition(() => router.refresh())
  }

  async function createAndPin(title: string) {
    if (!title.trim()) return
    setAddingSlot(null)

    // 1. Create the task
    const createRes = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), horizon_day: date }),
    })
    if (!createRes.ok) return
    const { id: taskId } = await createRes.json() as { id: string }

    // 2. Pin it as a non-negotiable
    const item = await pinTask(taskId)
    if (item) setItems(prev => [...prev, item])
    startTransition(() => router.refresh())
  }

  async function removeItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch(`/api/non-negotiables/${id}`, { method: 'DELETE' })
    startTransition(() => router.refresh())
  }

  async function toggleDone(item: NonNegotiableWithTask) {
    const nextStatus = item.task.status === 'done' ? 'not_started' : 'done'
    // Optimistic update
    setItems(prev =>
      prev.map(i =>
        i.id === item.id ? { ...i, task: { ...i.task, status: nextStatus } } : i,
      ),
    )
    await fetch(`/api/tasks/${item.task_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })
    startTransition(() => router.refresh())
  }

  const completed = items.filter(i => i.task.status === 'done').length
  const total = items.length

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900">Today&apos;s focus</span>
          <span className="text-xs text-gray-400">— 3 non-negotiables</span>
        </div>
        {total > 0 && (
          <span className={`text-xs font-medium ${completed === total ? 'text-green-600' : 'text-gray-400'}`}>
            {completed}/{total} done
          </span>
        )}
      </div>

      {/* Slots */}
      <div className="divide-y divide-gray-50">
        {SLOTS.map(slot => {
          const item = items[slot]

          if (item) {
            const isDone = item.task.status === 'done'
            return (
              <div key={item.id} className="flex items-center gap-2 sm:gap-3 px-4 py-1.5 sm:py-3">
                {/* Done toggle — the circle stays 20px; the button around it is
                    finger-sized on a phone. */}
                <button
                  onClick={() => toggleDone(item)}
                  className="shrink-0 flex items-center justify-center min-h-[40px] min-w-[36px] sm:min-h-0 sm:min-w-0"
                  title={isDone ? 'Mark not done' : 'Mark done'}
                  aria-label={isDone ? 'Mark not done' : 'Mark done'}
                >
                  <span
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isDone
                        ? 'bg-green-500 border-green-500 text-white'
                        : 'border-gray-300 hover:border-green-400'
                    }`}
                  >
                    {isDone && (
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                </button>

                {/* Title */}
                <span className={`flex-1 text-sm ${isDone ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {item.task.title}
                </span>

                {/* Slot number */}
                <span className="shrink-0 text-xs text-gray-300 font-medium tabular-nums">
                  {slot + 1}
                </span>

                {/* Remove */}
                <button
                  onClick={() => removeItem(item.id)}
                  className="shrink-0 flex items-center justify-center min-h-[40px] min-w-[36px] sm:min-h-0 sm:min-w-0 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                  title="Remove from today's focus"
                  aria-label="Remove from today's focus"
                >
                  ×
                </button>
              </div>
            )
          }

          // Empty slot — active input
          if (addingSlot === slot) {
            return (
              <EmptySlotInput
                key={`empty-${slot}`}
                slot={slot}
                unpinned={unpinned}
                onCreate={createAndPin}
                onPick={addTask}
                onCancel={() => setAddingSlot(null)}
              />
            )
          }

          // Empty slot — idle
          return (
            <div key={`empty-${slot}`} className="flex items-center gap-2 sm:gap-3 px-4 py-1.5 sm:py-3">
              <div className="shrink-0 w-5 h-5 mx-2 sm:mx-0 rounded-full border-2 border-dashed border-gray-200" />
              <button
                onClick={() => setAddingSlot(slot)}
                className="flex-1 text-left text-sm text-gray-300 hover:text-blue-500 transition-colors min-h-[40px] sm:min-h-0"
              >
                + Add a focus task
              </button>
              <span className="shrink-0 text-xs text-gray-200 font-medium tabular-nums">
                {slot + 1}
              </span>
            </div>
          )
        })}
      </div>

      {/* Completion celebration */}
      {total === 3 && completed === 3 && (
        <div className="px-4 py-2.5 bg-green-50 border-t border-green-100 text-center">
          <span className="text-sm text-green-700 font-medium">All 3 done — great work today!</span>
        </div>
      )}
    </div>
  )
}

// ── Empty slot input ──────────────────────────────────────────────────────────

function EmptySlotInput({
  unpinned,
  onCreate,
  onPick,
  onCancel,
}: {
  slot: number
  unpinned: Task[]
  onCreate: (title: string) => void
  onPick: (taskId: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && text.trim()) { onCreate(text); return }
    if (e.key === 'Escape') onCancel()
  }

  return (
    <div className="px-4 py-2.5 space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="shrink-0 w-5 h-5 rounded-full border-2 border-blue-300" />
        <input
          ref={inputRef}
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Type task name and press Enter…"
          className="flex-1 rounded-md border border-blue-400 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <button onClick={onCancel} className="shrink-0 text-gray-300 hover:text-gray-500 text-lg leading-none">×</button>
      </div>

      <div className="flex items-center gap-2 pl-7">
        {text.trim() && (
          <button
            onClick={() => onCreate(text)}
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Create &ldquo;{text.trim()}&rdquo;
          </button>
        )}
        {unpinned.length > 0 && (
          <button
            onClick={() => setShowPicker(p => !p)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showPicker ? 'Hide list' : 'Pick existing task'}
          </button>
        )}
      </div>

      {showPicker && (
        <div className="pl-7">
          <select
            className="w-full rounded-md border border-gray-200 bg-white px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            defaultValue=""
            onChange={e => { if (e.target.value) onPick(e.target.value) }}
          >
            <option value="" disabled>Select a task…</option>
            {unpinned.map(t => (
              <option key={t.id} value={t.id}>{t.title}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
