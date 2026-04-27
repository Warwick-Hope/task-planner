import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { Suspense } from 'react'
import NonNegotiablesPanel from '@/components/tasks/NonNegotiablesPanel'
import ReviewPromptsPanel from '@/components/tasks/ReviewPromptsPanel'
import DashboardTaskRow from '@/components/dashboard/DashboardTaskRow'
import type { Task, Category } from '@/types'

export const metadata = { title: 'Dashboard — Clarity' }

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatDayHeading(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const today = new Date().toISOString().split('T')[0]

  // Next 6 days for "upcoming" window
  const in6Days = new Date()
  in6Days.setDate(in6Days.getDate() + 6)
  const in6DaysStr = in6Days.toISOString().split('T')[0]

  const [
    { data: profileData },
    { data: categoryData },
    { data: todayData },
    { data: upcomingData },
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user!.id)
      .single(),
    supabase
      .from('categories')
      .select('*')
      .eq('owner_id', user!.id)
      .order('sort_order', { ascending: true }),
    // Today's tasks: horizon_day = today OR due_date = today
    supabase
      .from('tasks')
      .select('*')
      .eq('created_by', user!.id)
      .in('status', ['not_started', 'wip'])
      .or(`horizon_day.eq.${today},due_date.eq.${today}`)
      .order('created_at', { ascending: true }),
    // Upcoming: due_date in next 6 days (not today)
    supabase
      .from('tasks')
      .select('*')
      .eq('created_by', user!.id)
      .in('status', ['not_started', 'wip'])
      .gt('due_date', today)
      .lte('due_date', in6DaysStr)
      .order('due_date', { ascending: true }),
  ])

  const displayName  = (profileData as { display_name: string } | null)?.display_name ?? 'there'
  const categories   = (categoryData ?? []) as Category[]
  const todayTasks   = (todayData ?? []) as Task[]
  const upcomingTasks = (upcomingData ?? []) as Task[]

  // Group upcoming by due_date
  const upcomingByDate = upcomingTasks.reduce<Record<string, Task[]>>((acc, t) => {
    const d = t.due_date!
    acc[d] = [...(acc[d] ?? []), t]
    return acc
  }, {})
  const upcomingDates = Object.keys(upcomingByDate).sort()

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            {greeting()}, {displayName}
          </h1>
          <p className="mt-0.5 text-sm text-gray-400">{todayFormatted}</p>
        </div>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + New task
        </Link>
      </div>

      {/* ── Today's focus (non-negotiables) ── */}
      <Suspense fallback={null}>
        <NonNegotiablesPanel userId={user!.id} today={today} />
      </Suspense>

      {/* ── Today's tasks ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Today
        </h2>
        {todayTasks.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center">
            <p className="text-sm text-gray-400">Nothing scheduled for today.</p>
            <Link href="/tasks/new" className="mt-1.5 inline-block text-xs text-blue-500 hover:underline">
              Add a task
            </Link>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            {todayTasks.map(task => (
              <DashboardTaskRow key={task.id} task={task} categories={categories} />
            ))}
          </div>
        )}
      </section>

      {/* ── Upcoming ── */}
      {upcomingDates.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Upcoming
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden divide-y divide-gray-100">
            {upcomingDates.map(date => (
              <div key={date}>
                <div className="px-4 py-2 bg-gray-50">
                  <span className="text-xs font-medium text-gray-500">
                    {formatDayHeading(date)}
                  </span>
                </div>
                {upcomingByDate[date].map(task => (
                  <DashboardTaskRow key={task.id} task={task} categories={categories} />
                ))}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Needs attention ── */}
      <Suspense fallback={null}>
        <ReviewPromptsPanel userId={user!.id} categories={categories} />
      </Suspense>

      {/* ── Quick links ── */}
      <section>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
          Quick access
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { href: '/brain-dump', label: 'Brain dump',  desc: 'Capture thoughts', icon: '💭' },
            { href: '/calendar',   label: 'Calendar',    desc: 'View by date',     icon: '📅' },
            { href: '/tasks',      label: 'All tasks',   desc: 'Full task list',   icon: '✓' },
            { href: '/mission',    label: 'Mission',     desc: 'Values & purpose', icon: '🧭' },
          ].map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-200 hover:bg-blue-50 transition-colors group"
            >
              <div className="text-xl mb-1">{link.icon}</div>
              <p className="text-sm font-medium text-gray-900 group-hover:text-blue-700">{link.label}</p>
              <p className="text-xs text-gray-400">{link.desc}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
