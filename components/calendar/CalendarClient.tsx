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
import { buildHorizonFields } from '@/lib/horizon'

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CalView = 'month' | 'week' | 'day'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
const DAY_NAMES_FULL  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const HOURS = Array.from({ length: 17 }, (_, i) => i + 7) // 07:00 – 23:00

function toDateStr(d: Date) { return d.toISOString().split('T')[0] }

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getMondayOf(d: Date) {
  const r = new Date(d)
  const dow = r.getDay()
  const diff = dow === 0 ? -6 : 1 - dow
  r.setDate(r.getDate() + diff)
  return r
}

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  const startPad = (first.getDay() + 6) % 7
  const cells: (Date | null)[] = []
  for (let i = 0; i < startPad; i++) cells.push(null)
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function tasksForDay(tasks: Task[], dateStr: string) {
  return tasks.filter(t => t.horizon_day === dateStr)
}

function tasksForWeek(tasks: Task[], weekStr: string) {
  return tasks.filter(t => t.horizon_week === weekStr && !t.horizon_day)
}

function unplannedTasks(tasks: Task[]) {
  return tasks.filter(t => !t.horizon_year)
}

function getHorizonFieldsForDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const year    = d.getFullYear()
  const month   = d.getMonth() + 1
  const quarter = Math.ceil(month / 3) as 1|2|3|4
  const half    = quarter <= 2 ? 1 : 2
  const monday  = getMondayOf(d)
  return buildHorizonFields('day', {
    year, half, quarter, month,
    weekStr: toDateStr(monday),
    dayStr: dateStr,
  })
}

// ─── Task chip ────────────────────────────────────────────────────────────────

function chipColour(task: Task, cats: Category[]) {
  const cat = task.category_id ? cats.find(c => c.id === task.category_id) : null
  const parent = cat?.parent_id ? cats.find(c => c.id === cat.parent_id) : null
  return (parent ?? cat)?.colour ?? '#6B7280'
}

function TaskChip({ task, categories, isDragging = false }: { task: Task; categories: Category[]; isDragging?: boolean }) {
  const colour = chipColour(task, categories)
  return (
    <div
      title={task.title}
      className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-xs truncate select-none
        ${task.status === 'done' ? 'opacity-50 line-through' : ''}
        ${isDragging ? 'shadow-lg rotate-1' : ''}`}
      style={{ backgroundColor: colour + '22', borderLeft: `3px solid ${colour}` }}
    >
      <span className="truncate text-gray-800">{task.title}</span>
    </div>
  )
}

function DraggableChip({ task, categories }: { task: Task; categories: Category[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: { task } })
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Translate.toString(transform), opacity: isDragging ? 0.3 : 1 }}
      {...listeners} {...attributes}>
      <Link href={`/tasks/${task.id}/edit`} onClick={e => { if (isDragging) e.preventDefault() }}>
        <TaskChip task={task} categories={categories} />
      </Link>
    </div>
  )
}

// ─── Droppable wrappers ───────────────────────────────────────────────────────

function DroppableCell({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className ?? ''} ${isOver ? 'ring-2 ring-inset ring-blue-400 bg-blue-50' : ''}`}>
      {children}
    </div>
  )
}

// ─── Month view ───────────────────────────────────────────────────────────────

