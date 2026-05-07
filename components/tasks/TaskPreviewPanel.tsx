'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Task, Category, TaskStatus } from '@/types'
import { formatHorizon } from '@/lib/horizon'
import { describeRrule } from '@/lib/recurrence'

const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: 'Not started',
  wip: 'In progress',
  done: 'Done',
  cancelled: 'Cancelled',
}

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  not_started: 'wip',
  wip: 'done',
  done: 'not_started',
  cancelled: 'not_started',
}

export default function TaskPreviewPanel({
  task: initial,
  categories,
  onClose,
}: {
  task: Task
  categories: Category[]
  onClose: () => void
}) {
  const router = useRouter()
  const [task, setTask] = useState(initial)
  const [saving, setSaving] = useState(false)

  // Re-sync if the task prop changes (e.g. after a refresh)
  useEffect(() => { setTask(initial) }, [initial])

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const cat = task.category_id ? categories.find(c => c.id === task.category_id) : null
  const parent = cat?.parent_id ? categories.find(c => c.id === cat.parent_id) : null
  const colour = (parent ?? cat)?.colour ?? null

  async function cycleStatus() {
    const next = STATUS_CYCLE[task.status]
    setTask(t => ({ ...t, status: next }))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    router.refresh()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-30 bg-black/20"
        onClick={onClose}
        aria-hidden
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-40 w-full max-w-sm bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Task</span>
          <div className="flex items-center gap-3">
            <Link
              href={`/tasks/${task.id}/edit`}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium"
            >
              Full edit
            </Link>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 text-xl leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Title */}
          <h2 className={`text-base font-semibold text-gray-900 leading-snug ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}>
            {task.title}
            {task.is_recurring && <span className="ml-2 text-gray-300 text-sm font-normal">↻</span>}
          </h2>

          {/* Notes */}
          {task.notes && (
            <p className="text-sm text-gray-600 leading-relaxed">{task.notes}</p>
          )}

          {/* Meta pills */}
          <div className="flex flex-wrap gap-2">
            {/* Status */}
            <button
              onClick={cycleStatus}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <span className={`w-1.5 h-1.5 rounded-full ${
                task.status === 'done' ? 'bg-green-500' :
                task.status === 'wip' ? 'bg-blue-500' : 'bg-gray-300'
              }`} />
              {STATUS_LABELS[task.status]}
            </button>

            {/* Category */}
            {cat && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium text-white"
                style={{ backgroundColor: colour ?? '#6B7280' }}
              >
                {parent ? `${parent.name} / ` : ''}{cat.name}
              </span>
            )}
          </div>

          {/* Horizon */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">When</p>
            <p className="text-sm text-gray-700">{formatHorizon(task)}</p>
          </div>

          {/* Recurrence */}
          {task.is_recurring && task.recurrence_rule && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Repeats</p>
              <p className="text-sm text-gray-700 capitalize">{describeRrule(task.recurrence_rule)}</p>
            </div>
          )}

          {/* Source */}
          {task.source === 'brain_dump' && (
            <span className="inline-block rounded-full bg-purple-50 px-2.5 py-0.5 text-xs text-purple-600 font-medium">
              Brain dump
            </span>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-2">
          <button
            onClick={cycleStatus}
            className="flex-1 rounded-lg bg-blue-600 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            {task.status === 'done' ? 'Mark not done' : task.status === 'wip' ? 'Mark done' : 'Start'}
          </button>
          <Link
            href={`/tasks/${task.id}/edit`}
            className="flex-1 text-center rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Edit
          </Link>
        </div>
      </div>
    </>
  )
}
