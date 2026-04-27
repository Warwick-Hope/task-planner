import { createClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import TaskForm from '@/components/tasks/TaskForm'
import type { Task, Category } from '@/types'

export const metadata = { title: 'Edit task — Clarity' }

export default async function EditTaskPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: taskData }, { data: categoriesData }] = await Promise.all([
    supabase
      .from('tasks')
      .select('*')
      .eq('id', params.id)
      .eq('created_by', user!.id)
      .single(),
    supabase
      .from('categories')
      .select('*')
      .eq('owner_id', user!.id)
      .order('sort_order', { ascending: true }),
  ])

  if (!taskData) notFound()

  const task = taskData as Task
  const categories = (categoriesData ?? []) as Category[]

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/tasks"
          className="text-sm text-gray-400 hover:text-gray-700 transition-colors"
        >
          ← Tasks
        </Link>
        <span className="text-gray-200">/</span>
        <h1 className="text-xl font-semibold text-gray-900">Edit task</h1>
      </div>
      <TaskForm categories={categories} task={task} />
    </div>
  )
}
