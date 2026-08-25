'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface PendingAssignment {
  taskId: string
  taskTitle: string
  workspaceId: string
  workspaceName: string
}

interface Props {
  initial: PendingAssignment[]
}

export default function NotificationBell({ initial }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<PendingAssignment[]>(initial)
  const [acting, setActing] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function respond(item: PendingAssignment, decision: 'accepted' | 'declined') {
    setActing(item.taskId)
    await fetch(`/api/household/${item.workspaceId}/tasks/${item.taskId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    setItems((prev) => prev.filter((i) => i.taskId !== item.taskId))
    setActing(null)
    router.refresh()
  }

  const count = items.length

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex items-center justify-center min-h-[40px] min-w-[40px] sm:min-h-0 sm:min-w-0 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        title="Notifications"
        aria-label="Notifications"
      >
        <svg className="w-5 h-5 sm:w-4 sm:h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center leading-none">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg w-[min(20rem,calc(100vw-2rem))]">
          <div className="px-4 py-2.5 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-900">Notifications</p>
          </div>

          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-gray-400 text-center">You&apos;re all caught up.</p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
              {items.map((item) => (
                <li key={item.taskId} className="px-4 py-3">
                  <p className="text-xs text-gray-400 mb-0.5">{item.workspaceName}</p>
                  <p className="text-sm font-medium text-gray-900 mb-2 truncate">
                    You&apos;ve been assigned: {item.taskTitle}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(item, 'accepted')}
                      disabled={acting === item.taskId}
                      className="flex-1 rounded bg-green-600 px-3 py-2 sm:py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {acting === item.taskId ? '…' : 'Accept'}
                    </button>
                    <button
                      onClick={() => respond(item, 'declined')}
                      disabled={acting === item.taskId}
                      className="flex-1 rounded border border-gray-300 px-3 py-2 sm:py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      Decline
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