function MonthView({ year, month, tasks, categories, today }: {
  year: number; month: number; tasks: Task[]; categories: Category[]; today: Date
}) {
  const cells = getMonthGrid(year, month)
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="grid grid-cols-7 border-b border-gray-100">
        {DAY_NAMES_SHORT.map(d => (
          <div key={d} className="py-2 text-center text-xs font-medium text-gray-400 border-r border-gray-100 last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 flex-1">
        {cells.map((date, i) => {
          if (!date) return <div key={`pad-${i}`} className="min-h-[90px] border-b border-r border-gray-100 bg-gray-50" />
          const ds = toDateStr(date)
          const dayTasks = tasksForDay(tasks, ds)
          const isToday = sameDay(date, today)
          const isCurrent = date.getMonth() === month
          return (
            <DroppableCell key={ds} id={ds}
              className={`min-h-[90px] p-1.5 border-b border-r border-gray-100 flex flex-col gap-0.5 ${isCurrent ? 'bg-white' : 'bg-gray-50'}`}>
              <span className={`text-xs font-medium mb-0.5 w-6 h-6 flex items-center justify-center rounded-full
                ${isToday ? 'bg-blue-600 text-white' : isCurrent ? 'text-gray-700' : 'text-gray-300'}`}>
                {date.getDate()}
              </span>
              {dayTasks.map(t => <DraggableChip key={t.id} task={t} categories={categories} />)}
            </DroppableCell>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week view ────────────────────────────────────────────────────────────────

function WeekView({ monday, tasks, categories, today }: {
  monday: Date; tasks: Task[]; categories: Category[]; today: Date
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i))

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 sticky top-0 bg-white z-10">
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div key={i} className="py-2 text-center border-r border-gray-100 last:border-r-0">
              <div className="text-xs text-gray-400">{DAY_NAMES_SHORT[i]}</div>
              <div className={`mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium
                ${isToday ? 'bg-blue-600 text-white' : 'text-gray-700'}`}>
                {d.getDate()}
              </div>
            </div>
          )
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-7">
        {days.map((d, di) => {
          const ds = toDateStr(d)
          const dayTasks = tasksForDay(tasks, ds)
          const allDay = dayTasks.filter(t => !t.horizon_time_slot)
          const timed  = dayTasks.filter(t =>  t.horizon_time_slot)

          return (
            <DroppableCell key={ds} id={ds}
              className="border-r border-gray-100 last:border-r-0 min-h-[400px] p-1.5 space-y-0.5">
              {/* All-day tasks */}
              {allDay.map(t => <DraggableChip key={t.id} task={t} categories={categories} />)}
              {/* Timed tasks (simple for now) */}
              {timed.map(t => (
                <div key={t.id} className="text-xs text-gray-500 px-1">
                  {t.horizon_time_slot?.slice(11, 16)} <DraggableChip task={t} categories={categories} />
                </div>
              ))}
            </DroppableCell>
          )
        })}
      </div>
    </div>
  )
}

// ─── Day view ─────────────────────────────────────────────────────────────────

function DayView({ date, tasks, categories, today }: {
  date: Date; tasks: Task[]; categories: Category[]; today: Date
}) {
  const ds = toDateStr(date)
  const dayTasks = tasksForDay(tasks, ds)
  const allDay = dayTasks.filter(t => !t.horizon_time_slot)

  return (
    <div className="flex-1 min-h-0 overflow-y-auto">
      {/* Date header */}
      <div className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className={`inline-flex items-center gap-2`}>
          <span className={`text-lg font-semibold ${sameDay(date, today) ? 'text-blue-600' : 'text-gray-900'}`}>
            {date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      {/* All-day area */}
      {allDay.length > 0 && (
        <DroppableCell id={ds} className="px-3 py-2 border-b border-gray-100 space-y-1 bg-gray-50">
          <p className="text-xs text-gray-400 mb-1">All day</p>
          {allDay.map(t => <DraggableChip key={t.id} task={t} categories={categories} />)}
        </DroppableCell>
      )}
      {allDay.length === 0 && (
        <DroppableCell id={ds} className="px-3 py-2 border-b border-gray-100 bg-gray-50 min-h-[40px]">
          <p className="text-xs text-gray-300 italic">Drop tasks here</p>
        </DroppableCell>
      )}

      {/* Hourly slots */}
      <div>
        {HOURS.map(h => {
          const slotId = `${ds}T${String(h).padStart(2,'0')}:00`
          const slotTasks = dayTasks.filter(t => t.horizon_time_slot?.startsWith(slotId.slice(0,13)))
          return (
            <DroppableCell key={slotId} id={slotId}
              className="flex gap-3 px-3 border-b border-gray-50 min-h-[48px] hover:bg-gray-50">
              <span className="shrink-0 w-10 pt-1.5 text-xs text-gray-300 tabular-nums">
                {String(h).padStart(2,'0')}:00
              </span>
              <div className="flex-1 pt-1.5 pb-1 space-y-0.5">
                {slotTasks.map(t => <DraggableChip key={t.id} task={t} categories={categories} />)}
              </div>
            </DroppableCell>
          )
        })}
      </div>
    </div>
  )
}

// ─── Side pane ────────────────────────────────────────────────────────────────

function SidePane({ label, tasks, categories }: { label: string; tasks: Task[]; categories: Category[] }) {
  return (
    <div className="w-56 shrink-0 border-l border-gray-100 flex flex-col">
      <div className="px-3 py-2.5 border-b border-gray-100">
        <p className="text-xs font-semibold text-gray-500">{label}</p>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {tasks.length === 0 ? (
          <p className="text-xs text-gray-300 italic px-1 py-2">Nothing here</p>
        ) : (
          tasks.map(t => <DraggableChip key={t.id} task={t} categories={categories} />)
        )}
      </div>
      <div className="px-3 py-2 border-t border-gray-100">
        <Link href="/tasks/new" className="text-xs text-blue-500 hover:text-blue-700">+ New task</Link>
      </div>
    </div>
  )
}

// ─── Navigation label ─────────────────────────────────────────────────────────

function navLabel(view: CalView, year: number, month: number, anchor: Date): string {
  if (view === 'month') return `${MONTH_NAMES[month]} ${year}`
  if (view === 'week') {
    const end = addDays(anchor, 6)
    if (anchor.getMonth() === end.getMonth())
      return `${anchor.getDate()}–${end.getDate()} ${MONTH_NAMES[anchor.getMonth()]} ${anchor.getFullYear()}`
    return `${anchor.getDate()} ${MONTH_NAMES[anchor.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]} ${anchor.getFullYear()}`
  }
  return anchor.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CalendarClient({ tasks: initialTasks, categories }: { tasks: Task[]; categories: Category[] }) {
  const router = useRouter()
  const today = new Date()

  const [view, setView]   = useState<CalView>('week')
  const [year, setYear]   = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [anchor, setAnchor] = useState<Date>(getMondayOf(today)) // week/day pivot
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  // ── Navigation ──────────────────────────────────────────────────────────────

  function navigate(dir: -1 | 1) {
    if (view === 'month') {
      const nm = month + dir
      if (nm < 0)  { setMonth(11); setYear(y => y - 1) }
      else if (nm > 11) { setMonth(0);  setYear(y => y + 1) }
      else setMonth(nm)
    } else if (view === 'week') {
      setAnchor(a => addDays(a, dir * 7))
    } else {
      setAnchor(a => addDays(a, dir))
    }
  }

  function goToday() {
    setYear(today.getFullYear()); setMonth(today.getMonth()); setAnchor(getMondayOf(today))
    if (view === 'day') setAnchor(today)
  }

  function switchView(v: CalView) {
    setView(v)
    if (v === 'day') setAnchor(today)
    else if (v === 'week') setAnchor(getMondayOf(today))
    else { setYear(today.getFullYear()); setMonth(today.getMonth()) }
  }

  // ── Drag ────────────────────────────────────────────────────────────────────

  const handleDragStart = useCallback((e: DragStartEvent) => {
    setActiveTask(tasks.find(t => t.id === e.active.id) ?? null)
  }, [tasks])

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveTask(null)
    const { active, over } = e
    if (!over) return

    const taskId = active.id as string
    const dropId = over.id as string   // either YYYY-MM-DD or YYYY-MM-DDTHH:MM
    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Parse the drop target
    const isTimedSlot = dropId.includes('T')
    const dayStr  = isTimedSlot ? dropId.split('T')[0] : dropId
    const timeStr = isTimedSlot ? dropId : null

    if (task.horizon_day === dayStr && !isTimedSlot) return // no change

    // Build full horizon fields from the new day
    const horizonFields = getHorizonFieldsForDay(dayStr)

    // Optimistic update
    setTasks(prev => prev.map(t =>
      t.id === taskId ? { ...t, ...horizonFields, horizon_time_slot: timeStr } : t
    ))

    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...horizonFields, horizon_time_slot: timeStr }),
    })
    router.refresh()
  }, [tasks, router])

  // ── Side pane content ───────────────────────────────────────────────────────

  let sidePaneLabel = 'Unplanned'
  let sidePaneTasks: Task[] = []

  if (view === 'month') {
    sidePaneLabel = 'Unplanned'
    sidePaneTasks = unplannedTasks(tasks)
  } else if (view === 'week') {
    const weekStr = toDateStr(anchor)
    sidePaneLabel = 'This week (unscheduled)'
    sidePaneTasks = [
      ...tasksForWeek(tasks, weekStr),
      ...unplannedTasks(tasks),
    ]
  } else {
    const ds = toDateStr(anchor)
    sidePaneLabel = 'Unscheduled today'
    sidePaneTasks = tasks.filter(t => t.horizon_day === ds && !t.horizon_time_slot)
      .concat(unplannedTasks(tasks))
  }

  // De-dupe
  sidePaneTasks = sidePaneTasks.filter((t, i, arr) => arr.findIndex(x => x.id === t.id) === i)

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)]">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}
            className="rounded-md p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none">‹</button>
          <button onClick={() => navigate(1)}
            className="rounded-md p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-lg leading-none">›</button>
          <button onClick={goToday}
            className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            Today
          </button>
          <h2 className="ml-2 text-sm font-semibold text-gray-900 w-52">
            {navLabel(view, year, month, anchor)}
          </h2>
        </div>

        {/* View switcher */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-medium">
          {(['month','week','day'] as CalView[]).map(v => (
            <button key={v} onClick={() => switchView(v)}
              className={`px-3 py-1.5 capitalize transition-colors ${
                view === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}>
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar + side pane */}
      <div className="flex flex-1 min-h-0 rounded-xl border border-gray-200 bg-white overflow-hidden">
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex-1 min-w-0 flex flex-col">
            {view === 'month' && (
              <MonthView year={year} month={month} tasks={tasks} categories={categories} today={today} />
            )}
            {view === 'week' && (
              <WeekView monday={anchor} tasks={tasks} categories={categories} today={today} />
            )}
            {view === 'day' && (
              <DayView date={anchor} tasks={tasks} categories={categories} today={today} />
            )}
          </div>

          <SidePane label={sidePaneLabel} tasks={sidePaneTasks} categories={categories} />

          <DragOverlay>
            {activeTask && <TaskChip task={activeTask} categories={categories} isDragging />}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  )
}
