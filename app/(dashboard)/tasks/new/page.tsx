import { createClient } from '@/lib/supabase-server'
import TaskForm from '@/components/tasks/TaskForm'

export const metadata = { title: 'New task — Task Planner' }

export default async function NewTaskPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: roles } = await supabase
    .from('role_categories')
    .select('id, name, colour, parent_id, sort_order')
    .eq('user_id', user!.id)
    .order('sort_order', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">New task</h1>
      </div>
      <TaskForm roles={roles ?? []} />
    </div>
  )
}
