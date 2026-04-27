import { createClient } from '@/lib/supabase-server'
import CalendarClient from '@/components/calendar/CalendarClient'
import type { Task, Category } from '@/types'

export const metadata = { title: 'Calendar — Clarity' }

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch ALL tasks for the calendar — placed tasks (horizon_day set)
  // plus unplanned/horizon tasks for the side pane.
  const [{ data: taskData }, { data: categoryData }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('created_by', user!.id)
      .in('status', ['not_started', 'wip'])
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('*')
      .eq('owner_id', user!.id)
      .order('sort_order', { ascending: true }),
  ])

  const tasks = (taskData ?? []) as Task[]
  const categories = (categoryData ?? []) as Category[]

  return <CalendarClient tasks={tasks} categories={categories} />
}
