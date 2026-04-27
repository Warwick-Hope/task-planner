'use client'

import { useState, useCallback } from 'react'
import type { Task, Category } from '@/types'
import TaskRow from './TaskRow'
import TaskPreviewPanel from './TaskPreviewPanel'

export default function TaskListClient({
  tasks,
  categories,
}: {
  tasks: Task[]
  categories: Category[]
}) {
  const [preview, setPreview] = useState<Task | null>(null)
  const close = useCallback(() => setPreview(null), [])

  return (
    <>
      {tasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          allCategories={categories}
          onTitleClick={() => setPreview(task)}
        />
      ))}

      {preview && (
        <TaskPreviewPanel
          task={preview}
          categories={categories}
          onClose={close}
        />
      )}
    </>
  )
}
