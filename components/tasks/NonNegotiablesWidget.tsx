'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Task, NonNegotiableWithTask } from '@/types'

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

  async function addTask(taskId: string) {
    if (!taskId) return
    setAddingSlot(null)

    const res = await fetch('/api/non-negotiables', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: taskId, date, sort_order: items.length }),
    })
    if (!res.ok) return

    const item = await res.json() as NonNegotiableWithTask
    setItems(prev => [...prev, item])
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
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                {/* Done toggle */}
                <button
                  onClick={() => toggleDone(item)}
                  className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    isDone
                      ? 'bg-green-500 border-green-500 text-white'
                      : 'border-gray-300 hover:border-green-400'
                  }`}
                  title={isDone ? 'Mark not done' : 'Mark done'}
                >
                  {isDone && (
                    <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
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
                  className="shrink-0 text-gray-300 hover:text-red-400 transition-colors text-lg leading-none"
                  title="Remove from today's focus"
                >
                  ×
                </button>
              </div>
            )
          }

          // Empty slot
          if (addingSlot === slot) {
            return (
              <div key={`empty-${slot}`} className="flex items-center gap-3 px-4 py-2.5">
                <div className="shrink-0 w-5 h-5 rounded-full border-2 border-gray-200" />
                <select
                  autoFocus
                  className="flex-1 rounded-md border border-blue-400 bg-white px-2 py-1 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  defaultValue=""
                  onChange={e => addTask(e.target.value)}
                  onBlur={() => setAddingSlot(null)}
                >
                  <option value="" disabled>Pick a task…</option>
                  {unpinned.map(t => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </select>
                <button
                  onClick={() => setAddingSlot(null)}
                  className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors text-lg leading-none"
                >
                  ×
                </button>
              </div>
            )
          }

          return (
            <div key={`empty-${slot}`} className="flex items-center gap-3 px-4 py-3">
              <div className="shrink-0 w-5 h-5 rounded-full border-2 border-dashed border-gray-200" />
              {unpinned.length > 0 ? (
                <button
                  onClick={() => setAddingSlot(slot)}
                  className="flex-1 text-left text-sm text-gray-300 hover:text-blue-500 transition-colors"
                >
                  + Add a focus task
                </button>
              ) : (
                <span className="flex-1 text-sm text-gray-300 italic">No tasks available</span>
              )}
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
