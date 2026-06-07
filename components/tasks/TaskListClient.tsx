'use client'

import type { Task, Category } from '@/types'
import TaskRow from './TaskRow'

export default function TaskListClient({
  tasks,
  categories,
}: {
  tasks: Task[]
  categories: Category[]
}) {
  return (
    <>
      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          allCategories={categories}
        />
      ))}
    </>
  )
}
