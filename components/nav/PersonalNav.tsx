'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const SECTIONS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Tasks', href: '/tasks' },
  { label: 'Plan', href: '/plan' },
  { label: 'Calendar', href: '/calendar' },
  { label: 'Brain dump', href: '/brain-dump' },
  { label: 'Categories', href: '/roles' },
  { label: 'Mission', href: '/mission' },
]

export default function PersonalNav() {
  const pathname = usePathname()

  return (
    <nav className="flex items-center gap-4">
      {SECTIONS.map(({ label, href }) => {
        const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
        return (
          <Link
            key={href}
            href={href}
            className={`text-sm transition-colors ${
              active ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
