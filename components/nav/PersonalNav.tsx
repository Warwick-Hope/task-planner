'use client'

import { usePathname } from 'next/navigation'
import SectionNav, { type NavVariant } from '@/components/nav/SectionNav'
import type { NavIconKey } from '@/components/nav/NavIcon'

/**
 * Order matters: the first four are the phone's bottom tabs, the rest go in the
 * More sheet. Dashboard, Tasks, Plan and Calendar are the daily loop; the brain
 * dump, categories and mission are things you go to on purpose.
 */
const SECTIONS: { label: string; href: string; icon: NavIconKey }[] = [
  { label: 'Dashboard', href: '/dashboard', icon: 'dashboard' },
  { label: 'Tasks', href: '/tasks', icon: 'tasks' },
  { label: 'Plan', href: '/plan', icon: 'plan' },
  { label: 'Calendar', href: '/calendar', icon: 'calendar' },
  { label: 'Brain dump', href: '/brain-dump', icon: 'brain-dump' },
  { label: 'Categories', href: '/roles', icon: 'categories' },
  { label: 'Mission', href: '/mission', icon: 'mission' },
]

export default function PersonalNav({ variant }: { variant: NavVariant }) {
  const pathname = usePathname()

  const items = SECTIONS.map(({ label, href, icon }) => ({
    label,
    href,
    icon,
    active: pathname === href || (href !== '/dashboard' && pathname.startsWith(href)),
  }))

  return <SectionNav items={items} variant={variant} />
}
