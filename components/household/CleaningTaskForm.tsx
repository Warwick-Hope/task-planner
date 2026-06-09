'use client'

import { useState } from 'react'
import type { Room, Category, Task } from '@/types'
import type { RecurrenceOptions } from '@/lib/recurrence'
import { buildRrule, parseRrule } from '@/lib/recurrence'
import RecurrencePicker from '@/components/tasks/RecurrencePicker'

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
  categories: Category[]
  members: Member[]
  childProfiles: ChildProfile[]
  task?: Task
  defaultRoomId?: string
  onSaved: (task: Task) => void
  onCancel: () => void
}

const DEFAULT_RECURRENCE: RecurrenceOptions = { frequency: 'weekly', interval: 1, weekdays: [], endDate: null }

export default function CleaningTaskForm({
  workspaceId,
  rooms,
  categories,
  members,
  childProfiles,
  task,
  defaultRoomId,
  onSaved,
  onCancel,
}: Props) {
  const editing = !!task

  const [title, setTitle] = useState(task?.title ?? '')
  const [notes, setNotes] = useState(task?.notes ?? '')
  const [roomId, setRoomId] = useState(task?.source_id ?? defaultRoomId ?? (rooms[0]?.id ?? ''))
  const [categoryId, setCategoryId] = useState(task?.category_id ?? '')
  const [isRecurring, setIsRecurring] = useState(task?.is_recurring ?? false)
  const [recurrenceOpts, setRecurrenceOpts] = useState<RecurrenceOptions>(
    task?.recurrence_rule ? (parseRrule(task.recurrence_rule) ?? DEFAULT_RECURRENCE) : DEFAULT_RECURRENCE
  )
  const [assignedToUserId, setAssignedToUserId] = useState(task?.assigned_to_user_id ?? '')
  const [assignedToProfileId, setAssignedToProfileId] = useState(task?.assigned_to_profile_id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) return
    setError(null)
    setLoading(true)

    const recurrenceRule = isRecurring ? buildRrule(recurrenceOpts) : null
    const body = {
      title: title.trim(),
      notes: notes.trim() || null,
      source: 'cleaning' as const,
      source_id: roomId || null,
      category_id: categoryId || null,
      is_recurring: isRecurring,
      recurrence_rule: recurrenceRule,
      recurrence_end_date: isRecurring ? (recurrenceOpts.endDate ?? null) : null,
      assigned_to_user_id: assignedToUserId || null,
      assigned_to_profile_id: assignedToProfileId || null,
    }

    if (editing && task) {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      onSaved(json.task ?? { ...task, ...body })
    } else {
      const res = await fetch(`/api/household/${workspaceId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      setLoading(false)
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); return }
      // fetch the full task back
      const taskRes = await fetch(`/api/tasks/${json.id}`)
      const taskJson = await taskRes.json()
      onSaved(taskJson.task ?? taskJson)
    }
  }

  const assigneeOptions = [
    ...members.map((m) => ({ value: `user:${m.userId}`, label: m.displayName })),
    ...childProfiles.map((p) => ({ value: `profile:${p.id}`, label: `${p.name} (child)` })),
  ]

  const currentAssigneeValue = assignedToUserId
    ? `user:${assignedToUserId}`
    : assignedToProfileId
    ? `profile:${assignedToProfileId}`
    : ''

  function setAssignee(val: string) {
    if (!val) {
      setAssignedToUserId('')
      setAssignedToProfileId('')
    } else if (val.startsWith('user:')) {
      setAssignedToUserId(val.slice(5))
      setAssignedToProfileId('')
    } else {
      setAssignedToUserId('')
      setAssignedToProfileId(val.slice(8))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">
        {editing ? 'Edit cleaning task' : 'New cleaning task'}
      </h3>

      {/* Title */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Task name</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Vacuum, Mop floors, Clean oven"
          required
          autoFocus
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* Room */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Room</label>
        <select
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
        >
          <option value="">— no room —</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional notes"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
      </div>

      {/* Category */}
      {categories.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="">— none —</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Assignee */}
      {(members.length > 0 || childProfiles.length > 0) && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Assign to</label>
          <select
            value={currentAssigneeValue}
            onChange={(e) => setAssignee(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
          >
            <option value="">— unassigned —</option>
            {assigneeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Recurring */}
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-700">Recurring task</span>
        </label>
        {isRecurring && (
          <div className="ml-6">
            <RecurrencePicker value={recurrenceOpts} onChange={setRecurrenceOpts} />
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Saving…' : editing ? 'Save changes' : 'Add task'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-gray-300 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
