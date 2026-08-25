'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Task, Category } from '@/types'
import { formatHorizon } from '@/lib/horizon'
import AssignButton from './AssignButton'
import { STATUS_CYCLE, STATUS_DISPLAY } from '@/lib/task-status'

function colourFor(categoryId: string, allCategories: Category[]): string {
  const cat = allCategories.find((c) => c.id === categoryId)
  if (!cat) return '#6B7280'
  if (cat.parent_id === null) return cat.colour ?? '#6B7280'
  const parent = allCategories.find((c) => c.id === cat.parent_id)
  return parent?.colour ?? '#6B7280'
}

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
  const [task, setTask] = useState(initialTask)
  const [toggling, setToggling] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const statusConfig = STATUS_DISPLAY[task.status]
  const category = task.category_id ? allCategories.find((c) => c.id === task.category_id) ?? null : null
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
    if (!res.ok) setTask((t) => ({ ...t, status: task.status }))
    setToggling(false)
    router.refresh()
  }

  async function deleteTask() {
    setDeleting(true)
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    router.refresh()
  }

  return (
    <div className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <button
        onClick={toggleStatus}
        disabled={toggling}
        className={`mt-0.5 text-lg leading-none shrink-0 transition-colors ${statusConfig.className}`}
      >
        {statusConfig.icon}
      </button>

      <div className="flex-1 min-w-0">
        <Link
          href={`/tasks/${task.id}/edit`}
          className={`text-sm truncate block ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900 hover:text-blue-600 transition-colors'}`}
        >
          {task.title}
          {task.is_recurring && <span className="ml-1.5 text-gray-300 text-xs" title="Recurring">↻</span>}
        </Link>
        {task.notes && <p className="mt-0.5 text-xs text-gray-400 truncate">{task.notes}</p>}
      </div>

      {/* Category chip */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        {category && categoryColour && (
          <span className="rounded-full px-2 py-0.5 text-xs text-white font-medium" style={{ backgroundColor: categoryColour }}>
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

      {/* Actions */}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
        <Link
          href={`/tasks/${task.id}/edit`}
          className="text-xs font-medium text-gray-400 hover:text-blue-600 transition-colors px-1"
        >
          Edit
        </Link>
        {confirmDelete ? (
          <div className="flex items-center gap-1">
            <button onClick={deleteTask} disabled={deleting} className="text-xs text-red-600 hover:text-red-700 font-medium">
              {deleting ? '…' : 'Delete'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-400 hover:text-gray-600">
              Cancel
            </button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-gray-300 hover:text-red-500 transition-colors px-1">
            ✕
          </button>
        )}
      </div>
    </div>
  )
}
