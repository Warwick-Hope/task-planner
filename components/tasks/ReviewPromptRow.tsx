'use client'

import Link from 'next/link'
import type { Task } from '@/types'
import { useTaskStatus } from '@/lib/use-task-status'
import StatusButton from '@/components/tasks/StatusButton'

/**
 * A row in the "Needs attention" panel.
 *
 * Split out of ReviewPromptsPanel, which is a server component and cannot hold
 * the status hook. The panel's whole purpose is tasks that have run past their
 * horizon, and the most common answer to "this was due last month" is that it is
 * already done — so the panel offered Set date and nothing else for far too long.
 */
export default function ReviewPromptRow({
  task: initial,
  label,
  labelClass,
  categoryName,
}: {
  task: Task
  label: string
  labelClass: string
  categoryName: string | null
}) {
  const { task, toggling, toggleStatus } = useTaskStatus(initial)
  const done = task.status === 'done'

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 ${done ? 'opacity-60' : ''}`}>
      <StatusButton status={task.status} toggling={toggling} onToggle={toggleStatus} />

      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${done ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
        </p>
        <p className={`text-xs mt-0.5 ${labelClass}`}>{label}</p>
      </div>

      {categoryName && (
        <span className="hidden sm:inline text-xs text-gray-400 shrink-0">{categoryName}</span>
      )}

      <Link
        href={`/tasks/${task.id}/edit`}
        className="shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-2 sm:py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
      >
        Set date
      </Link>
    </div>
  )
}
