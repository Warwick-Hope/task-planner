'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { Task, Category } from '@/types'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getMonthGrid(year: number, month: number): (Date | null)[] {
  // Returns array of 42 cells (6 weeks × 7 days), null for padding
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  // Monday-first grid: 0=Mon … 6=Sun
  const startPad = (first.getDay() + 6) % 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate()
}

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]
const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

// ─── Task chip ────────────────────────────────────────────────────────────────

function TaskChip({
  task,
  categories,
  isDragging = false,
}: {
  task: Task
  categories: Category[]
  isDragging?: boolean
}) {
  const cat = task.category_id ? categories.find(c => c.id === task.category_id) : null
  const parent = cat?.parent_id ? categories.find(c => c.id === cat.parent_id) : null
  const colour = (parent ?? cat)?.colour ?? '#6B7280'

  return (
    <div
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs truncate cursor-grab select-none
        ${task.status === 'done' ? 'opacity-50 line-through' : ''}
        ${isDragging ? 'shadow-lg opacity-90 rotate-1' : 'hover:brightness-95'}
      `}
      style={{ backgroundColor: colour + '22', borderLeft: `3px solid ${colour}` }}
    >
      <span className="truncate text-gray-800">{task.title}</span>
    </div>
  )
}

// ─── Draggable task chip ──────────────────────────────────────────────────────

function DraggableTaskChip({
  task,
  categories,
}: {
  task: Task
  categories: Category[]
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.3 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <Link href={`/tasks/${task.id}/edit`} onClick={e => { if (isDragging) e.preventDefault() }}>
        <TaskChip task={task} categories={categories} />
      </Link>
    </div>
  )
}

// ─── Droppable day cell ───────────────────────────────────────────────────────

function DayCell({
  date,
  tasks,
  categories,
  isToday,
  isCurrentMonth,
}: {
  date: Date
  tasks: Task[]
  categories: Category[]
  isToday: boolean
  isCurrentMonth: boolean
}) {
  const dateStr = toDateStr(date)
  const { setNodeRef, isOver } = useDroppable({ id: dateStr })

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[100px] p-1.5 border-b border-r border-gray-100 flex flex-col gap-0.5 transition-colors
        ${isOver ? 'bg-blue-50' : isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
      `}
    >
      <span className={`text-xs font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full
        ${isToday ? 'bg-blue-600 text-white' : isCurrentMonth ? 'text-gray-700' : 'text-gray-300'}
      `}>
        {date.getDate()}
      </span>

      {tasks.map(t => (
        <DraggableTaskChip key={t.id} task={t} categories={categories} />
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarClient({
  tasks: initialTasks,
  categories,
}: {
  tasks: Task[]
  categories: Category[]
}) {
  const router = useRouter()
  const today = new Date()

  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth()) // 0-based
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  const cells = getMonthGrid(year, month)

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function tasksForDate(date: Date) {
    const ds = toDateStr(date)
    return tasks.filter(t => t.due_date === ds)
  }

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id)
    setActiveTask(task ?? null)
  }, [tasks])

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const taskId  = active.id as string
    const newDate = over.id  as string // YYYY-MM-DD

    const task = tasks.find(t => t.id === taskId)
    if (!task || task.due_date === newDate) return

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: newDate } : t))

    const res = await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ due_date: newDate }),
    })
    if (!res.ok) {
      // Revert on failure
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, due_date: task.due_date } : t))
    }
    router.refresh()
  }, [tasks, router])

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Month navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <button
          onClick={prevMonth}
          className="rounded-md p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className="text-sm font-semibold text-gray-900">
          {MONTH_NAMES[month]} {year}
        </h2>
        <button
          onClick={nextMonth}
          className="rounded-md p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b border-gray-100">
          {DAY_NAMES.map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 border-r border-gray-100 last:border-r-0">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) {
              return (
                <div
                  key={`pad-${i}`}
                  className="min-h-[100px] border-b border-r border-gray-100 bg-gray-50"
                />
              )
            }
            return (
              <DayCell
                key={toDateStr(date)}
                date={date}
                tasks={tasksForDate(date)}
                categories={categories}
                isToday={sameDay(date, today)}
                isCurrentMonth={date.getMonth() === month}
              />
            )
          })}
        </div>

        {/* Drag overlay — follows the cursor */}
        <DragOverlay>
          {activeTask && (
            <TaskChip task={activeTask} categories={categories} isDragging />
          )}
        </DragOverlay>
      </DndContext>

      {/* Empty state */}
      {tasks.length === 0 && (
        <div className="py-10 text-center border-t border-gray-100">
          <p className="text-sm text-gray-400">No tasks have a due date yet.</p>
          <p className="mt-1 text-xs text-gray-300">
            Set a due date on a task to see it here.
          </p>
        </div>
      )}
    </div>
  )
}
