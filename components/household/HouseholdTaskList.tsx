'use client'

import type { Task, Category } from '@/types'
import HouseholdTaskRow from './HouseholdTaskRow'

interface Member {
  id: string
  userId: string
  displayName: string
}

interface ChildProfile {
  id: string
  name: string
  avatarColour: string
}

interface Props {
  tasks: Task[]
  categories: Category[]
  workspaceId: string
  currentUserId: string
  members: Member[]
  childProfiles: ChildProfile[]
}

export default function HouseholdTaskList({
  tasks,
  categories,
  workspaceId,
  currentUserId,
  members,
  childProfiles,
}: Props) {
  return (
    <>
      {tasks.map((task) => (
        <HouseholdTaskRow
          key={task.id}
          task={task}
          allCategories={categories}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          members={members}
          childProfiles={childProfiles}
        />
      ))}
    </>
  )
}
