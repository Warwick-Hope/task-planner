import { createClient } from '@/lib/supabase-server'
import TaskForm from '@/components/tasks/TaskForm'

export const metadata = { title: 'New task — Clarity' }

export default async function NewTaskPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('owner_id', user!.id)
    .order('sort_order', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">New task</h1>
      </div>
      <TaskForm categories={categories ?? []} />
    </div>
  )
}
