'use client'

import { usePathname } from 'next/navigation'
import SectionNav, { type NavVariant } from '@/components/nav/SectionNav'

const SECTIONS = [
  { label: 'Dashboard', segment: '' },
  { label: 'Tasks', segment: 'tasks' },
  { label: 'Cleaning', segment: 'cleaning' },
  { label: 'Shopping', segment: 'shopping' },
  { label: 'Meals', segment: 'meals' },
  { label: 'Rooms', segment: 'rooms' },
  { label: 'Categories', segment: 'categories' },
]

export default function HouseholdNav({ variant }: { variant: NavVariant }) {
  const pathname = usePathname()

  // Extract household ID from /household/[id]/...
  const match = pathname.match(/^\/household\/([^/]+)/)
  const householdId = match?.[1]

  if (!householdId) return null

  const items = SECTIONS.map(({ label, segment }) => ({
    label,
    href: segment ? `/household/${householdId}/${segment}` : `/household/${householdId}`,
    active: segment
      ? pathname.startsWith(`/household/${householdId}/${segment}`)
      : pathname === `/household/${householdId}`,
  }))

  return <SectionNav items={items} variant={variant} />
}
