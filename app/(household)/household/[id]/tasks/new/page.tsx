import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import TaskForm from '@/components/tasks/TaskForm'

export const metadata = { title: 'New household task — Clarity' }

export default async function NewHouseholdTaskPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!membership || membership.role === 'restricted') redirect(`/household/${params.id}/tasks`)

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', params.id)
    .single()

  const { data: categories } = await supabase
    .from('categories')
    .select('*')
    .eq('workspace_id', params.id)
    .is('owner_id', null)
    .order('sort_order', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <Link
          href={`/household/${params.id}/tasks`}
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← {workspace?.name ?? 'Household'} tasks
        </Link>
        <h1 className="text-xl font-semibold text-gray-900 mt-1">New household task</h1>
      </div>
      <TaskForm
        categories={categories ?? []}
        submitUrl={`/api/household/${params.id}/tasks`}
        redirectTo={`/household/${params.id}/tasks`}
      />
    </div>
  )
}
