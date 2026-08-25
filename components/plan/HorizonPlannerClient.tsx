'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  DndContext,
  DragEndEvent,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core'
import { useDragSensors } from '@/lib/dnd-sensors'
import Link from 'next/link'
import type { Task, Category } from '@/types'
import {
  buildHorizonFields,
  getMondayOfWeek,
  monthFromDate,
  monthToQuarter,
} from '@/lib/horizon'

// ─── helpers ─────────────────────────────────────────────────────────────────

const MONTH_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December']

function getQuarterMonths(q: number): number[] {
  return [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3]
}

function getWeeksInMonth(year: number, month: number): string[] {
  const lastDay    = new Date(year, month, 0)
  const firstDay   = new Date(year, month - 1, 1)
  const firstMonday = getMondayOfWeek(firstDay.toISOString().split('T')[0])
  const weeks: string[] = []
  const cur = new Date(firstMonday + 'T12:00:00')
  while (cur <= lastDay) {
    weeks.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 7)
  }
  return weeks
}

function getDaysInWeek(weekStr: string): string[] {
  const days: string[] = []
  const monday = new Date(weekStr + 'T12:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    days.push(d.toISOString().split('T')[0])
  }
  return days
}

function formatWeekLabel(weekStr: string): string {
  const d = new Date(weekStr + 'T12:00:00')
  return `w/c ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
}

function formatDayLabel(dayStr: string): string {
  const d = new Date(dayStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function categoryColour(categoryId: string | null, categories: Category[]): string {
  if (!categoryId) return '#9ca3af'
  return categories.find(c => c.id === categoryId)?.colour ?? '#9ca3af'
}

// ─── DraggableTaskChip ────────────────────────────────────────────────────────

function DraggableTaskChip({ task, categories }: { task: Task; categories: Category[] }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id })
  const colour = categoryColour(task.category_id, categories)
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-1.5 px-2 py-2.5 sm:py-1.5 rounded-md bg-white border border-gray-200 text-xs cursor-grab select-none shadow-sm transition-opacity ${
        isDragging ? 'opacity-40' : 'hover:border-gray-300 hover:shadow'
      }`}
    >
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colour }} />
      <span className="truncate text-gray-700">{task.title}</span>
    </div>
  )
}

// ─── DroppableBucket ──────────────────────────────────────────────────────────

function DroppableBucket({
  id,
  label,
  sublabel,
  tasks,
  categories,
  onOpen,
  calendarHref,
}: {
  id: string
  label: string
  sublabel?: string
  tasks: Task[]
  categories: Category[]
  onOpen?: () => void
  calendarHref?: string
}) {
  const { setNodeRef, isOver } = useDroppable({ id })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border-2 transition-colors min-h-28 ${
        isOver ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`px-3 py-2 border-b flex items-center justify-between ${
          isOver ? 'border-blue-200' : 'border-gray-100'
        }`}
      >
        <div>
          <div className="text-sm font-semibold text-gray-900">{label}</div>
          {sublabel && <div className="text-xs text-gray-400">{sublabel}</div>}
        </div>
        {onOpen && (
          <button
            onClick={onOpen}
            className="shrink-0 -my-2 py-2 pl-3 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Open →
          </button>
        )}
        {calendarHref && (
          <Link
            href={calendarHref}
            className="shrink-0 -my-2 py-2 pl-3 text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            Calendar →
          </Link>
        )}
      </div>

      <div className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto max-h-48">
        {tasks.length === 0 ? (
          <p className="text-xs text-gray-300 text-center py-4">Drop tasks here</p>
        ) : (
          tasks.map(t => {
            const colour = categoryColour(t.category_id, categories)
            return (
              <div
                key={t.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-gray-50 text-xs text-gray-600"
              >
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colour }} />
                <span className="truncate">{t.title}</span>
              </div>
            )
          })
        )}
      </div>

      <div
        className={`px-3 py-1 border-t text-xs text-gray-400 ${
          isOver ? 'border-blue-200' : 'border-gray-100'
        }`}
      >
        {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}
      </div>
    </div>
  )
}

// ─── Sidebar panel ────────────────────────────────────────────────────────────

