import { createClient } from '@/lib/supabase-server'
import CalendarClient from '@/components/calendar/CalendarClient'
import type { Task, Category } from '@/types'

export const metadata = { title: 'Calendar — Clarity' }

export default async function CalendarPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: taskData }, { data: categoryData }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('created_by', user!.id)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true }),
    supabase
      .from('categories')
      .select('*')
      .eq('owner_id', user!.id)
      .order('sort_order', { ascending: true }),
  ])

  const tasks = (taskData ?? []) as Task[]
  const categories = (categoryData ?? []) as Category[]

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          Tasks with a due date. Drag to reschedule.
        </p>
      </div>
      <CalendarClient tasks={tasks} categories={categories} />
    </div>
  )
}
