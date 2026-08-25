'use client'

import Link from 'next/link'
import type { Task, Category, TaskStatus } from '@/types'
import { STATUS_DISPLAY } from '@/lib/task-status'
import { categoryColour } from '@/lib/category-colour'
import { useTaskStatus } from '@/lib/use-task-status'

const STATUS_CLASS: Record<TaskStatus, string> = {
  not_started: 'text-gray-300 hover:text-gray-500',
  wip: 'text-blue-500 hover:text-blue-600',
  done: 'text-green-500 hover:text-green-600',
  cancelled: 'text-gray-300',
}

export default function DashboardTaskRow({
  task: initial,
  categories,
}: {
  task: Task
  categories: Category[]
}) {
  const { task, toggling, toggleStatus } = useTaskStatus(initial)

  const colour = categoryColour(task.category_id, categories)

  const done = task.status === 'done'

  return (
    <div className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-1.5 sm:py-2.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors group ${done ? 'opacity-60' : ''}`}>
      <button
        onClick={toggleStatus}
        disabled={toggling}
        aria-label={`Status: ${task.status}. Advance status.`}
        className={`shrink-0 flex items-center justify-center min-h-[40px] min-w-[36px] sm:min-h-0 sm:min-w-0 text-lg leading-none transition-colors ${STATUS_CLASS[task.status]}`}
      >
        {STATUS_DISPLAY[task.status].icon}
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
        className="shrink-0 flex items-center justify-center min-h-[40px] min-w-[36px] sm:min-h-0 sm:min-w-0 text-sm sm:text-xs text-gray-300 sm:text-gray-200 hover:text-blue-500 transition-colors md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
        title="Edit"
        aria-label="Edit task"
      >
        ✎
      </Link>
    </div>
  )
}
