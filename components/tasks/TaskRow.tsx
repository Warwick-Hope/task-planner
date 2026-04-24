'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Task, Category, TaskStatus } from '@/types'
import { formatHorizon } from '@/lib/horizon'

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  not_started: 'wip',
  wip: 'done',
  done: 'not_started',
  cancelled: 'not_started',
}

const STATUS_ICON: Record<TaskStatus, { icon: string; className: string }> = {
  not_started: {
    icon: '○',
    className: 'text-gray-300 hover:text-gray-500',
  },
  wip: {
    icon: '◉',
    className: 'text-blue-500 hover:text-blue-600',
  },
  done: {
    icon: '✓',
    className: 'text-green-500 hover:text-green-600',
  },
  cancelled: {
    icon: '—',
    className: 'text-gray-300 hover:text-gray-500',
  },
}

function colourFor(categoryId: string, allCategories: Category[]): string {
  const cat = allCategories.find((c) => c.id === categoryId)
  if (!cat) return '#6B7280'
  if (cat.parent_id === null) return cat.colour ?? '#6B7280'
  const parent = allCategories.find((c) => c.id === cat.parent_id)
  return parent?.colour ?? '#6B7280'
}

export default function TaskRow({
  task: initialTask,
  allCategories,
}: {
  task: Task
  allCategories: Category[]
}) {
  const router = useRouter()
  const [task, setTask] = useState(initialTask)
  const [toggling, setToggling] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const statusConfig = STATUS_ICON[task.status]
  const category = task.category_id
    ? allCategories.find((c) => c.id === task.category_id) ?? null
    : null
  const categoryColour = category ? colourFor(category.id, allCategories) : null
  const horizonLabel = formatHorizon(task)
  const isUnplanned = horizonLabel === 'Unplanned'

  async function toggleStatus() {
    if (toggling) return
    const nextStatus = STATUS_CYCLE[task.status]
    setToggling(true)
    setTask((t) => ({ ...t, status: nextStatus }))

    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    })

    if (!res.ok) {
      setTask((t) => ({ ...t, status: task.status }))
    }
    setToggling(false)
    router.refresh()
  }

  async function deleteTask() {
    setDeleting(true)
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div
      className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
        task.status === 'done' ? 'opacity-60' : ''
      }`}
    >
      {/* Status toggle */}
      <button
        onClick={toggleStatus}
        disabled={toggling}
        title={`Status: ${task.status}. Click to advance.`}
        className={`mt-0.5 text-lg leading-none shrink-0 transition-colors ${statusConfig.className}`}
      >
        {statusConfig.icon}
      </button>

      {/* Title + notes */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm text-gray-900 ${task.status === 'done' ? 'line-through text-gray-400' : ''}`}
        >
          {task.title}
        </p>
        {task.notes && (
          <p className="mt-0.5 text-xs text-gray-400 truncate">{task.notes}</p>
        )}
      </div>

      {/* Category chip */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {category && categoryColour && (
          <span
            className="rounded-full px-2 py-0.5 text-xs text-white font-medium"
            style={{ backgroundColor: categoryColour }}
          >
            {category.name}
          </span>
        )}
      </div>

      {/* Horizon */}
      <span
        className={`hidden sm:block text-xs shrink-0 w-32 text-right ${
          isUnplanned ? 'text-gray-300' : 'text-gray-400'
        }`}
      >
        {horizonLabel}
      </span>

      {/* Delete */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button
              onClick={deleteTask}
              disabled={deleting}
              className="text-xs text-red-600 hover:text-red-700 font-medium"
            >
              {deleting ? '…' : 'Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-gray-300 hover:text-red-500 transition-colors px-1"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
