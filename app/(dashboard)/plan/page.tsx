import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import HorizonPlannerClient from '@/components/plan/HorizonPlannerClient'
import type { Task, Category } from '@/types'

export const metadata = { title: 'Plan — Clarity' }

export default async function PlanPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: taskData }, { data: categoryData }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('created_by', user.id)
      .in('status', ['not_started', 'wip'])
      .is('parent_task_id', null)
      .order('created_at', { ascending: false }),
    supabase
      .from('categories')
      .select('*')
      .eq('owner_id', user.id)
      .order('sort_order', { ascending: true }),
  ])

  return (
    <HorizonPlannerClient
      tasks={(taskData ?? []) as Task[]}
      categories={(categoryData ?? []) as Category[]}
    />
  )
}
