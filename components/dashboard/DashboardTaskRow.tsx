'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Task, Category, TaskStatus } from '@/types'

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  not_started: 'wip',
  wip: 'done',
  done: 'not_started',
  cancelled: 'not_started',
}

const STATUS_ICON: Record<TaskStatus, string> = {
  not_started: '○',
  wip: '◉',
  done: '✓',
  cancelled: '—',
}

const STATUS_CLASS: Record<TaskStatus, string> = {
  not_started: 'text-gray-300 hover:text-gray-500',
  wip: 'text-blue-500 hover:text-blue-600',
  done: 'text-green-500 hover:text-green-600',
  cancelled: 'text-gray-300',
}

function categoryColour(task: Task, cats: Category[]): string | null {
  if (!task.category_id) return null
  const cat = cats.find(c => c.id === task.category_id)
  if (!cat) return null
  const parent = cat.parent_id ? cats.find(c => c.id === cat.parent_id) : null
  return (parent ?? cat).colour ?? '#6B7280'
}

export default function DashboardTaskRow({
  task: initial,
  categories,
}: {
  task: Task
  categories: Category[]
}) {
  const router = useRouter()
  const [task, setTask]     = useState(initial)
  const [toggling, setToggling] = useState(false)

  const colour = categoryColour(task, categories)

  async function toggle() {
    if (toggling) return
    const next = STATUS_CYCLE[task.status]
    setToggling(true)
    setTask(t => ({ ...t, status: next }))
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setToggling(false)
    router.refresh()
  }

  const done = task.status === 'done'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors group ${done ? 'opacity-60' : ''}`}>
      <button
        onClick={toggle}
        disabled={toggling}
        className={`shrink-0 text-lg leading-none transition-colors ${STATUS_CLASS[task.status]}`}
      >
        {STATUS_ICON[task.status]}
      </button>

      {colour && (
        <span
          className="shrink-0 w-2 h-2 rounded-full"
          style={{ backgroundColor: colour }}
        />
      )}

      <span className={`flex-1 text-sm min-w-0 truncate ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
        {task.title}
        {task.is_recurring && <span className="ml-1 text-gray-300 text-xs">↻</span>}
      </span>

      <Link
        href={`/tasks/${task.id}/edit`}
        className="shrink-0 text-xs text-gray-200 hover:text-blue-500 transition-colors opacity-0 group-hover:opacity-100"
        title="Edit"
      >
        ✎
      </Link>
    </div>
  )
}
