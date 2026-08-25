/**
 * The icons for the mobile tab bar and its More sheet.
 *
 * Hand-written 24px stroke paths rather than an icon dependency: there are
 * twelve of them, they never change, and a package would be the largest thing
 * in the bundle it joined.
 */
export type NavIconKey =
  | 'dashboard'
  | 'tasks'
  | 'plan'
  | 'calendar'
  | 'brain-dump'
  | 'categories'
  | 'mission'
  | 'cleaning'
  | 'shopping'
  | 'meals'
  | 'rooms'
  | 'more'

const PATHS: Record<NavIconKey, string> = {
  // Squares: a dashboard of panels.
  dashboard: 'M4 5a1 1 0 011-1h5v7H4V5zm10-1h5a1 1 0 011 1v4h-6V4zm0 8h6v7a1 1 0 01-1 1h-5v-8zM4 14h6v6H5a1 1 0 01-1-1v-5z',
  // A ticked list.
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1.5 1.5L8 5M4 12l1.5 1.5L8 11M4 18l1.5 1.5L8 17',
  // Stacked horizons, narrowing — the app mark.
  plan: 'M4 6h16M4 12h11M4 18h6',
  calendar: 'M4 8h16M8 4v3m8-3v3M5 6h14a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1z',
  // A thought cloud.
  'brain-dump':
    'M8 17a4 4 0 01-.8-7.9A5 5 0 0117 8.5a3.5 3.5 0 01-.5 8.5H8zM6.5 20a1 1 0 100-2 1 1 0 000 2z',
  // A tag.
  categories: 'M11 4H6a2 2 0 00-2 2v5l9 9 7-7-9-9zm-4 4h.01',
  // A compass.
  mission: 'M12 21a9 9 0 100-18 9 9 0 000 18zm3.5-12.5l-2 5.5-5.5 2 2-5.5 5.5-2z',
  // A spray bottle.
  cleaning: 'M9 8h5a2 2 0 012 2v9a1 1 0 01-1 1h-7a1 1 0 01-1-1v-9a2 2 0 012-2zm1 0V5a1 1 0 011-1h2m4 2h2m-2 3h2',
  shopping: 'M6 6h15l-1.5 9h-12L6 6zm0 0L5.5 4H3m6 16a1 1 0 100-2 1 1 0 000 2zm9 0a1 1 0 100-2 1 1 0 000 2z',
  // A plate between cutlery.
  meals: 'M4 4v6a2 2 0 002 2h0a2 2 0 002-2V4M6 12v8M17 4c-1.5 1-2 3-2 5s.5 3 2 3 2-1 2-3-.5-4-2-5zm0 8v8',
  rooms: 'M4 10l8-6 8 6v9a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
}

export default function NavIcon({
  name,
  className = 'w-5 h-5',
}: {
  name: NavIconKey
  className?: string
}) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
