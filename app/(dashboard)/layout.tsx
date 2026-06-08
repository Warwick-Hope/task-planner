import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import SignOutButton from '@/components/auth/SignOutButton'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Redirect to onboarding if profile not yet created
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name')
    .eq('id', user.id)
    .single()

  if (!profile) {
    redirect('/onboarding')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-sm font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                Clarity
              </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/tasks"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Tasks
              </Link>
              <Link
                href="/plan"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Plan
              </Link>
              <Link
                href="/calendar"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Calendar
              </Link>
              <Link
                href="/brain-dump"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Brain dump
              </Link>
              <Link
                href="/roles"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Categories
              </Link>
              <Link
                href="/mission"
                className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                Mission
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{profile?.display_name ?? user.email}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
