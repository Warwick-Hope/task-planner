'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Task } from '@/types'
import { nextStatus } from '@/lib/task-status'

/**
 * Optimistic status toggling, shared by every component that renders a task.
 *
 * The same fifteen lines were written five times — TaskRow, HouseholdTaskRow,
 * DashboardTaskRow, CleaningView and CleaningScheduleView — and they had already
 * drifted: DashboardTaskRow never rolled back when the PATCH failed, so a failed
 * request left the row showing a status the database did not have. Sharing the
 * implementation fixes that everywhere.
 *
 * `setTask` is returned because some callers update the task for other reasons
 * (assignment, for one) and need the same local copy.
 */
export function useTaskStatus(initialTask: Task) {
  const router = useRouter()
  const [task, setTask] = useState(initialTask)
  const [toggling, setToggling] = useState(false)

  async function toggleStatus() {
    if (toggling) return

    const previous = task.status
    const next = nextStatus(previous)

    setToggling(true)
    setTask(t => ({ ...t, status: next }))

    const response = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })

    // Put the row back if the write did not land, rather than showing a status
    // the database does not have.
    if (!response.ok) setTask(t => ({ ...t, status: previous }))

    setToggling(false)
    router.refresh()
  }

  return { task, setTask, toggling, toggleStatus }
}
