'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import NavIcon, { type NavIconKey } from '@/components/nav/NavIcon'
import InstallButton from '@/components/nav/InstallButton'

export type NavVariant = 'inline' | 'tabs'

export interface NavItem {
  label: string
  href: string
  active: boolean
  icon: NavIconKey
}

/**
 * The section nav in both the shapes the shell needs.
 *
 * `inline` is the desktop row inside the header bar. `tabs` is the phone
 * version: a fixed bottom bar of the four sections you use daily, plus a More
 * sheet for the rest.
 *
 * It replaced a swipeable strip under the header, which fitted but hid half the
 * sections off the right-hand edge — you had to scroll a navigation bar to find
 * out what the app could do. A bottom bar is also where a thumb already is, and
 * it reads as an app rather than a page once installed to the home screen.
 *
 * Personal and household navs differ only in how they work out `active` and what
 * their first four sections are, so they build the items and hand them here.
 */

/** Four tabs plus More. Fixed, because the grid below is `grid-cols-5`. */
const PRIMARY_COUNT = 4

export default function SectionNav({ items, variant }: { items: NavItem[]; variant: NavVariant }) {
  if (variant === 'inline') {
    return (
      <nav className="flex items-center gap-4">
        {items.map(({ label, href, active }) => (
          <Link
            key={href}
            href={href}
            className={`text-sm transition-colors ${
              active ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            {label}
          </Link>
        ))}
      </nav>
    )
  }

  return <TabBar items={items} />
}

function TabBar({ items }: { items: NavItem[] }) {
  const [moreOpen, setMoreOpen] = useState(false)
  const pathname = usePathname()

  // Navigating from the sheet has to close it — the route changes underneath
  // rather than the sheet unmounting.
  useEffect(() => {
    setMoreOpen(false)
  }, [pathname])

  const primary = items.slice(0, PRIMARY_COUNT)
  const overflow = items.slice(PRIMARY_COUNT)
  const overflowActive = overflow.some(i => i.active)

  return (
    <>
      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            className="absolute inset-0 bg-gray-900/30"
          />
          <div
            role="dialog"
            aria-label="More sections"
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white border-t border-gray-200 shadow-lg pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex justify-center py-2">
              <span className="h-1 w-10 rounded-full bg-gray-200" />
            </div>
            <div className="divide-y divide-gray-100">
              {overflow.map(({ label, href, active, icon }) => (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-3 min-h-[52px] text-sm transition-colors ${
                    active ? 'text-blue-600 font-medium' : 'text-gray-700 active:bg-gray-50'
                  }`}
                >
                  <NavIcon name={icon} className="w-5 h-5 shrink-0" />
                  {label}
                </Link>
              ))}
              <InstallButton />
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-white border-t border-gray-200 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto max-w-5xl grid grid-cols-5">
          {primary.map(({ label, href, active, icon }) => (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] px-1 text-[11px] leading-tight transition-colors ${
                active ? 'text-blue-600 font-medium' : 'text-gray-500'
              }`}
            >
              <NavIcon name={icon} className="w-6 h-6" />
              <span className="truncate max-w-full">{label}</span>
            </Link>
          ))}
          <button
            onClick={() => setMoreOpen(o => !o)}
            aria-expanded={moreOpen}
            className={`flex flex-col items-center justify-center gap-0.5 min-h-[56px] px-1 text-[11px] leading-tight transition-colors ${
              moreOpen || overflowActive ? 'text-blue-600 font-medium' : 'text-gray-500'
            }`}
          >
            <NavIcon name="more" className="w-6 h-6" />
            <span>More</span>
          </button>
        </div>
      </nav>
    </>
  )
}
