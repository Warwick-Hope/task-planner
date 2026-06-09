'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Room, Task, TaskStatus } from '@/types'

interface Props {
  rooms: Room[]
  tasks: Task[]
  today: string
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

function taskDate(task: Task): string | null {
  return task.due_date ?? task.horizon_day ?? null
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + n)
  return d.toISOString().split('T')[0]
}

function startOfWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d.toISOString().split('T')[0]
}

function formatWeekLabel(weekStart: string, today: string): string {
  const thisWeekStart = startOfWeek(today)
  const nextWeekStart = addDays(thisWeekStart, 7)
  if (weekStart === thisWeekStart) return 'This week'
  if (weekStart === nextWeekStart) return 'Next week'
  const d = new Date(weekStart)
  return `w/c ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

function ScheduleRow({
  task: initialTask,
  roomName,
}: {
  task: Task
  roomName: string
}) {
  const router = useRouter()
  const [task, setTask] = useState(initialTask)
  const [toggling, setToggling] = useState(false)

  async function toggle() {
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

  const cfg = STATUS_ICON[task.status]

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 last:border-0 ${task.status === 'done' ? 'opacity-50' : ''}`}>
      <button
        onClick={toggle}
        disabled={toggling}
        className={`text-lg leading-none shrink-0 transition-colors ${cfg.className}`}
      >
        {cfg.icon}
      </button>
      <span className={`flex-1 text-sm ${task.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
        {task.title}
        {task.is_recurring && <span className="ml-1.5 text-gray-300 text-xs">↻</span>}
      </span>
      <span className="text-xs text-gray-400 shrink-0 bg-gray-100 rounded-full px-2 py-0.5">
        {roomName}
      </span>
    </div>
  )
}

export default function CleaningScheduleView({ rooms, tasks, today }: Props) {
  const roomMap = new Map(rooms.map((r) => [r.id, r.name]))

  // Bucket tasks
  const overdue: Task[] = []
  const todayTasks: Task[] = []
  const upcoming: Map<string, Task[]> = new Map()
  const unscheduled: Task[] = []

  for (const task of tasks) {
    if (task.status === 'done') continue
    const date = taskDate(task)
    if (!date) {
      unscheduled.push(task)
      continue
    }
    if (date < today) {
      overdue.push(task)
    } else if (date === today) {
      todayTasks.push(task)
    } else {
      const ws = startOfWeek(date)
      if (!upcoming.has(ws)) upcoming.set(ws, [])
      upcoming.get(ws)!.push(task)
    }
  }

  // Sort overdue by date ascending (oldest first)
  overdue.sort((a, b) => (taskDate(a) ?? '').localeCompare(taskDate(b) ?? ''))

  // Sort upcoming weeks
  const upcomingWeeks = Array.from(upcoming.entries()).sort(([a], [b]) => a.localeCompare(b))

  const hasAnything = overdue.length > 0 || todayTasks.length > 0 || upcomingWeeks.length > 0

  if (!hasAnything && unscheduled.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-4 py-8 text-center">
        <p className="text-sm text-gray-400">No upcoming cleaning tasks scheduled.</p>
        <p className="text-xs text-gray-300 mt-1">Add due dates to tasks to see them here.</p>
      </div>
    )
  }

  function Section({ label, tasks: sectionTasks, accent }: { label: string; tasks: Task[]; accent?: string }) {
    if (sectionTasks.length === 0) return null
    return (
      <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className={`px-4 py-2.5 border-b border-gray-200 ${accent ?? 'bg-gray-50'}`}>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</h2>
        </div>
        {sectionTasks.map((t) => (
          <ScheduleRow key={t.id} task={t} roomName={roomMap.get(t.source_id ?? '') ?? '—'} />
        ))}
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {overdue.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-amber-200 bg-amber-50">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-700">
              Overdue ({overdue.length})
            </h2>
          </div>
          {overdue.map((t) => (
            <ScheduleRow key={t.id} task={t} roomName={roomMap.get(t.source_id ?? '') ?? '—'} />
          ))}
        </section>
      )}

      <Section label="Today" tasks={todayTasks} />

      {upcomingWeeks.map(([ws, wTasks]) => (
        <Section key={ws} label={formatWeekLabel(ws, today)} tasks={wTasks} />
      ))}

      {unscheduled.length > 0 && (
        <section className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-400">No date set</h2>
          </div>
          {unscheduled.map((t) => (
            <ScheduleRow key={t.id} task={t} roomName={roomMap.get(t.source_id ?? '') ?? '—'} />
          ))}
        </section>
      )}
    </div>
  )
}
