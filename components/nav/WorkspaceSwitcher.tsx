'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

interface Workspace {
  id: string
  name: string
  type: 'personal' | 'household'
  href: string
}

interface Props {
  /** Hint from server — used as fallback if pathname doesn't match any workspace */
  current: Workspace
  all: Workspace[]
}

export default function WorkspaceSwitcher({ current: currentHint, all }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Derive active workspace from pathname so both layouts work correctly
  const current =
    all.find((w) => w.type === 'household' && pathname.startsWith(`/household/${w.id}`)) ??
    all.find((w) => w.type === 'personal') ??
    currentHint

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const others = all.filter((w) => w.id !== current.id)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            current.type === 'household' ? 'bg-green-500' : 'bg-blue-500'
          }`}
        />
        <span className="max-w-[140px] truncate">{current.name}</span>
        <svg className="w-3 h-3 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 z-30 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[180px]">
          {/* Current workspace (non-clickable) */}
          <div className="px-3 py-2 flex items-center gap-2 bg-gray-50">
            <span
              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                current.type === 'household' ? 'bg-green-500' : 'bg-blue-500'
              }`}
            />
            <span className="text-sm font-medium text-gray-900 truncate">{current.name}</span>
            <span className="ml-auto text-xs text-gray-400">current</span>
          </div>

          {others.length > 0 && (
            <>
              <div className="border-t border-gray-100 my-1" />
              {others.map((w) => (
                <Link
                  key={w.id}
                  href={w.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      w.type === 'household' ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                  />
                  <span className="truncate">{w.name}</span>
                  <span className="ml-auto text-xs text-gray-400 capitalize">{w.type}</span>
                </Link>
              ))}
            </>
          )}

          <div className="border-t border-gray-100 my-1" />
          <Link
            href="/household/create"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-blue-600 hover:bg-gray-50 transition-colors"
          >
            + New household
          </Link>
        </div>
      )}
    </div>
  )
}
