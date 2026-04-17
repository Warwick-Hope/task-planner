import Link from 'next/link'

export const metadata = { title: 'Dashboard — Task Planner' }

export default function DashboardPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
        <Link
          href="/tasks/new"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + New task
        </Link>
      </div>
      <p className="text-sm text-gray-400">Task list coming in Phase 1.6.</p>
    </div>
  )
}
