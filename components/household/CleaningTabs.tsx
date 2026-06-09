'use client'

import { useState } from 'react'
import type { Room, Task, Category } from '@/types'
import CleaningView from './CleaningView'
import CleaningScheduleView from './CleaningScheduleView'

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
  workspaceId: string
  rooms: Room[]
  tasks: Task[]
  categories: Category[]
  members: Member[]
  childProfiles: ChildProfile[]
  canManage: boolean
  today: string
}

type Tab = 'rooms' | 'schedule'

export default function CleaningTabs(props: Props) {
  const [tab, setTab] = useState<Tab>('rooms')

  return (
    <div>
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {([['rooms', 'By room'], ['schedule', 'Schedule']] as [Tab, string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'rooms' ? (
        <CleaningView
          workspaceId={props.workspaceId}
          rooms={props.rooms}
          tasks={props.tasks}
          categories={props.categories}
          members={props.members}
          childProfiles={props.childProfiles}
          canManage={props.canManage}
        />
      ) : (
        <CleaningScheduleView
          rooms={props.rooms}
          tasks={props.tasks}
          today={props.today}
        />
      )}
    </div>
  )
}
