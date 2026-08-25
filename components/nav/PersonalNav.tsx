'use client'

import { usePathname } from 'next/navigation'
import SectionNav, { type NavVariant } from '@/components/nav/SectionNav'

const SECTIONS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Plan', href: '/plan' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Brain dump', href: '/brain-dump' },
  { label: 'Categories', href: '/roles' },
  { label: 'Mission', href: '/mission' },
]

export default function PersonalNav({ variant }: { variant: NavVariant }) {
  const pathname = usePathname()

  const items = SECTIONS.map(({ label, href }) => ({
    label,
    href,
    active: pathname === href || (href !== '/dashboard' && pathname.startsWith(href)),
  }))

  return <SectionNav items={items} variant={variant} />
}
