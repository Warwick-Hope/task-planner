import { createClient } from '@/lib/supabase-server'
import NonNegotiablesWidget from './NonNegotiablesWidget'
import type { Task, NonNegotiableWithTask } from '@/types'

export default async function NonNegotiablesPanel({
  userId,
  today,
}: {
  userId: string
  today: string // YYYY-MM-DD
}) {
  const supabase = createClient()

  const [{ data: nnData }, { data: taskData }] = await Promise.all([
    supabase
      .from('non_negotiables')
      .select('*, task:tasks(*)')
      .eq('user_id', userId)
      .eq('date', today)
      .order('sort_order', { ascending: true }),
    supabase
      .from('tasks')
      .select('*')
      .eq('created_by', userId)
      .in('status', ['not_started', 'wip'])
      .order('created_at', { ascending: false }),
  ])

  const items = (nnData ?? []) as NonNegotiableWithTask[]
  const availableTasks = (taskData ?? []) as Task[]

  return (
    <NonNegotiablesWidget
      date={today}
      initialItems={items}
      availableTasks={availableTasks}
    />
  )
}
