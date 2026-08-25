'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Task, Category } from '@/types'
import { formatHorizon } from '@/lib/horizon'
import AssignButton from './AssignButton'
import { STATUS_DISPLAY } from '@/lib/task-status'
import { categoryColour, DEFAULT_CATEGORY_COLOUR } from '@/lib/category-colour'
import { useTaskStatus } from '@/lib/use-task-status'

interface Member {
  id: string
  userId: string
  displayName: string
}

interface ChildProfile {
  id: string
  name: string
  avatarColour: string
}

interface Props {
  task: Task
  allCategories: Category[]
  workspaceId: string
  currentUserId: string
  members: Member[]
  childProfiles: ChildProfile[]
}

export default function HouseholdTaskRow({
  task: initialTask,
  allCategories,
  workspaceId,
  currentUserId,
  members,
  childProfiles,
}: Props) {
  const router = useRouter()
  const { task, setTask, toggling, toggleStatus } = useTaskStatus(initialTask)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const statusConfig = STATUS_DISPLAY[task.status]
  const category = task.category_id ? allCategories.find((c) => c.id === task.category_id) ?? null : null
  const dotColour = category ? categoryColour(category.id, allCategories) ?? DEFAULT_CATEGORY_COLOUR : null
  const horizonLabel = formatHorizon(task)
  const isUnplanned = horizonLabel === 'Unplanned'

  async function deleteTask() {
    setDeleting(true)
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className={`group flex items-start gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <button
        onClick={toggleStatus}
        disabled={toggling}
        aria-label={`Status: ${task.status}. Advance status.`}
        className={`shrink-0 flex items-center justify-center min-h-[40px] min-w-[36px] sm:min-h-0 sm:min-w-0 sm:mt-0.5 text-lg leading-none transition-colors ${statusConfig.className}`}
      >
        {statusConfig.icon}
      </button>

      <div className="flex-1 min-w-0 py-2 sm:py-0">
        <Link
          href={`/tasks/${task.id}/edit`}
          className={`text-sm truncate block ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 hover:text-blue-600 transition-colors'}`}
        >
          {task.title}
          {task.is_recurring && <span className="ml-1.5 text-gray-300 text-xs" title="Recurring">↻</span>}
        </Link>
        {task.notes && <p className="mt-0.5 text-xs text-gray-400 truncate">{task.notes}</p>}

        {/* Category and horizon have their own columns from sm up; on a phone
            they stack under the title instead of disappearing. */}
        {(category || !isUnplanned) && (
          <div className="sm:hidden mt-1 flex items-center gap-1.5 min-w-0">
            {category && dotColour && (
              <span className="shrink-0 w-2 h-2 rounded-full" style={{ backgroundColor: dotColour }} />
            )}
            {category && <span className="text-xs text-gray-500 truncate">{category.name}</span>}
            {category && !isUnplanned && <span className="text-gray-300 text-xs">·</span>}
            {!isUnplanned && <span className="text-xs text-gray-400 shrink-0">{horizonLabel}</span>}
          </div>
        )}
      </div>

      {/* Category chip */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {category && dotColour && (
          <span className="rounded-full px-2 py-0.5 text-xs text-white font-medium" style={{ backgroundColor: dotColour }}>
            {category.name}
          </span>
        )}
      </div>

      {/* Horizon */}
      <span className={`hidden sm:block text-xs shrink-0 w-28 text-right ${isUnplanned ? 'text-gray-300' : 'text-gray-400'}`}>
        {horizonLabel}
      </span>

      {/* Assign */}
      <div className="shrink-0">
        <AssignButton
          taskId={task.id}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          assignedToUserId={task.assigned_to_user_id}
          assignedToProfileId={task.assigned_to_profile_id}
          assignmentStatus={task.assignment_status}
          members={members}
          childProfiles={childProfiles}
          onUpdated={(patch) => setTask((t) => ({ ...t, ...patch }))}
        />
      </div>

      {/* Actions — hover-revealed from md up, always visible below that so they
          are reachable on a touch screen. */}
      <div className="shrink-0 flex items-center gap-0.5 sm:gap-1 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-within:opacity-100">
        <Link
          href={`/tasks/${task.id}/edit`}
          title="Edit task"
          aria-label="Edit task"
          className="flex items-center justify-center min-h-[40px] min-w-[36px] sm:min-h-0 sm:min-w-0 sm:px-1 text-sm sm:text-xs font-medium text-gray-400 hover:text-blue-600 transition-colors"
        >
          <span className="hidden sm:inline">Edit</span>
          <span className="sm:hidden">✎</span>
        </Link>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={deleteTask} disabled={deleting} className="min-h-[40px] sm:min-h-0 px-1 text-xs text-red-600 hover:text-red-700 font-medium">
              {deleting ? '…' : 'Delete'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="min-h-[40px] sm:min-h-0 px-1 text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            title="Delete task"
            aria-label="Delete task"
            className="flex items-center justify-center min-h-[40px] min-w-[36px] sm:min-h-0 sm:min-w-0 sm:px-1 text-sm sm:text-xs text-gray-300 hover:text-red-500 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
