'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  { label: 'Dashboard', segment: '' },
  { label: 'Tasks', segment: 'tasks' },
  { label: 'Cleaning', segment: 'cleaning' },
  { label: 'Shopping', segment: 'shopping' },
  { label: 'Meals', segment: 'meals' },
  { label: 'Rooms', segment: 'rooms' },
  { label: 'Categories', segment: 'categories' },
]

export default function HouseholdNav() {
  const pathname = usePathname()

  // Extract household ID from /household/[id]/...
  const match = pathname.match(/^\/household\/([^/]+)/)
  const householdId = match?.[1]

  if (!householdId) return null

  return (
    <nav className="flex items-center gap-4">
      {SECTIONS.map(({ label, segment }) => {
        const href = segment ? `/household/${householdId}/${segment}` : `/household/${householdId}`
        const active = segment
          ? pathname.startsWith(`/household/${householdId}/${segment}`)
          : pathname === `/household/${householdId}`

        return (
          <Link
            key={segment}
            href={href}
            className={`text-sm transition-colors ${
              active
                ? 'text-gray-900 font-medium'
                : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
