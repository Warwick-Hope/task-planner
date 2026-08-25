'use client'

import { usePathname } from 'next/navigation'
import SectionNav, { type NavVariant } from '@/components/nav/SectionNav'
import type { NavIconKey } from '@/components/nav/NavIcon'

/** First four are the phone's bottom tabs; the rest go in the More sheet. */
const SECTIONS: { label: string; segment: string; icon: NavIconKey }[] = [
  { label: 'Dashboard', segment: '', icon: 'dashboard' },
  { label: 'Tasks', segment: 'tasks', icon: 'tasks' },
  { label: 'Cleaning', segment: 'cleaning', icon: 'cleaning' },
  { label: 'Shopping', segment: 'shopping', icon: 'shopping' },
  { label: 'Meals', segment: 'meals', icon: 'meals' },
  { label: 'Rooms', segment: 'rooms', icon: 'rooms' },
  { label: 'Categories', segment: 'categories', icon: 'categories' },
]

export default function HouseholdNav({ variant }: { variant: NavVariant }) {
  const pathname = usePathname()

  // Extract household ID from /household/[id]/...
  const match = pathname.match(/^\/household\/([^/]+)/)
  const householdId = match?.[1]

  if (!householdId) return null

  const items = SECTIONS.map(({ label, segment, icon }) => ({
    label,
    icon,
    href: segment ? `/household/${householdId}/${segment}` : `/household/${householdId}`,
    active: segment
      ? pathname.startsWith(`/household/${householdId}/${segment}`)
      : pathname === `/household/${householdId}`,
  }))

  return <SectionNav items={items} variant={variant} />
}