function SidebarSection({
  title,
  subtitle,
  tasks,
  categories,
  emptyMessage,
  accent,
}: {
  title: string
  subtitle: string
  tasks: Task[]
  categories: Category[]
  emptyMessage: string
  accent: 'amber' | 'gray'
}) {
  const border  = accent === 'amber' ? 'border-amber-200'   : 'border-gray-200'
  const bg      = accent === 'amber' ? 'bg-amber-50'        : 'bg-gray-50'
  const divider = accent === 'amber' ? 'border-amber-100'   : 'border-gray-100'
  const titleCl = accent === 'amber' ? 'text-amber-900'     : 'text-gray-700'
  const subCl   = accent === 'amber' ? 'text-amber-600'     : 'text-gray-400'
  const emptyCl = accent === 'amber' ? 'text-amber-300'     : 'text-gray-300'

  return (
    <div className={`rounded-xl border overflow-hidden ${border} ${bg}`}>
      <div className={`px-3 py-2 border-b ${divider}`}>
        <div className={`text-sm font-medium ${titleCl}`}>{title}</div>
        <div className={`text-xs ${subCl}`}>{subtitle}</div>
      </div>
      <div className="p-2 flex flex-col gap-1 max-h-44 lg:max-h-64 overflow-y-auto">
        {tasks.length === 0 ? (
          <p className={`text-xs text-center py-3 ${emptyCl}`}>{emptyMessage}</p>
        ) : (
          tasks.map(t => <DraggableTaskChip key={t.id} task={t} categories={categories} />)
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type ViewType = 'year' | 'quarter' | 'month' | 'week'

interface PlanState {
  view: ViewType
  year: number
  q?: number
  month?: number
  week?: string
}

export default function HorizonPlannerClient({
  tasks: initialTasks,
  categories,
}: {
  tasks: Task[]
  categories: Category[]
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [tasks, setTasks] = useState(initialTasks)
  const sensors = useDragSensors()

  // Parse view state from URL params
  const state: PlanState = {
    view:  (searchParams.get('view') ?? 'year') as ViewType,
    year:  parseInt(searchParams.get('year')  ?? String(new Date().getFullYear())),
    q:     searchParams.get('q')     ? parseInt(searchParams.get('q')!)     : undefined,
    month: searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined,
    week:  searchParams.get('week')  ?? undefined,
  }

  function nav(next: PlanState) {
    const p = new URLSearchParams()
    p.set('view', next.view)
    p.set('year', String(next.year))
    if (next.q     != null) p.set('q',     String(next.q))
    if (next.month != null) p.set('month', String(next.month))
    if (next.week)          p.set('week',  next.week)
    router.push(`/plan?${p.toString()}`)
  }

  // ── drag end ──────────────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over) return
    const taskId   = active.id as string
    const bucketId = over.id   as string
    const task     = tasks.find(t => t.id === taskId)
    if (!task) return

    // Bucket IDs: "bucket:quarter:2", "bucket:month:4", "bucket:week:2026-04-07", "bucket:day:2026-04-07"
    const [prefix, type, ...rest] = bucketId.split(':')
    if (prefix !== 'bucket') return
    const val = rest.join(':')
    const { year } = state

    let newFields
    if (type === 'quarter') {
      newFields = buildHorizonFields('quarter', { year, quarter: parseInt(val) as 1|2|3|4 })
    } else if (type === 'month') {
      newFields = buildHorizonFields('month', { year, month: parseInt(val) })
    } else if (type === 'week') {
      newFields = buildHorizonFields('week', { weekStr: val })
    } else if (type === 'day') {
      newFields = buildHorizonFields('day', { dayStr: val })
    } else {
      return
    }

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...newFields } : t))

    await fetch(`/api/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFields),
    })
  }

  // ── sidebar tasks ─────────────────────────────────────────────────────────

  const { view, year, q, month, week } = state

  const needsPlanning: Task[] = (() => {
    if (view === 'year')                       return tasks.filter(t => t.horizon_year === year && t.horizon_quarter == null)
    if (view === 'quarter' && q != null)       return tasks.filter(t => t.horizon_year === year && t.horizon_quarter === q && t.horizon_month == null)
    if (view === 'month'   && month != null)   return tasks.filter(t => t.horizon_year === year && t.horizon_month === month && t.horizon_week == null)
    if (view === 'week'    && week)            return tasks.filter(t => t.horizon_week === week && t.horizon_day == null)
    return []
  })()

  const unplanned = tasks.filter(t => t.horizon_year == null)

  // ── breadcrumbs ───────────────────────────────────────────────────────────

  // Derive q from month/week when not explicit
  const resolvedQ = q ?? (month ? monthToQuarter(month) : (week ? monthToQuarter(monthFromDate(week)) : undefined))
  const resolvedMonth = month ?? (week ? monthFromDate(week) : undefined)

  const crumbs: { label: string; onClick?: () => void }[] = [
    {
      label: String(year),
      onClick: view !== 'year' ? () => nav({ view: 'year', year }) : undefined,
    },
  ]
  if (view === 'quarter' || view === 'month' || view === 'week') {
    if (resolvedQ != null) {
      crumbs.push({
        label: `Q${resolvedQ}`,
        onClick: view !== 'quarter' ? () => nav({ view: 'quarter', year, q: resolvedQ }) : undefined,
      })
    }
  }
  if (view === 'month' || view === 'week') {
    if (resolvedMonth != null) {
      crumbs.push({
        label: MONTH_FULL[resolvedMonth - 1],
        onClick: view !== 'month' ? () => nav({ view: 'month', year, q: resolvedQ, month: resolvedMonth }) : undefined,
      })
    }
  }
  if (view === 'week' && week) {
    crumbs.push({ label: formatWeekLabel(week) })
  }

  // ── needs-planning subtitle ───────────────────────────────────────────────

  const needsPlanningSubtitle = {
    year:    'Assigned to this year — no quarter set',
    quarter: 'Assigned to this quarter — no month set',
    month:   'Assigned to this month — no week set',
    week:    'Assigned to this week — no day set',
  }[view]

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-gray-900">Horizon Planner</h1>
            <nav className="flex flex-wrap items-center gap-1 mt-1" aria-label="breadcrumb">
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  {i > 0 && <span className="text-gray-300 text-sm">/</span>}
                  {c.onClick ? (
                    <button
                      onClick={c.onClick}
                      className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {c.label}
                    </button>
                  ) : (
                    <span className="text-sm text-gray-500">{c.label}</span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          {/* Year navigator */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <button
              onClick={() => nav({ ...state, year: year - 1 })}
              aria-label="Previous year"
              className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 text-sm transition-colors"
            >
              ←
            </button>
            <span className="text-sm font-medium text-gray-700 w-10 text-center">{year}</span>
            <button
              onClick={() => nav({ ...state, year: year + 1 })}
              aria-label="Next year"
              className="w-10 h-10 sm:w-7 sm:h-7 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:text-gray-900 hover:border-gray-300 text-sm transition-colors"
            >
              →
            </button>
          </div>
        </div>

        {/* Main layout: buckets + sidebar.
            Below lg the sidebar cannot sit beside 240px of buckets, so it stacks
            — column-reverse, which puts the list you drag *from* above the
            buckets you drag *into* rather than off the bottom of the screen. */}
        <div className="flex flex-col-reverse lg:flex-row gap-4 items-stretch lg:items-start">
          {/* Buckets */}
          <div className="flex-1 min-w-0">
            {view === 'year' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {([1, 2, 3, 4] as const).map(qn => (
                  <DroppableBucket
                    key={qn}
                    id={`bucket:quarter:${qn}`}
                    label={`Q${qn}`}
                    sublabel={`${MONTH_SHORT[(qn-1)*3]}–${MONTH_SHORT[(qn-1)*3+2]}`}
                    tasks={tasks.filter(t => t.horizon_year === year && t.horizon_quarter === qn)}
                    categories={categories}
                    onOpen={() => nav({ view: 'quarter', year, q: qn })}
                  />
                ))}
              </div>
            )}

            {view === 'quarter' && q != null && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {getQuarterMonths(q).map(mn => (
                  <DroppableBucket
                    key={mn}
                    id={`bucket:month:${mn}`}
                    label={MONTH_FULL[mn - 1]}
                    tasks={tasks.filter(t => t.horizon_year === year && t.horizon_month === mn)}
                    categories={categories}
                    onOpen={() => nav({ view: 'month', year, q, month: mn })}
                  />
                ))}
              </div>
            )}

            {view === 'month' && month != null && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {getWeeksInMonth(year, month).map(ws => (
                  <DroppableBucket
                    key={ws}
                    id={`bucket:week:${ws}`}
                    label={formatWeekLabel(ws)}
                    tasks={tasks.filter(t => t.horizon_week === ws)}
                    categories={categories}
                    onOpen={() => nav({ view: 'week', year, q, month, week: ws })}
                  />
                ))}
              </div>
            )}

            {view === 'week' && week && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {getDaysInWeek(week).map(ds => (
                  <DroppableBucket
                    key={ds}
                    id={`bucket:day:${ds}`}
                    label={formatDayLabel(ds)}
                    tasks={tasks.filter(t => t.horizon_day === ds)}
                    categories={categories}
                    calendarHref={`/calendar?date=${ds}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full lg:w-60 shrink-0 flex flex-col gap-3">
            <SidebarSection
              title="Needs planning"
              subtitle={needsPlanningSubtitle}
              tasks={needsPlanning}
              categories={categories}
              emptyMessage="All tasks planned at this level ✓"
              accent="amber"
            />
            <SidebarSection
              title="Unplanned"
              subtitle="No horizon set — drag to schedule"
              tasks={unplanned}
              categories={categories}
              emptyMessage="All tasks have a horizon"
              accent="gray"
            />
          </div>
        </div>
      </div>
    </DndContext>
  )
}
