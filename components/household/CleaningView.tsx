'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Room, Category, Task, TaskStatus } from '@/types'
import CleaningTaskForm from './CleaningTaskForm'
import { formatHorizon } from '@/lib/horizon'

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
  workspaceId: string
  rooms: Room[]
  tasks: Task[]
  categories: Category[]
  members: Member[]
  childProfiles: ChildProfile[]
  canManage: boolean
}

const STATUS_CYCLE: Record<TaskStatus, TaskStatus> = {
  not_started: 'wip',
  wip: 'done',
  done: 'not_started',
  cancelled: 'not_started',
}

const STATUS_ICON: Record<TaskStatus, { icon: string; className: string }> = {
  not_started: { icon: '○', className: 'text-gray-300 hover:text-gray-500' },
  wip:         { icon: '◉', className: 'text-blue-500 hover:text-blue-600' },
  done:        { icon: '✓', className: 'text-green-500 hover:text-green-600' },
  cancelled:   { icon: '—', className: 'text-gray-300 hover:text-gray-500' },
}

function TaskRow({
  task: initialTask,
  onEdit,
  onDeleted,
}: {
  task: Task
  onEdit: (task: Task) => void
  onDeleted: (id: string) => void
}) {
  const router = useRouter()
  const [task, setTask] = useState(initialTask)
  const [toggling, setToggling] = useState(false)
  const horizonLabel = formatHorizon(task)

  async function toggleStatus() {
    if (toggling) return
    const next = STATUS_CYCLE[task.status]
    setToggling(true)
    setTask((t) => ({ ...t, status: next }))
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) setTask((t) => ({ ...t, status: initialTask.status }))
    setToggling(false)
    router.refresh()
  }

  async function handleDelete() {
    if (!confirm('Delete this cleaning task?')) return
    await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
    onDeleted(task.id)
    router.refresh()
  }

  const cfg = STATUS_ICON[task.status]

  return (
    <div className={`group flex items-start gap-3 px-4 py-3 border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors ${task.status === 'done' ? 'opacity-60' : ''}`}>
      <button
        onClick={toggleStatus}
        disabled={toggling}
        className={`mt-0.5 text-lg leading-none shrink-0 transition-colors ${cfg.className}`}
      >
        {cfg.icon}
      </button>

      <div className="flex-1 min-w-0">
        <span className={`text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
          {task.title}
          {task.is_recurring && <span className="ml-1.5 text-gray-300 text-xs" title="Recurring">↻</span>}
        </span>
        {task.notes && <p className="mt-0.5 text-xs text-gray-400 truncate">{task.notes}</p>}
      </div>

      <span className="hidden sm:block text-xs text-gray-400 shrink-0">{horizonLabel}</span>

      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
        <button
          onClick={() => onEdit(task)}
          className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          className="text-xs text-gray-300 hover:text-red-500 transition-colors"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

export default function CleaningView({
  workspaceId,
  rooms,
  tasks: initialTasks,
  categories,
  members,
  childProfiles,
  canManage,
}: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [addingToRoom, setAddingToRoom] = useState<string | null>(null)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  function tasksSavedHandler(task: Task) {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = task
        return next
      }
      return [...prev, task]
    })
    setAddingToRoom(null)
    setEditingTask(null)
  }

  function handleDeleted(id: string) {
    setTasks((prev) => prev.filter((t) => t.id !== id))
  }

  const unlinked = tasks.filter((t) => !t.source_id || !rooms.find((r) => r.id === t.source_id))

  return (
    <div className="space-y-6">
      {rooms.map((room) => {
        const roomTasks = tasks.filter((t) => t.source_id === room.id)
        const isAddingHere = addingToRoom === room.id
        const editingHere = editingTask && editingTask.source_id === room.id ? editingTask : null

        return (
          <section key={room.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <span>🏠</span>
                {room.name}
                <span className="text-xs font-normal text-gray-400">({roomTasks.length})</span>
              </h2>
              {canManage && !isAddingHere && !editingHere && (
                <button
                  onClick={() => { setAddingToRoom(room.id); setEditingTask(null) }}
                  className="text-xs text-blue-600 hover:text-blue-800 transition-colors"
                >
                  + Add task
                </button>
              )}
            </div>

            {roomTasks.length === 0 && !isAddingHere && (
              <p className="px-4 py-3 text-sm text-gray-400">No cleaning tasks for this room yet.</p>
            )}

            {roomTasks.map((task) =>
              editingTask?.id === task.id ? (
                <div key={task.id} className="p-4">
                  <CleaningTaskForm
                    workspaceId={workspaceId}
                    rooms={rooms}
                    categories={categories}
                    members={members}
                    childProfiles={childProfiles}
                    task={task}
                    onSaved={tasksSavedHandler}
                    onCancel={() => setEditingTask(null)}
                  />
                </div>
              ) : (
                <TaskRow
                  key={task.id}
                  task={task}
                  onEdit={(t) => { setEditingTask(t); setAddingToRoom(null) }}
                  onDeleted={handleDeleted}
                />
              )
            )}

            {isAddingHere && (
              <div className="p-4">
                <CleaningTaskForm
                  workspaceId={workspaceId}
                  rooms={rooms}
                  categories={categories}
                  members={members}
                  childProfiles={childProfiles}
                  defaultRoomId={room.id}
                  onSaved={tasksSavedHandler}
                  onCancel={() => setAddingToRoom(null)}
                />
              </div>
            )}
          </section>
        )
      })}

      {/* Unlinked tasks (room was deleted) */}
      {unlinked.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-500">No room assigned</h2>
          </div>
          {unlinked.map((task) =>
            editingTask?.id === task.id ? (
              <div key={task.id} className="p-4">
                <CleaningTaskForm
                  workspaceId={workspaceId}
                  rooms={rooms}
                  categories={categories}
                  members={members}
                  childProfiles={childProfiles}
                  task={task}
                  onSaved={tasksSavedHandler}
                  onCancel={() => setEditingTask(null)}
                />
              </div>
            ) : (
              <TaskRow
                key={task.id}
                task={task}
                onEdit={(t) => { setEditingTask(t); setAddingToRoom(null) }}
                onDeleted={handleDeleted}
              />
            )
          )}
        </section>
      )}

      {rooms.length === 0 && (
        <p className="text-sm text-gray-400">Add rooms first before creating cleaning tasks.</p>
      )}
    </div>
  )
}
