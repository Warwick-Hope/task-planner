'use client'

import { useState, useRef, useEffect } from 'react'
import type { AssignmentStatus } from '@/types'

interface Member {
  id: string        // workspace_members.id
  userId: string
  displayName: string
}

interface ChildProfile {
  id: string
  name: string
  avatarColour: string
}

interface Props {
  taskId: string
  workspaceId: string
  currentUserId: string
  assignedToUserId: string | null
  assignedToProfileId: string | null
  assignmentStatus: AssignmentStatus
  members: Member[]
  childProfiles: ChildProfile[]
  onUpdated?: (patch: {
    assigned_to_user_id: string | null
    assigned_to_profile_id: string | null
    assignment_status: AssignmentStatus
  }) => void
}

const STATUS_LABEL: Record<AssignmentStatus, string> = {
  none: '',
  pending: ' (pending)',
  accepted: '',
  declined: ' (declined)',
}

export default function AssignButton({
  taskId,
  workspaceId,
  currentUserId,
  assignedToUserId,
  assignedToProfileId,
  assignmentStatus,
  members,
  childProfiles,
  onUpdated,
}: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function assign(type: 'member' | 'profile' | 'unassign', assignTo?: string) {
    setLoading(true)
    setOpen(false)
    const res = await fetch(`/api/household/${workspaceId}/tasks/${taskId}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, assignTo }),
    })
    setLoading(false)
    if (!res.ok) return
    const json = await res.json()
    if (type === 'unassign') {
      onUpdated?.({ assigned_to_user_id: null, assigned_to_profile_id: null, assignment_status: 'none' })
    } else if (type === 'member') {
      onUpdated?.({ assigned_to_user_id: assignTo!, assigned_to_profile_id: null, assignment_status: json.assignmentStatus })
    } else {
      onUpdated?.({ assigned_to_user_id: null, assigned_to_profile_id: assignTo!, assignment_status: 'accepted' })
    }
  }

  const assignedMember = assignedToUserId
    ? members.find((m) => m.userId === assignedToUserId)
    : null
  const assignedProfile = assignedToProfileId
    ? childProfiles.find((p) => p.id === assignedToProfileId)
    : null

  const label = assignedMember
    ? `${assignedMember.displayName}${STATUS_LABEL[assignmentStatus]}`
    : assignedProfile
    ? assignedProfile.name
    : 'Assign'

  const isPending = assignmentStatus === 'pending' && assignedToUserId === currentUserId

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={loading}
        className={`text-xs px-2 py-1 min-h-[32px] sm:min-h-0 max-w-[6rem] sm:max-w-none truncate rounded-md border transition-colors ${
          assignedMember || assignedProfile
            ? assignmentStatus === 'declined'
              ? 'border-red-200 text-red-500 bg-red-50 hover:bg-red-100'
              : assignmentStatus === 'pending'
              ? 'border-amber-200 text-amber-600 bg-amber-50 hover:bg-amber-100'
              : 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'
            : 'border-gray-200 text-gray-400 bg-white hover:bg-gray-50'
        }`}
      >
        {loading ? '…' : label}
      </button>

      {isPending && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg p-3 w-48 space-y-2">
          <p className="text-xs text-gray-500">You&apos;ve been assigned this task</p>
          <div className="flex gap-2">
            <button
              onClick={() => assign('member', currentUserId)}
              className="flex-1 rounded bg-green-600 px-2 py-2 sm:py-1 text-xs font-medium text-white hover:bg-green-700"
            >
              Accept
            </button>
            <button
              onClick={async () => {
                setLoading(true)
                setOpen(false)
                await fetch(`/api/household/${workspaceId}/tasks/${taskId}/respond`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ decision: 'declined' }),
                })
                setLoading(false)
                onUpdated?.({ assigned_to_user_id: assignedToUserId, assigned_to_profile_id: null, assignment_status: 'declined' })
              }}
              className="flex-1 rounded border border-gray-300 px-2 py-2 sm:py-1 text-xs text-gray-600 hover:bg-gray-50"
            >
              Decline
            </button>
          </div>
        </div>
      )}

      {open && !isPending && (
        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-48 max-h-64 overflow-y-auto">
          {members.length > 0 && (
            <>
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">Members</p>
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => assign('member', m.userId)}
                  className={`w-full text-left px-3 py-2.5 sm:py-1.5 text-sm hover:bg-gray-50 transition-colors ${
                    assignedToUserId === m.userId ? 'font-medium text-blue-600' : 'text-gray-700'
                  }`}
                >
                  {m.displayName}
                  {m.userId === currentUserId && <span className="text-gray-400 text-xs"> (you)</span>}
                </button>
              ))}
            </>
          )}
          {childProfiles.length > 0 && (
            <>
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wide mt-1">Children</p>
              {childProfiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => assign('profile', p.id)}
                  className={`w-full text-left px-3 py-2.5 sm:py-1.5 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                    assignedToProfileId === p.id ? 'font-medium text-blue-600' : 'text-gray-700'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs"
                    style={{ backgroundColor: p.avatarColour }}
                  >
                    {p.name.charAt(0)}
                  </span>
                  {p.name}
                </button>
              ))}
            </>
          )}
          {(assignedToUserId || assignedToProfileId) && (
            <>
              <div className="border-t border-gray-100 mt-1" />
              <button
                onClick={() => assign('unassign')}
                className="w-full text-left px-3 py-2.5 sm:py-1.5 text-sm text-gray-400 hover:bg-gray-50 hover:text-red-500 transition-colors"
              >
                Unassign
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
