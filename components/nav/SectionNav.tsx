'use client'

import Link from 'next/link'
import { useEffect, useRef } from 'react'

export type NavVariant = 'inline' | 'strip'

export interface NavItem {
  label: string
  href: string
  active: boolean
}

/**
 * The section nav in both the shapes the shell needs.
 *
 * `inline` is the desktop row inside the header bar. `strip` is the phone
 * version: a swipeable row under the header, because seven sections at a
 * readable size are far wider than a 390px viewport and wrapping them would
 * cost two thirds of the screen height.
 *
 * Personal and household navs differ only in how they work out `active`, so
 * they build the items and hand them here rather than repeating the markup.
 */
export default function SectionNav({ items, variant }: { items: NavItem[]; variant: NavVariant }) {
  const stripRef = useRef<HTMLElement>(null)
  const activeHref = items.find(i => i.active)?.href

  // Scroll the current section into view — otherwise landing on Mission or
  // Categories leaves the highlighted item off the right-hand edge.
  useEffect(() => {
    if (variant !== 'strip') return
    const container = stripRef.current
    const el = container?.querySelector<HTMLElement>('[data-active="true"]')
    if (!container || !el) return
    // Set scrollLeft directly rather than scrollIntoView, which would also
    // scroll the page vertically.
    container.scrollLeft = el.offsetLeft - (container.clientWidth - el.offsetWidth) / 2
  }, [variant, activeHref])

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

  return (
    <nav
      ref={stripRef}
      className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-4 px-4"
    >
      {items.map(({ label, href, active }) => (
        <Link
          key={href}
          href={href}
          data-active={active}
          className={`shrink-0 flex items-center min-h-[44px] rounded-lg px-3 text-sm transition-colors ${
            active ? 'bg-gray-100 text-gray-900 font-medium' : 'text-gray-500 active:bg-gray-50'
          }`}
        >
          {label}
        </Link>
      ))}
    </nav>
  )
}
