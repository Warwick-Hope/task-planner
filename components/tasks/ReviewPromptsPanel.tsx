import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { getHorizonReviewStatus, formatHorizon } from '@/lib/horizon'
import type { Task, Category } from '@/types'

/**
 * Shows tasks whose horizon period is approaching or already overdue —
 * prompting the user to pin them to a specific date or push them out.
 *
 * Queries independently of any active filters so nothing slips through.
 */
export default async function ReviewPromptsPanel({
  userId,
  categories,
}: {
  userId: string
  categories: Category[]
}) {
  const supabase = createClient()

  const { data } = await supabase
    .from('tasks')
    .select('*')
    .eq('created_by', userId)
    .in('status', ['not_started', 'wip'])
    .not('horizon_year', 'is', null) // must have some horizon set
    .is('horizon_day', null)         // but not already pinned to a day
    .is('horizon_time_slot', null)

  const tasks = (data ?? []) as Task[]
  const today = new Date()

  const flagged = tasks
    .map(t => ({ task: t, status: getHorizonReviewStatus(t, today) }))
    .filter((x): x is { task: Task; status: 'approaching' | 'overdue' } => !!x.status)

  if (flagged.length === 0) return null

  const overdue    = flagged.filter(x => x.status === 'overdue')
  const approaching = flagged.filter(x => x.status === 'approaching')

  function categoryName(task: Task) {
    if (!task.category_id) return null
    const cat = categories.find(c => c.id === task.category_id)
    if (!cat) return null
    const parent = cat.parent_id ? categories.find(c => c.id === cat.parent_id) : null
    return parent ? `${parent.name} / ${cat.name}` : cat.name
  }

  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="px-4 py-3 border-b border-amber-200 flex items-center gap-2">
        <span className="text-sm font-semibold text-amber-800">Needs attention</span>
        <span className="text-xs text-amber-600">
          {flagged.length} {flagged.length === 1 ? 'task needs' : 'tasks need'} a specific date
        </span>
      </div>

      <div className="divide-y divide-amber-100">
        {overdue.map(({ task }) => (
          <ReviewRow
            key={task.id}
            task={task}
            label={`Overdue — was due ${formatHorizon(task)}`}
            labelClass="text-red-600"
            categoryName={categoryName(task)}
          />
        ))}
        {approaching.map(({ task }) => (
          <ReviewRow
            key={task.id}
            task={task}
            label={`Approaching — ${formatHorizon(task)}`}
            labelClass="text-amber-700"
            categoryName={categoryName(task)}
          />
        ))}
      </div>
    </div>
  )
}

function ReviewRow({
  task,
  label,
  labelClass,
  categoryName,
}: {
  task: Task
  label: string
  labelClass: string
  categoryName: string | null
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-900 truncate">{task.title}</p>
        <p className={`text-xs mt-0.5 ${labelClass}`}>{label}</p>
      </div>
      {categoryName && (
        <span className="hidden sm:inline text-xs text-gray-400 shrink-0">{categoryName}</span>
      )}
      <Link
        href={`/tasks/${task.id}/edit`}
        className="shrink-0 rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50 transition-colors"
      >
        Set date
      </Link>
    </div>
  )
}
